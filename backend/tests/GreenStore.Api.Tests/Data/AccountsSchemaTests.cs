using GreenStore.Api.Tests.Infrastructure;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>
/// The account tables keep DATABASE.md §3.2 and §3.7 on their own. Every statement runs in a transaction that is
/// rolled back, so the data stays as it is.
/// </summary>
[Collection(AccountsCollection.Name)]
public sealed class AccountsSchemaTests(AccountsApi api)
{
    private const string AnyUser = "(SELECT id FROM users ORDER BY created_at, id LIMIT 1)";
    private const string AnyListing = "(SELECT id FROM listings ORDER BY number LIMIT 1)";

    [Theory]
    [InlineData("INSERT INTO otp_challenges (id, phone, purpose, code_hash, expires_at) VALUES (gen_random_uuid(), '+994551234567', 'signup', '\\x00', now())", "ck_otp_challenges_purpose")]
    [InlineData("INSERT INTO otp_challenges (id, phone, purpose, code_hash, expires_at, attempts) VALUES (gen_random_uuid(), '+994551234567', 'login', '\\x00', now(), 6)", "ck_otp_challenges_attempts")]
    [InlineData($"INSERT INTO sessions (id, user_id, token_hash, client, expires_at) VALUES (gen_random_uuid(), {AnyUser}, '\\x01', 'desktop', now())", "ck_sessions_client")]
    [InlineData($"INSERT INTO sessions (id, user_id, token_hash, client, expires_at, device_name) VALUES (gen_random_uuid(), {AnyUser}, '\\x02', 'web', now(), repeat('x', 81))", "ck_sessions_device_name")]
    [InlineData($"INSERT INTO saved_searches (id, user_id, name, query, filter) VALUES (gen_random_uuid(), {AnyUser}, '', 'q=a', '{{}}')", "ck_saved_searches_name")]
    [InlineData($"INSERT INTO saved_searches (id, user_id, name, query, filter) VALUES (gen_random_uuid(), {AnyUser}, 'Ad', repeat('q', 501), '{{}}')", "ck_saved_searches_query")]
    public async Task A_row_against_the_rules_is_refused(string sql, string constraint)
    {
        var error = await FailAsync(sql);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task A_token_hash_names_one_session()
    {
        var error = await FailAsync($"""
            INSERT INTO sessions (id, user_id, token_hash, client, expires_at) VALUES (gen_random_uuid(), {AnyUser}, '\x0a', 'web', now());
            INSERT INTO sessions (id, user_id, token_hash, client, expires_at) VALUES (gen_random_uuid(), {AnyUser}, '\x0a', 'web', now());
            """);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("ux_sessions_token_hash", error.ConstraintName);
    }

    [Fact]
    public async Task A_listing_is_a_favourite_of_a_user_once()
    {
        var error = await FailAsync($"""
            INSERT INTO favorites (user_id, listing_id) VALUES ({AnyUser}, {AnyListing});
            INSERT INTO favorites (user_id, listing_id) VALUES ({AnyUser}, {AnyListing});
            """);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("pk_favorites", error.ConstraintName);
    }

    [Fact]
    public async Task A_favourite_needs_a_real_listing() =>
        Assert.Equal("fk_favorites_listings_listing_id", (await FailAsync($"INSERT INTO favorites (user_id, listing_id) VALUES ({AnyUser}, gen_random_uuid())")).ConstraintName);

    [Fact]
    public async Task Deleting_an_account_row_removes_its_sessions_favourites_and_searches()
    {
        var account = await api.RegisterAsync();
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        async Task<long> CountAsync(string table)
        {
            await using var count = new NpgsqlCommand($"SELECT count(*) FROM {table} WHERE user_id = '{account.Id}'", connection, transaction);
            return (long)(await count.ExecuteScalarAsync(Ct))!;
        }

        await using (var setup = new NpgsqlCommand(
            $"""
            INSERT INTO favorites (user_id, listing_id) VALUES ('{account.Id}', {AnyListing});
            INSERT INTO saved_searches (id, user_id, name, query, filter) VALUES (gen_random_uuid(), '{account.Id}', 'Ad', 'q=a', jsonb_build_object());
            """,
            connection,
            transaction))
        {
            await setup.ExecuteNonQueryAsync(Ct);
        }

        Assert.Equal(1, await CountAsync("sessions"));
        await using (var delete = new NpgsqlCommand($"DELETE FROM users WHERE id = '{account.Id}'", connection, transaction))
        {
            await delete.ExecuteNonQueryAsync(Ct);
        }

        Assert.Equal(0, await CountAsync("sessions"));
        Assert.Equal(0, await CountAsync("favorites"));
        Assert.Equal(0, await CountAsync("saved_searches"));
        await transaction.RollbackAsync(Ct);
    }

    [Fact]
    public async Task The_indexes_are_the_ones_of_the_design()
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand(
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('sessions', 'otp_challenges', 'favorites', 'saved_searches')",
                connection);
            await using var reader = await command.ExecuteReaderAsync(Ct);
            while (await reader.ReadAsync(Ct))
            {
                indexes[reader.GetString(0)] = reader.GetString(1);
            }
        }

        Assert.Equal(
            new Dictionary<string, string>
            {
                ["pk_sessions"] = "USING btree (id)",
                ["ix_sessions_user"] = "USING btree (user_id)",
                ["ux_sessions_token_hash"] = "USING btree (token_hash)",
                ["pk_otp_challenges"] = "USING btree (id)",
                ["ix_otp_phone"] = "USING btree (phone, created_at DESC)",
                ["ix_otp_ip"] = "USING btree (ip_hash, created_at DESC)",
                ["ix_otp_created"] = "USING btree (created_at)",
                ["pk_favorites"] = "USING btree (user_id, listing_id)",
                ["ix_favorites_listing"] = "USING btree (listing_id)",
                ["pk_saved_searches"] = "USING btree (id)",
                ["ix_saved_searches_user"] = "USING btree (user_id)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }

    private async Task<PostgresException> FailAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        PostgresException? refused = null;
        try
        {
            await command.ExecuteNonQueryAsync(Ct);
        }
        catch (PostgresException error)
        {
            refused = error;
        }
        finally
        {
            await transaction.RollbackAsync(Ct);
        }

        Assert.True(refused is not null, $"The database accepted it: {sql}");
        return refused;
    }
}
