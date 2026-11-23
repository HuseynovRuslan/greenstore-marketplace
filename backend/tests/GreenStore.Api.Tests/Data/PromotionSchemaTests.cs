using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>
/// The phase 5 tables keep DATABASE.md §3.9 on their own: packages, options, orders, payment events and the promotions
/// running on listings. Every statement runs in a transaction that is rolled back.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class PromotionSchemaTests(LifecycleApi api)
{
    private const string AnyListing = "(SELECT id FROM listings ORDER BY number LIMIT 1)";
    private const string AnyUser = "(SELECT id FROM users ORDER BY created_at, id LIMIT 1)";
    private const string OrderId = "019a8b4e-0000-7000-8000-00000000beef";

    private const string Order = $"INSERT INTO promotion_orders (id, listing_id, user_id, option_id, amount, status, provider, provider_ref) VALUES ('{OrderId}', {AnyListing}, {AnyUser}, 'one-cixar-7', 9, 'pending', 'fake', 'schema-test')";

    [Theory]
    [InlineData("INSERT INTO promotion_packages (id, name, summary) VALUES ('vip', '{\"az\": \"VIP\"}', '{\"az\": \"x\"}')", "ck_promotion_packages_id")]
    [InlineData("UPDATE promotion_packages SET name = '{\"ru\": \"Топ\"}' WHERE id = 'one-cixar'", "ck_promotion_packages_name")]
    [InlineData("UPDATE promotion_packages SET summary = '\"x\"' WHERE id = 'one-cixar'", "ck_promotion_packages_summary")]
    [InlineData("UPDATE promotion_packages SET benefits = '{}' WHERE id = 'one-cixar'", "ck_promotion_packages_benefits")]
    [InlineData("INSERT INTO promotion_options (id, package_id, label, price, days) VALUES ('One Cixar', 'one-cixar', '{\"az\": \"x\"}', 1, 1)", "ck_promotion_options_id")]
    [InlineData("UPDATE promotion_options SET label = '{}' WHERE id = 'one-cixar-7'", "ck_promotion_options_label")]
    [InlineData("UPDATE promotion_options SET price = 0 WHERE id = 'one-cixar-7'", "ck_promotion_options_price")]
    [InlineData("UPDATE promotion_options SET days = 0 WHERE id = 'one-cixar-7'", "ck_promotion_options_days")]
    [InlineData("UPDATE promotion_options SET bumps = -1 WHERE id = 'ireli-cek-1'", "ck_promotion_options_bumps")]
    [InlineData("UPDATE promotion_options SET days = NULL, bumps = NULL WHERE id = 'one-cixar-7'", "ck_promotion_options_runs")]
    [InlineData($"{Order}; UPDATE promotion_orders SET amount = 0 WHERE id = '{OrderId}'", "ck_promotion_orders_amount")]
    [InlineData($"{Order}; UPDATE promotion_orders SET status = 'done' WHERE id = '{OrderId}'", "ck_promotion_orders_status")]
    [InlineData($"{Order}; UPDATE promotion_orders SET status = 'paid' WHERE id = '{OrderId}'", "ck_promotion_orders_paid_at")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'top', now(), now() + interval '1 day')", "ck_listing_promotions_kind")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'feature', now(), now())", "ck_listing_promotions_period")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at, bumps_left, next_bump_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'bump', now(), now() + interval '1 day', -1, now())", "ck_listing_promotions_bumps_left")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at, bumps_left, next_bump_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'feature', now(), now() + interval '1 day', 2, now())", "ck_listing_promotions_feature_has_no_bumps")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at, bumps_left) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'bump', now(), now() + interval '1 day', 2)", "ck_listing_promotions_next_bump")]
    [InlineData("UPDATE listings SET is_promoted = true, promoted_at = NULL WHERE id = (SELECT id FROM listings WHERE is_promoted LIMIT 1)", "ck_listings_promoted_at")]
    [InlineData("UPDATE listings SET promoted_at = now() WHERE id = (SELECT id FROM listings WHERE NOT is_promoted LIMIT 1)", "ck_listings_promoted_at")]
    [InlineData("UPDATE listings SET is_promoted = false WHERE id = (SELECT id FROM listings WHERE is_promoted LIMIT 1)", "ck_listings_promoted_at")]
    public async Task A_row_against_the_rules_is_refused(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Theory]
    [InlineData("INSERT INTO promotion_options (id, package_id, label, price, days) VALUES ('x-1', 'x', '{\"az\": \"x\"}', 1, 1)", "fk_promotion_options_promotion_packages_package_id")]
    [InlineData($"INSERT INTO promotion_orders (id, listing_id, user_id, option_id, amount, status, provider) VALUES (gen_random_uuid(), gen_random_uuid(), {AnyUser}, 'one-cixar-7', 9, 'pending', 'fake')", "fk_promotion_orders_listings_listing_id")]
    [InlineData($"INSERT INTO promotion_orders (id, listing_id, user_id, option_id, amount, status, provider) VALUES (gen_random_uuid(), {AnyListing}, gen_random_uuid(), 'one-cixar-7', 9, 'pending', 'fake')", "fk_promotion_orders_users_user_id")]
    [InlineData($"INSERT INTO promotion_orders (id, listing_id, user_id, option_id, amount, status, provider) VALUES (gen_random_uuid(), {AnyListing}, {AnyUser}, 'one-cixar-99', 9, 'pending', 'fake')", "fk_promotion_orders_promotion_options_option_id")]
    [InlineData($"INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), {AnyListing}, gen_random_uuid(), 'feature', now(), now() + interval '1 day')", "fk_listing_promotions_promotion_orders_order_id")]
    [InlineData($"{Order}; INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), gen_random_uuid(), '{OrderId}', 'feature', now(), now() + interval '1 day')", "fk_listing_promotions_listings_listing_id")]
    [InlineData($"UPDATE listings SET pending_promotion_option_id = 'one-cixar-99' WHERE id = {AnyListing}", "fk_listings_promotion_options_pending_promotion_option_id")]
    [InlineData("DELETE FROM promotion_packages WHERE id = 'one-cixar'", "fk_promotion_options_promotion_packages_package_id")]
    public async Task A_row_must_point_at_something_real(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task A_payment_is_counted_once_and_an_order_starts_each_kind_once()
    {
        var twice = await SchemaAssert.FailAsync(api.ConnectionString, $"""
            {Order};
            INSERT INTO promotion_orders (id, listing_id, user_id, option_id, amount, status, provider, provider_ref) VALUES (gen_random_uuid(), {AnyListing}, {AnyUser}, 'one-cixar-7', 9, 'pending', 'fake', 'schema-test');
            """);
        Assert.Equal((PostgresErrorCodes.UniqueViolation, "ux_promotion_orders_provider_ref"), (twice.SqlState, twice.ConstraintName));

        var rows = await SchemaAssert.FailAsync(api.ConnectionString, $"""
            {Order};
            INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'feature', now(), now() + interval '7 days');
            INSERT INTO listing_promotions (id, listing_id, order_id, kind, starts_at, ends_at) VALUES (gen_random_uuid(), {AnyListing}, '{OrderId}', 'feature', now(), now() + interval '7 days');
            """);
        Assert.Equal((PostgresErrorCodes.UniqueViolation, "ux_listing_promotions_order_kind"), (rows.SqlState, rows.ConstraintName));

        var number = await SchemaAssert.FailAsync(api.ConnectionString, $"""
            INSERT INTO promotion_orders (id, number, listing_id, user_id, option_id, amount, status, provider) VALUES (gen_random_uuid(), 7, {AnyListing}, {AnyUser}, 'one-cixar-7', 9, 'pending', 'fake');
            INSERT INTO promotion_orders (id, number, listing_id, user_id, option_id, amount, status, provider) VALUES (gen_random_uuid(), 7, {AnyListing}, {AnyUser}, 'one-cixar-7', 9, 'pending', 'fake');
            """);
        Assert.Equal("ux_promotion_orders_number", number.ConstraintName);
    }

    [Fact]
    public async Task Order_numbers_start_at_1001()
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new NpgsqlCommand("SELECT start_value FROM pg_sequences WHERE sequencename = 'promotion_order_number_seq'", connection);

        Assert.Equal(1001L, (long)(await command.ExecuteScalarAsync(Ct))!);
    }

    [Fact]
    public async Task The_indexes_are_the_ones_of_the_design()
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand(
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('promotion_packages', 'promotion_options', 'promotion_orders', 'payment_events', 'listing_promotions')",
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
                ["pk_promotion_packages"] = "USING btree (id)",
                ["pk_promotion_options"] = "USING btree (id)",
                ["pk_promotion_orders"] = "USING btree (id)",
                ["ux_promotion_orders_number"] = "USING btree (number)",
                ["ux_promotion_orders_provider_ref"] = "USING btree (provider, provider_ref)",
                ["ix_orders_listing"] = "USING btree (listing_id)",
                ["pk_payment_events"] = "USING btree (id)",
                ["pk_listing_promotions"] = "USING btree (id)",
                ["ix_promotions_listing"] = "USING btree (listing_id, ends_at)",
                ["ix_promotions_bump"] = "USING btree (next_bump_at) WHERE (bumps_left > 0)",
                ["ux_listing_promotions_order_kind"] = "USING btree (order_id, kind)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }
}
