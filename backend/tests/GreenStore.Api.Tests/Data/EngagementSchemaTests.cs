using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>
/// The phase 4 tables keep DATABASE.md §3.7 and §3.8 on their own: reports, service requests and their recipients,
/// support messages. Every statement runs in a transaction that is rolled back.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class EngagementSchemaTests(LifecycleApi api)
{
    private const string AnyListing = "(SELECT id FROM listings ORDER BY number LIMIT 1)";
    private const string AnySeller = "(SELECT id FROM sellers ORDER BY created_at, id LIMIT 1)";
    private const string AnyUser = "(SELECT id FROM users ORDER BY created_at, id LIMIT 1)";

    private const string RequestId = "019a8b4e-0000-7000-8000-00000000abcd";

    private const string Request = $"INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone) VALUES ('{RequestId}', 'landsaft-dizayni', 'baki', 'Həyətin dizaynı lazımdır', 'Aygün', '+994505551234')";

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
    [InlineData("INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone) VALUES (gen_random_uuid(), 'landsaft-dizayni', 'baki', 'x', 'Aygün', '0505551234')", "ck_service_requests_customer_phone")]
    [InlineData("INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone, status) VALUES (gen_random_uuid(), 'landsaft-dizayni', 'baki', 'x', 'Aygün', '+994505551234', 'done')", "ck_service_requests_status")]
    [InlineData("INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone) VALUES (gen_random_uuid(), 'landsaft-dizayni', 'baki', repeat('d', 1001), 'Aygün', '+994505551234')", "ck_service_requests_description")]
    [InlineData("INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone, size) VALUES (gen_random_uuid(), 'landsaft-dizayni', 'baki', 'x', 'Aygün', '+994505551234', repeat('s', 41))", "ck_service_requests_size")]
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
    [InlineData("INSERT INTO service_requests (id, category_id, city_id, description, customer_name, customer_phone) VALUES (gen_random_uuid(), 'yoxdur', 'baki', 'x', 'Aygün', '+994505551234')", "fk_service_requests_categories_category_id")]
    [InlineData("INSERT INTO service_request_recipients (request_id, provider_user_id) VALUES (gen_random_uuid(), gen_random_uuid())", "fk_service_request_recipients_service_requests_request_id")]
    public async Task A_row_must_point_at_something_real(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task A_provider_gets_a_request_once_and_its_recipients_go_with_it()
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, $"""
            {Request};
            INSERT INTO service_request_recipients (request_id, provider_user_id) VALUES ('{RequestId}', {AnyUser});
            INSERT INTO service_request_recipients (request_id, provider_user_id) VALUES ('{RequestId}', {AnyUser});
            """);
        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("pk_service_request_recipients", error.ConstraintName);

        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using (var setup = new NpgsqlCommand(
            $"""
            {Request};
            INSERT INTO service_request_recipients (request_id, provider_user_id) VALUES ('{RequestId}', {AnyUser});
            DELETE FROM service_requests WHERE id = '{RequestId}';
            """,
            connection,
            transaction))
        {
            await setup.ExecuteNonQueryAsync(Ct);
        }

        await using var count = new NpgsqlCommand($"SELECT count(*) FROM service_request_recipients WHERE request_id = '{RequestId}'", connection, transaction);
        Assert.Equal(0L, (long)(await count.ExecuteScalarAsync(Ct))!);
        await transaction.RollbackAsync(Ct);
    }

    [Fact]
    public async Task Numbers_and_tickets_start_where_the_design_says_and_are_unique()
    {
        var starts = new Dictionary<string, long>();
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand("SELECT sequencename, start_value FROM pg_sequences WHERE sequencename IN ('service_request_number_seq', 'support_ticket_seq')", connection);
            await using var reader = await command.ExecuteReaderAsync(Ct);
            while (await reader.ReadAsync(Ct))
            {
                starts[reader.GetString(0)] = reader.GetInt64(1);
            }
        }

        Assert.Equal(3001, starts["service_request_number_seq"]);
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
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('reports', 'service_requests', 'service_request_recipients', 'support_messages')",
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
                ["pk_service_requests"] = "USING btree (id)",
                ["ux_service_requests_number"] = "USING btree (number)",
                ["pk_service_request_recipients"] = "USING btree (request_id, provider_user_id)",
                ["pk_support_messages"] = "USING btree (id)",
                ["ux_support_messages_ticket"] = "USING btree (ticket)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }
}
