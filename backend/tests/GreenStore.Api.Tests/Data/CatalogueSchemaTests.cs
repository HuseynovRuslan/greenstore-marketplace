using GreenStore.Api.Tests.Infrastructure;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>
/// The catalogue tables keep DATABASE.md §3 on their own: every rule below is refused by the database whatever the
/// application does. Each statement runs in a transaction that is rolled back, so the seeded data stays as it is.
/// </summary>
[Collection(CatalogueCollection.Name)]
public sealed class CatalogueSchemaTests(CatalogueApi api)
{
    private const string Olive = "number = 10482";

    [Theory]
    [InlineData($"UPDATE listings SET price_type = 'agreement' WHERE {Olive}", "ck_listings_agreement_has_no_price")]
    [InlineData($"UPDATE listings SET price = NULL WHERE {Olive}", "ck_listings_price_given")]
    [InlineData($"UPDATE listings SET price = -1 WHERE {Olive}", "ck_listings_price")]
    [InlineData($"UPDATE listings SET phone_hidden = true, whatsapp = false WHERE {Olive}", "ck_listings_hidden_phone_has_whatsapp")]
    [InlineData($"UPDATE listings SET published_at = NULL WHERE {Olive}", "ck_listings_active_dates")]
    [InlineData($"UPDATE listings SET status = 'rejected' WHERE {Olive}", "ck_listings_rejected_reason")]
    [InlineData($"UPDATE listings SET status = 'draft' WHERE {Olive}", "ck_listings_status")]
    [InlineData($"UPDATE listings SET includes = '{{Əkin}}' WHERE {Olive}", "ck_listings_service_fields")]
    [InlineData($"UPDATE listings SET contact_phone = '050 555 12 34' WHERE {Olive}", "ck_listings_contact_phone")]
    [InlineData($"UPDATE listings SET height_max_cm = 10 WHERE {Olive}", "ck_listings_height_range")]
    [InlineData($"UPDATE listings SET wholesale_price = NULL WHERE {Olive}", "ck_listings_wholesale_pair")]
    [InlineData($"UPDATE listings SET root_system = 'BareRoot' WHERE {Olive}", "ck_listings_root_system")]
    [InlineData($"UPDATE listings SET title = 'ab' WHERE {Olive}", "ck_listings_title")]
    [InlineData("UPDATE categories SET form = 'plant' WHERE id = 'agaclar-meyve'", "ck_categories_form_on_categories_only")]
    [InlineData("UPDATE categories SET name = '{\"ru\": \"Деревья\"}' WHERE id = 'agaclar'", "ck_categories_name")]
    [InlineData("UPDATE cities SET name = '\"Bakı\"' WHERE id = 'baki'", "ck_cities_name")]
    [InlineData("UPDATE sellers SET offers = '{delivery,massage}' WHERE slug = 'quba-fidan'", "ck_sellers_offers")]
    [InlineData("UPDATE sellers SET lat = NULL WHERE slug = 'abseron-tingcilik'", "ck_sellers_location")]
    [InlineData("UPDATE users SET phone = NULL WHERE full_name = 'Elvin Əliyev'", "ck_users_credentials")]
    [InlineData("UPDATE listing_photos SET position = 12 WHERE position = 0 AND listing_id = (SELECT id FROM listings WHERE number = 10482)", "ck_listing_photos_position")]
    public async Task A_row_against_the_rules_is_refused(string sql, string constraint)
    {
        var error = await FailAsync(sql);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Theory]
    [InlineData($"UPDATE listings SET slug = 'tuya-smaragd-10362' WHERE {Olive}", "ux_listings_slug")]
    [InlineData($"UPDATE listings SET number = 10362 WHERE {Olive}", "ux_listings_number")]
    [InlineData("UPDATE sellers SET slug = 'quba-fidan' WHERE slug = 'abseron-tingcilik'", "ux_sellers_slug")]
    [InlineData("UPDATE sellers SET owner_user_id = (SELECT owner_user_id FROM sellers WHERE slug = 'quba-fidan') WHERE slug = 'abseron-tingcilik'", "ux_sellers_owner_user_id")]
    [InlineData("INSERT INTO users (id, phone, full_name, account_type, password_hash, email) VALUES (gen_random_uuid(), '+994509999999', 'Test', 'individual', 'x', 'INFO@ABSHERONTING.AZ')", "ux_users_email")]
    [InlineData("INSERT INTO users (id, phone, full_name, account_type, password_hash) SELECT gen_random_uuid(), phone, 'Test', 'individual', 'x' FROM users LIMIT 1", "ux_users_phone")]
    public async Task Slugs_numbers_profiles_and_emails_are_unique(string sql, string index)
    {
        var error = await FailAsync(sql);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal(index, error.ConstraintName);
    }

    [Fact]
    public async Task A_listing_needs_a_real_category_city_and_owner()
    {
        var error = await FailAsync($"UPDATE listings SET category_id = 'otaq-bitkileri' WHERE {Olive}");

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal("fk_listings_categories_category_id", error.ConstraintName);
    }

    [Fact]
    public async Task The_indexes_are_the_ones_of_the_design()
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using (var connection = new NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand(
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('listings', 'listing_photos', 'listing_counters', 'photos', 'sellers', 'users', 'categories', 'cities')",
                connection);
            await using var reader = await command.ExecuteReaderAsync(Ct);
            while (await reader.ReadAsync(Ct))
            {
                indexes[reader.GetString(0)] = reader.GetString(1);
            }
        }

        const string Public = "WHERE ((status = 'active'::text) AND (deleted_at IS NULL))";
        Assert.Equal(
            new Dictionary<string, string>
            {
                ["pk_categories"] = "USING btree (id)",
                ["pk_cities"] = "USING btree (id)",
                ["pk_users"] = "USING btree (id)",
                ["ux_users_phone"] = "USING btree (phone)",
                ["ux_users_email"] = "USING btree (lower(email)) WHERE (email IS NOT NULL)",
                ["pk_photos"] = "USING btree (id)",
                ["ix_photos_unattached"] = "USING btree (created_at) WHERE (attached_at IS NULL)",
                ["pk_sellers"] = "USING btree (id)",
                ["ux_sellers_slug"] = "USING btree (slug)",
                ["ux_sellers_owner_user_id"] = "USING btree (owner_user_id)",
                ["pk_listings"] = "USING btree (id)",
                ["ux_listings_number"] = "USING btree (number)",
                ["ux_listings_slug"] = "USING btree (slug)",
                ["ix_listings_feed"] = $"USING btree (kind, is_promoted DESC, promoted_at DESC, sort_at DESC) {Public}",
                ["ix_listings_category"] = $"USING btree (category_id, sort_at DESC) {Public}",
                ["ix_listings_search"] = $"USING gin (search_text gin_trgm_ops) {Public}",
                ["ix_listings_owner"] = "USING btree (owner_user_id, status) WHERE (deleted_at IS NULL)",
                ["ix_listings_seller"] = "USING btree (seller_id) WHERE ((seller_id IS NOT NULL) AND (deleted_at IS NULL))",
                ["ix_listings_moderation"] = "USING btree (submitted_at) WHERE ((status = 'pending'::text) AND (deleted_at IS NULL))",
                ["ix_listings_expiry"] = $"USING btree (expires_at) {Public}",
                ["pk_listing_photos"] = "USING btree (listing_id, \"position\")",
                ["ux_listing_photos_photo_id"] = "USING btree (photo_id)",
                ["pk_listing_counters"] = "USING btree (listing_id)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }

    [Fact]
    public async Task The_search_uses_the_trigram_index_once_the_catalogue_is_big()
    {
        // With 60 rows PostgreSQL rightly reads the whole table. In a transaction that is rolled back, 20 000 more
        // active listings make it a real catalogue: then LIKE '%word%' goes through the trigram index (DATABASE.md §4).
        // The new rows first land in the GIN index's pending list (fastupdate), and the planner's cost for the index
        // grows with that list: depending on how many pages it happens to hold, a sequential scan can look cheaper.
        // gin_clean_pending_list moves them into the index proper, as autovacuum does on a live catalogue.
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using (var fill = new NpgsqlCommand(
            """
            INSERT INTO listings (id, number, slug, kind, owner_user_id, category_id, city_id, status, title, price_type, price,
                                  contact_name, contact_phone, contact_phone_verified, search_text, published_at, expires_at, sort_at)
            SELECT gen_random_uuid(), 900000 + g, 'test-elan-' || g, 'product', (SELECT owner_user_id FROM listings LIMIT 1),
                   'agaclar', 'baki', 'active', 'Test elan ' || g, 'fixed', 10, 'Test', '+994500000999', false,
                   'test elan ' || md5(g::text), now(), now() + interval '30 days', now()
            FROM generate_series(1, 20000) AS g;
            SELECT gin_clean_pending_list('ix_listings_search');
            ANALYZE listings;
            """,
            connection,
            transaction))
        {
            await fill.ExecuteNonQueryAsync(Ct);
        }

        await using var explain = new NpgsqlCommand(
            "EXPLAIN SELECT id FROM listings WHERE kind = 'product' AND status = 'active' AND deleted_at IS NULL AND search_text LIKE '%zeytun%'",
            connection,
            transaction);
        var plan = new List<string>();
        await using (var reader = await explain.ExecuteReaderAsync(Ct))
        {
            while (await reader.ReadAsync(Ct))
            {
                plan.Add(reader.GetString(0));
            }
        }

        await transaction.RollbackAsync(Ct);
        Assert.True(plan.Any(line => line.Contains("Bitmap Index Scan on ix_listings_search", StringComparison.Ordinal)), string.Join("\n", plan));
    }

    private async Task<PostgresException> FailAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        PostgresException? refused = null;
        var rows = 0;
        try
        {
            rows = await command.ExecuteNonQueryAsync(Ct);
        }
        catch (PostgresException error)
        {
            refused = error;
        }
        finally
        {
            await transaction.RollbackAsync(Ct);
        }

        Assert.True(refused is not null, $"The database accepted it ({rows} row(s)): {sql}");
        return refused;
    }
}
