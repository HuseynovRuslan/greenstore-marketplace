using System.Net;
using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Jobs;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>The background jobs (ARCHITECTURE.md §12), run by hand on the lifecycle database with the test clock.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class JobsTests(LifecycleApi api)
{
    [Fact]
    public async Task The_api_runs_the_three_jobs()
    {
        await using var factory = api.Variant();
        var hosted = factory.Services.GetServices<IHostedService>().ToList();

        Assert.Contains(hosted, s => s is ExpireListingsJob);
        Assert.Contains(hosted, s => s is OutboxJob);
        Assert.Contains(hosted, s => s is CleanupJob);
    }

    [Fact]
    public async Task Listings_past_their_term_expire_and_the_site_is_told()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        await api.ApproveAsync(id);
        await using (var db = api.CreateDbContext())
        {
            await db.Listings.Where(l => l.Id == Guid.Parse(id)).ExecuteUpdateAsync(l => l.SetProperty(x => x.ExpiresAt, api.Clock.Now.AddSeconds(-1)), Ct);
        }

        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        var expired = await scope.ServiceProvider.GetRequiredService<ExpireListings>().ExpireAsync(Ct);

        Assert.True(expired >= 1);
        Assert.Equal("expired", (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{sent.GetProperty("slug").GetString()}", Ct)).StatusCode);
        await using var check = api.CreateDbContext();
        Assert.Contains(await OutboxRows.WithAsync(check, $"listing:{id}"), m => m.SentAt == null);
        // Nothing is due any more.
        Assert.Equal(0, await scope.ServiceProvider.GetRequiredService<ExpireListings>().ExpireAsync(Ct));
    }

    [Fact]
    public async Task Many_listings_expiring_together_are_told_in_notices_the_site_takes()
    {
        // 41 listings of one business: about 90 tags, more than one notice may name (the site refuses over 64).
        var owner = await api.RegisterBusinessAsync();
        var id = Guid.Parse((await api.SubmitAsync(owner)).GetProperty("id").GetString()!);
        await api.ApproveAsync(id.ToString());
        await using var db = api.CreateDbContext();
        await db.Listings.Where(l => l.Id == id).ExecuteUpdateAsync(l => l.SetProperty(x => x.ExpiresAt, api.Clock.Now.AddSeconds(-1)), Ct);
        await CopyListingAsync(db, id, copies: 40);
        var ids = await db.Listings.Where(l => l.SellerId != null && l.OwnerUserId == owner.Id).Select(l => l.Id).ToListAsync(Ct);
        Assert.Equal(41, ids.Count);
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);

        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<ExpireListings>().ExpireAsync(Ct) >= 41);

        var rows = await db.Outbox.AsNoTracking().Where(m => m.SentAt == null).ToListAsync(Ct);
        var notices = rows.Select(m => JsonSerializer.Deserialize<RevalidatePayload>(m.Payload, ColumnMapping.StorageJson)!.Tags).ToList();
        Assert.True(notices.Count >= 2, $"{notices.Count} notices");
        Assert.All(notices, n => Assert.InRange(n.Count, 1, Revalidation.MaxTagsPerNotice));
        var told = notices.SelectMany(n => n).ToList();
        Assert.Equal(told.Count, told.Distinct().Count());
        Assert.All(ids, listing => Assert.Contains($"listing:{listing}", told));

        // The site takes every one of them (the test's site refuses more than 64 tags, as the real one does).
        var before = api.Revalidation.Sent.Count;
        var dispatcher = scope.ServiceProvider.GetRequiredService<OutboxDispatcher>();
        while (await dispatcher.DispatchAsync(Ct) > 0)
        {
        }

        var ours = rows.Select(m => m.Id).ToList();
        Assert.All(await db.Outbox.AsNoTracking().Where(m => ours.Contains(m.Id)).ToListAsync(Ct), m =>
        {
            Assert.NotNull(m.SentAt);
            Assert.Null(m.LastError);
        });
        Assert.Equal(notices.Count, api.Revalidation.Sent.Count - before);
    }

    [Fact]
    public async Task A_listing_changed_meanwhile_waits_for_the_next_run_and_the_rest_expire()
    {
        var owner = await api.RegisterAsync();
        var first = Guid.Parse((await api.SubmitAsync(owner)).GetProperty("id").GetString()!);
        var second = Guid.Parse((await api.SubmitAsync(owner)).GetProperty("id").GetString()!);
        await api.ApproveAsync(first.ToString());
        await api.ApproveAsync(second.ToString());
        await using (var setup = api.CreateDbContext())
        {
            await setup.Listings.Where(l => l.Id == first || l.Id == second).ExecuteUpdateAsync(l => l.SetProperty(x => x.ExpiresAt, api.Clock.Now.AddSeconds(-1)), Ct);
            await setup.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);
        }

        // The owner changes the second one after the job read it and before it saves.
        await using (var db = api.CreateDbContext(new ChangeRowOnFirstSave(api.ConnectionString, second)))
        {
            var expired = await new ExpireListings(db, api.Clock, NullLogger<ExpireListings>.Instance).ExpireAsync(Ct);
            Assert.True(expired >= 1);
        }

        await using var check = api.CreateDbContext();
        Assert.Equal(ListingStatus.Expired, (await check.Listings.SingleAsync(l => l.Id == first, Ct)).Status);
        Assert.Equal(ListingStatus.Active, (await check.Listings.SingleAsync(l => l.Id == second, Ct)).Status);
        var told = (await check.Outbox.AsNoTracking().Where(m => m.SentAt == null).ToListAsync(Ct)).Select(m => m.Payload).ToList();
        Assert.Contains(told, p => p.Contains($"listing:{first}", StringComparison.Ordinal));
        Assert.DoesNotContain(told, p => p.Contains($"listing:{second}", StringComparison.Ordinal));

        // The next run takes it.
        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<ExpireListings>().ExpireAsync(Ct) >= 1);
        Assert.Equal(ListingStatus.Expired, (await check.Listings.AsNoTracking().SingleAsync(l => l.Id == second, Ct)).Status);
    }

    [Fact]
    public async Task Only_one_instance_expires_at_a_time()
    {
        await using var holder = api.CreateDbContext();
        await using var transaction = await holder.Database.BeginTransactionAsync(Ct);
        await holder.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended('job:expire-listings', 0))", Ct);

        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        Assert.Null(await scope.ServiceProvider.GetRequiredService<ExpireListings>().ExpireAsync(Ct));
    }

    [Fact]
    public async Task The_outbox_sends_due_notices_and_retries_failures_with_a_growing_wait()
    {
        await using var db = api.CreateDbContext();
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);
        Revalidation.Enqueue(db, ["listing:test-1", "listings"], api.Clock.Now);
        await db.SaveChangesAsync(Ct);
        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<OutboxDispatcher>();

        api.Revalidation.Fail = true;
        try
        {
            Assert.Equal(0, await dispatcher.DispatchAsync(Ct));
            var failed = await db.Outbox.AsNoTracking().SingleAsync(m => m.SentAt == null, Ct);
            Assert.Equal(1, failed.Attempts);
            Assert.Equal(api.Clock.Now + OutboxRetry.After(1), failed.NextAttemptAt);
            Assert.Equal("site unavailable", failed.LastError);

            // Not due yet: nothing is tried.
            Assert.Equal(0, await dispatcher.DispatchAsync(Ct));
            Assert.Equal(1, (await db.Outbox.AsNoTracking().SingleAsync(m => m.SentAt == null, Ct)).Attempts);
        }
        finally
        {
            api.Revalidation.Fail = false;
        }

        api.Clock.Advance(OutboxRetry.After(1));
        var before = api.Revalidation.Sent.Count;
        Assert.Equal(1, await dispatcher.DispatchAsync(Ct));
        Assert.Equal(["listing:test-1", "listings"], api.Revalidation.Sent[before]);
        Assert.False(await db.Outbox.AnyAsync(m => m.SentAt == null, Ct));
    }

    [Fact]
    public async Task A_notice_that_keeps_failing_is_given_up()
    {
        await using var db = api.CreateDbContext();
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);
        Revalidation.Enqueue(db, ["home"], api.Clock.Now);
        await db.SaveChangesAsync(Ct);
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.Attempts, (short)(OutboxRetry.MaxAttempts - 1)), Ct);
        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();

        api.Revalidation.Fail = true;
        try
        {
            await scope.ServiceProvider.GetRequiredService<OutboxDispatcher>().DispatchAsync(Ct);
        }
        finally
        {
            api.Revalidation.Fail = false;
        }

        var given = await db.Outbox.AsNoTracking().OrderByDescending(m => m.Id).FirstAsync(Ct);
        Assert.NotNull(given.SentAt);
        Assert.StartsWith("gave up after 10 attempts", given.LastError, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_site_is_told_with_its_secret()
    {
        var handler = new RecordingHandler();
        var sender = new HttpRevalidationSender(
            new HttpClient(handler),
            Options.Create(new FrontendOptions { BaseUrl = "https://greenstore.az/" }),
            Options.Create(new RevalidationOptions { Secret = "s3cret" }));

        Assert.True(await sender.SendAsync(["listing:1", "home"], Ct));

        var request = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("https://greenstore.az/api/revalidate", request.Uri);
        Assert.Equal("Bearer s3cret", request.Authorization);
        Assert.Equal(["listing:1", "home"], JsonDocument.Parse(request.Body).RootElement.GetProperty("tags").EnumerateArray().Select(t => t.GetString()));

        handler.Status = HttpStatusCode.Unauthorized;
        await Assert.ThrowsAsync<HttpRequestException>(() => sender.SendAsync(["home"], Ct));
    }

    [Fact]
    public async Task A_notice_longer_than_the_site_takes_is_sent_in_parts()
    {
        var handler = new RecordingHandler();
        var sender = new HttpRevalidationSender(
            new HttpClient(handler),
            Options.Create(new FrontendOptions { BaseUrl = "https://greenstore.az" }),
            Options.Create(new RevalidationOptions { Secret = "s3cret" }));
        var tags = Enumerable.Range(1, 100).Select(i => $"listing:{i}").ToList();

        Assert.True(await sender.SendAsync(tags, Ct));

        var parts = handler.Requests.Select(r => JsonDocument.Parse(r.Body).RootElement.GetProperty("tags").EnumerateArray().Select(t => t.GetString()!).ToList()).ToList();
        Assert.Equal([Revalidation.MaxTagsPerNotice, 100 - Revalidation.MaxTagsPerNotice], parts.Select(p => p.Count));
        Assert.Equal(tags, parts.SelectMany(p => p));
    }

    [Fact]
    public async Task Without_a_site_or_secret_nothing_is_sent()
    {
        var handler = new RecordingHandler();
        foreach (var (site, secret) in new[] { ("", "s3cret"), ("https://greenstore.az", "") })
        {
            var sender = new HttpRevalidationSender(new HttpClient(handler), Options.Create(new FrontendOptions { BaseUrl = site }), Options.Create(new RevalidationOptions { Secret = secret }));
            Assert.False(await sender.SendAsync(["home"], Ct));
        }

        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task The_daily_cleanup_deletes_unattached_photos_and_old_rows()
    {
        var owner = await api.RegisterAsync();
        var abandoned = Guid.Parse(await api.UploadPhotoAsync(owner.Token));
        var listing = await api.SubmitAsync(owner);
        Guid attached;
        string abandonedFile;
        await using (var db = api.CreateDbContext())
        {
            attached = (await db.ListingPhotos.FirstAsync(p => p.ListingId == Guid.Parse(listing.GetProperty("id").GetString()!), Ct)).PhotoId;
            var photo = await db.Photos.SingleAsync(p => p.Id == abandoned, Ct);
            abandonedFile = photo.Variants!["640"];
            var old = api.Clock.Now.AddDays(-40);
            db.ListingSeen.Add(new ListingSeen { ListingId = Guid.NewGuid(), VisitorHash = [1, 2], Day = BakuTime.Today(old), Action = SeenAction.View });
            db.IdempotencyKeys.Add(new IdempotencyKey { Scope = "x", Key = Guid.NewGuid().ToString(), RequestHash = [1], CreatedAt = old });
            db.Outbox.Add(new OutboxMessage { Type = OutboxTypes.Revalidate, Payload = "{\"tags\":[]}", CreatedAt = old, NextAttemptAt = old, SentAt = old });
            await db.SaveChangesAsync(Ct);
        }

        await using var factory = api.Variant();
        var root = ((LocalDiskStorage)factory.Services.GetRequiredService<IFileStorage>()).RootPath;
        Assert.True(File.Exists(Path.Combine(root, abandonedFile)));
        api.Clock.Advance(TimeSpan.FromHours(25));
        await using var scope = factory.Services.CreateAsyncScope();

        var result = await scope.ServiceProvider.GetRequiredService<ListingsCleanup>().RunAsync(Ct);

        Assert.NotNull(result);
        Assert.True(result.Photos >= 1);
        Assert.True(result.Seen >= 1);
        Assert.True(result.IdempotencyKeys >= 1);
        Assert.True(result.Outbox >= 1);
        await using var check = api.CreateDbContext();
        Assert.False(await check.Photos.AnyAsync(p => p.Id == abandoned, Ct));
        Assert.True(await check.Photos.AnyAsync(p => p.Id == attached, Ct));
        Assert.False(File.Exists(Path.Combine(root, abandonedFile)));

        // The job's step runs both clean-ups and says what it did.
        Assert.NotNull(await scope.ServiceProvider.GetRequiredService<Cleanup>().RunAsync(Ct));
    }

    /// <summary>Copies a listing row <paramref name="copies"/> times (new id, number and slug; no photos).</summary>
    private static async Task CopyListingAsync(AppDbContext db, Guid id, int copies)
    {
        var sql = $$"""
            DO $$
            DECLARE columns text;
            BEGIN
              SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO columns
              FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'listings' AND is_generated = 'NEVER'
                AND column_name NOT IN ('id', 'number', 'slug');
              EXECUTE format(
                'INSERT INTO listings (id, slug, %1$s) SELECT gen_random_uuid(), slug || ''-copy-'' || g, %1$s FROM listings CROSS JOIN generate_series(1, %2$s) g WHERE id = %3$L',
                columns, {{copies}}, '{{id}}');
            END $$;
            """;
        await db.Database.ExecuteSqlRawAsync(sql, Ct);
    }

    /// <summary>
    /// Changes one listing row from another connection when the context first saves, as an owner or a moderator would
    /// between the job's read and its write (the row's <c>xmin</c> moves on).
    /// </summary>
    private sealed class ChangeRowOnFirstSave(string connectionString, Guid listingId) : SaveChangesInterceptor
    {
        private bool done;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!done)
            {
                done = true;
                await using var connection = new Npgsql.NpgsqlConnection(connectionString);
                await connection.OpenAsync(cancellationToken);
                await using var command = new Npgsql.NpgsqlCommand("UPDATE listings SET title = title || ' (yeni)' WHERE id = @id", connection);
                command.Parameters.AddWithValue("id", listingId);
                Assert.Equal(1, await command.ExecuteNonQueryAsync(cancellationToken));
            }

            return result;
        }
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<(HttpMethod Method, string Uri, string? Authorization, string Body)> Requests { get; } = [];

        public HttpStatusCode Status { get; set; } = HttpStatusCode.NoContent;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add((request.Method, request.RequestUri!.ToString(), request.Headers.Authorization?.ToString(), await request.Content!.ReadAsStringAsync(cancellationToken)));
            return new HttpResponseMessage(Status);
        }
    }
}

/// <summary>The listing lifecycle tables keep DATABASE.md §3.5, §3.6 and §3.10.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class LifecycleSchemaTests(LifecycleApi api)
{
    private const string AnyUser = "(SELECT id FROM users ORDER BY created_at, id LIMIT 1)";
    private const string AnyListing = "(SELECT id FROM listings ORDER BY number LIMIT 1)";

    [Theory]
    [InlineData("INSERT INTO listing_seen (listing_id, visitor_hash, day, action) VALUES (gen_random_uuid(), '\\x01', current_date, 'like')", "ck_listing_seen_action")]
    [InlineData("INSERT INTO idempotency_keys (scope, key, request_hash) VALUES ('s', repeat('k', 81), '\\x01')", "ck_idempotency_keys_key")]
    [InlineData($"INSERT INTO listing_revisions (listing_id, revision, data) VALUES ({AnyListing}, 99, '{{}}'); INSERT INTO moderation_decisions (id, listing_id, revision, moderator_id, decision) VALUES (gen_random_uuid(), {AnyListing}, 99, {AnyUser}, 'maybe')", "ck_moderation_decisions_decision")]
    [InlineData($"INSERT INTO listing_revisions (listing_id, revision, data) VALUES ({AnyListing}, 98, '{{}}'); INSERT INTO moderation_decisions (id, listing_id, revision, moderator_id, decision) VALUES (gen_random_uuid(), {AnyListing}, 98, {AnyUser}, 'reject')", "ck_moderation_decisions_reject_reason")]
    [InlineData($"INSERT INTO listing_revisions (listing_id, revision, data) VALUES ({AnyListing}, 97, '{{}}'); INSERT INTO moderation_decisions (id, listing_id, revision, moderator_id, decision, reason_code) VALUES (gen_random_uuid(), {AnyListing}, 97, {AnyUser}, 'reject', 'ugly')", "ck_moderation_decisions_reason_code")]
    [InlineData($"INSERT INTO listing_revisions (listing_id, revision, data) VALUES ({AnyListing}, 96, '{{}}'); INSERT INTO moderation_decisions (id, listing_id, revision, moderator_id, decision, note) VALUES (gen_random_uuid(), {AnyListing}, 96, {AnyUser}, 'approve', repeat('n', 501))", "ck_moderation_decisions_note")]
    public async Task A_row_against_the_rules_is_refused(string sql, string constraint)
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, sql);

        Assert.Equal(Npgsql.PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal(constraint, error.ConstraintName);
    }

    [Fact]
    public async Task A_decision_is_about_a_revision_that_exists()
    {
        var error = await SchemaAssert.FailAsync(
            api.ConnectionString,
            $"INSERT INTO moderation_decisions (id, listing_id, revision, moderator_id, decision) VALUES (gen_random_uuid(), {AnyListing}, 12345, {AnyUser}, 'approve')");

        Assert.Equal(Npgsql.PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal("fk_moderation_decisions_listing_revisions", error.ConstraintName);
    }

    [Fact]
    public async Task A_visitor_is_seen_once_a_day_per_action()
    {
        var error = await SchemaAssert.FailAsync(api.ConnectionString, """
            INSERT INTO listing_seen (listing_id, visitor_hash, day, action) VALUES ('019a8b4e-0000-7000-8000-000000000001', '\x01', '2026-11-22', 'view');
            INSERT INTO listing_seen (listing_id, visitor_hash, day, action) VALUES ('019a8b4e-0000-7000-8000-000000000001', '\x01', '2026-11-22', 'view');
            """);

        Assert.Equal(Npgsql.PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("pk_listing_seen", error.ConstraintName);
    }

    [Fact]
    public async Task Listing_seen_is_unlogged_and_the_rest_are_not()
    {
        await using var connection = new Npgsql.NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new Npgsql.NpgsqlCommand(
            "SELECT relname, relpersistence::text FROM pg_class WHERE relkind = 'r' AND relname IN ('listing_seen', 'listing_drafts', 'listing_revisions', 'moderation_decisions', 'listing_daily_stats', 'outbox', 'audit_log', 'idempotency_keys')",
            connection);
        var persistence = new Dictionary<string, string>();
        await using (var reader = await command.ExecuteReaderAsync(Ct))
        {
            while (await reader.ReadAsync(Ct))
            {
                persistence[reader.GetString(0)] = reader.GetString(1);
            }
        }

        Assert.Equal(8, persistence.Count);
        Assert.Equal("u", persistence["listing_seen"]);
        Assert.All(persistence.Where(p => p.Key != "listing_seen"), p => Assert.Equal("p", p.Value));
    }

    [Fact]
    public async Task Deleting_a_listing_row_removes_its_drafts_revisions_and_daily_stats()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var error = await SchemaAssert.FailAsync(api.ConnectionString, $"""
            INSERT INTO listing_drafts (id, owner_user_id, listing_id, data) VALUES (gen_random_uuid(), '{owner.Id}', '{id}', jsonb_build_object());
            INSERT INTO listing_daily_stats (listing_id, day, views) VALUES ('{id}', current_date, 3);
            DELETE FROM listing_photos WHERE listing_id = '{id}';
            DELETE FROM listings WHERE id = '{id}';
            DO $$ BEGIN
              IF EXISTS (SELECT 1 FROM listing_drafts WHERE listing_id = '{id}') OR EXISTS (SELECT 1 FROM listing_revisions WHERE listing_id = '{id}')
                 OR EXISTS (SELECT 1 FROM listing_daily_stats WHERE listing_id = '{id}') THEN RAISE EXCEPTION 'left behind'; END IF;
              RAISE EXCEPTION 'all gone' USING ERRCODE = 'P0001';
            END $$;
            """);

        Assert.Equal("all gone", error.MessageText);
    }

    [Fact]
    public async Task The_indexes_are_the_ones_of_the_design()
    {
        var indexes = new Dictionary<string, string>(StringComparer.Ordinal);
        await using (var connection = new Npgsql.NpgsqlConnection(api.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new Npgsql.NpgsqlCommand(
                "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('listing_drafts', 'listing_revisions', 'moderation_decisions', 'listing_daily_stats', 'listing_seen', 'outbox', 'audit_log', 'idempotency_keys')",
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
                ["pk_listing_drafts"] = "USING btree (id)",
                ["ix_drafts_owner"] = "USING btree (owner_user_id)",
                ["pk_listing_revisions"] = "USING btree (listing_id, revision)",
                ["pk_moderation_decisions"] = "USING btree (id)",
                ["ix_decisions_listing"] = "USING btree (listing_id, created_at DESC)",
                ["pk_listing_daily_stats"] = "USING btree (listing_id, day)",
                ["pk_listing_seen"] = "USING btree (listing_id, visitor_hash, day, action)",
                ["pk_outbox"] = "USING btree (id)",
                ["ix_outbox_due"] = "USING btree (next_attempt_at) WHERE (sent_at IS NULL)",
                ["pk_audit_log"] = "USING btree (id)",
                ["ix_audit_target"] = "USING btree (target_type, target_id, created_at DESC)",
                ["ix_audit_actor"] = "USING btree (actor_user_id, created_at DESC)",
                ["pk_idempotency_keys"] = "USING btree (scope, key)",
            }.OrderBy(i => i.Key),
            indexes.ToDictionary(i => i.Key, i => i.Value[(i.Value.IndexOf(" USING ", StringComparison.Ordinal) + 1)..]).OrderBy(i => i.Key));
    }
}

/// <summary>The outbox rows whose payload names <paramref name="text"/> (payload is jsonb: compared here, not in SQL).</summary>
internal static class OutboxRows
{
    public static async Task<List<OutboxMessage>> WithAsync(GreenStore.Api.Data.AppDbContext db, string text) =>
        (await db.Outbox.AsNoTracking().ToListAsync(Ct)).Where(m => m.Payload.Contains(text, StringComparison.Ordinal)).ToList();
}

/// <summary>Runs SQL in a transaction that is rolled back and returns the database's refusal.</summary>
internal static class SchemaAssert
{
    public static async Task<Npgsql.PostgresException> FailAsync(string connectionString, string sql)
    {
        await using var connection = new Npgsql.NpgsqlConnection(connectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection, transaction);
        Npgsql.PostgresException? refused = null;
        try
        {
            await command.ExecuteNonQueryAsync(Ct);
        }
        catch (Npgsql.PostgresException error)
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
