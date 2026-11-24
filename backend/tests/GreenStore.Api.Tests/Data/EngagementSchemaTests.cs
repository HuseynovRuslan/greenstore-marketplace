using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>
/// The phase 4 tables keep DATABASE.md §3.7 and §3.8 on their own: reports and support messages. Every statement runs
/// in a transaction that is rolled back.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class EngagementSchemaTests(LifecycleApi api)
{
    private const string AnyListing = "(SELECT id FROM listings ORDER BY number LIMIT 1)";
    private const string AnySeller = "(SELECT id FROM sellers ORDER BY created_at, id LIMIT 1)";

    [Theory]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, seller_id, reason_code) VALUES (gen_random_uuid(), 'listing', {AnyListing}, {AnySeller}, 'sold')", "ck_reports_one_target")]
    [InlineData("INSERT INTO reports (id, target_kind, reason_code) VALUES (gen_random_uuid(), 'listing', 'sold')", "ck_reports_one_target")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code) VALUES (gen_random_uuid(), 'seller', {AnyListing}, 'fraud')", "ck_reports_seller_target")]
    [InlineData($"INSERT INTO reports (id, target_kind, seller_id, reason_code) VALUES (gen_random_uuid(), 'listing', {AnySeller}, 'fraud')", "ck_reports_seller_target")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code) VALUES (gen_random_uuid(), 'listing', {AnyListing}, 'other')", "ck_reports_other_has_comment")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code, status) VALUES (gen_random_uuid(), 'listing', {AnyListing}, 'sold', 'resolved')", "ck_reports_resolved_has_resolution")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code) VALUES (gen_random_uuid(), 'listing', {AnyListing}, 'spam')", "ck_reports_reason_code")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code) VALUES (gen_random_uuid(), 'user', {AnyListing}, 'sold')", "ck_reports_target_kind")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code, status, resolution) VALUES (gen_random_uuid(), 'listing', {AnyListing}, 'sold', 'resolved', 'deleted')", "ck_reports_resolution")]
    [InlineData($"INSERT INTO reports (id, target_kind, listing_id, reason_code, comment) VALUES (gen_random_uuid(), 'listing', {AnyListing}, 'sold', repeat('c', 501))", "ck_reports_comment")]
    [InlineData("INSERT INTO support_messages (id, topic, name, contact, message) VALUES (gen_random_uuid(), 'billing', 'Rauf', 'r@x.az', 'Salam')", "ck_support_messages_topic")]
    [InlineData("INSERT INTO support_messages (id, topic, name, contact, message) VALUES (gen_random_uuid(), 'other', 'Rauf', 'r@x.az', repeat('m', 2001))", "ck_support_messages_message")]
    [InlineData("INSERT INTO support_messages (id, topic, name, contact, message, status) VALUES (gen_random_uuid(), 'other', 'Rauf', 'r@x.az', 'Salam', 'open')", "ck_support_messages_status")]
    public async Task A_row_against_the_rules_is_refused(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Theory]
    [InlineData("INSERT INTO reports (id, target_kind, listing_id, reason_code) VALUES (gen_random_uuid(), 'listing', gen_random_uuid(), 'sold')", "fk_reports_listings_listing_id")]
    [InlineData("INSERT INTO reports (id, target_kind, seller_id, reason_code) VALUES (gen_random_uuid(), 'seller', gen_random_uuid(), 'fraud')", "fk_reports_sellers_seller_id")]
    public async Task A_row_must_point_at_something_real(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task The_usta_cagir_tables_are_gone()
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand(
            "SELECT to_regclass('service_requests') IS NULL AND to_regclass('service_request_recipients') IS NULL AND to_regclass('service_request_number_seq') IS NULL",
            connection);
        Assert.True((bool)(await command.ExecuteScalarAsync(Ct))!);
    }

    [Fact]
    public async Task Tickets_start_where_the_design_says_and_are_unique()
    {
        var starts = new Dictionary<string, long>();
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand("SELECT sequencename, start_value FROM pg_sequences WHERE sequencename = 'support_ticket_seq'", connection);
            await using var reader = await command.ExecuteReaderAsync(Ct);
            while (await reader.ReadAsync(Ct))
            {
                starts[reader.GetString(0)] = reader.GetInt64(1);
            }
        }

        Assert.Equal(1001, starts["support_ticket_seq"]);

        var error = await SchemaAssert.FailAsync(api.ConnectionString, """
            INSERT INTO support_messages (id, ticket, topic, name, contact, message) VALUES (gen_random_uuid(), 99, 'other', 'Rauf', 'r@x.az', 'Salam');
            INSERT INTO support_messages (id, ticket, topic, name, contact, message) VALUES (gen_random_uuid(), 99, 'other', 'Rauf', 'r@x.az', 'Salam');
            """);
        Assert.Equal("ux_support_messages_ticket", error.ConstraintName);
    }

    [Fact]
    public async Task The_indexes_are_the_ones_of_the_design()
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand(
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('reports', 'support_messages')",
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
                ["pk_reports"] = "USING btree (id)",
                ["ix_reports_open"] = "USING btree (created_at) WHERE (status <> 'resolved'::text)",
                ["ix_reports_listing"] = "USING btree (listing_id) WHERE (listing_id IS NOT NULL)",
                ["pk_support_messages"] = "USING btree (id)",
                ["ux_support_messages_ticket"] = "USING btree (ticket)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }
}
