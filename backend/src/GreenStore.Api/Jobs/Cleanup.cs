using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Media;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Jobs;

/// <summary>How long the listing side keeps its data (DATABASE.md §5).</summary>
public static class Retention
{
    /// <summary><c>listing_seen</c>: a repeat view is a repeat only on the same day.</summary>
    public const int SeenDays = 2;

    /// <summary><c>listing_daily_stats</c>: 13 months (the totals stay in <c>listing_counters</c>).</summary>
    public const int DailyStatsMonths = 13;

    public static readonly TimeSpan IdempotencyKeys = TimeSpan.FromHours(24);

    public static readonly TimeSpan SentOutbox = TimeSpan.FromDays(30);

    /// <summary><c>audit_log</c> and <c>moderation_decisions</c>.</summary>
    public static readonly TimeSpan Decisions = TimeSpan.FromDays(730);

    /// <summary>
    /// <c>payment_events</c> whose signature was wrong: anyone can post them, so they are kept for a while to look into
    /// and then deleted. Signed events are payment records and stay (DATABASE.md §5).
    /// </summary>
    public static readonly TimeSpan UnsignedPaymentEvents = TimeSpan.FromDays(30);
}

public sealed record ListingsCleanupResult(int Photos, int Seen, int IdempotencyKeys, int Outbox, int DailyStats, int Audit, int Decisions, int UnsignedPaymentEvents);

/// <summary>
/// The daily clean-up of the listing side: photos nobody attached within a day (files and rows), and the rows
/// <see cref="Retention"/> no longer keeps (payment callbacks with a wrong signature included).
/// </summary>
public sealed class ListingsCleanup(AppDbContext db, PhotoService photos, TimeProvider clock)
{
    private const string LockKey = "cleanup:listings";

    /// <summary>What was deleted; null when another instance is running it.</summary>
    public async Task<ListingsCleanupResult?> RunAsync(CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await db.TryAdvisoryLockAsync(LockKey, ct))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var today = BakuTime.Today(now);
        var seenBefore = today.AddDays(-Retention.SeenDays);
        var statsBefore = today.AddMonths(-Retention.DailyStatsMonths);
        var keysBefore = now - Retention.IdempotencyKeys;
        var outboxBefore = now - Retention.SentOutbox;
        var decisionsBefore = now - Retention.Decisions;
        var unsignedBefore = now - Retention.UnsignedPaymentEvents;

        var deletedPhotos = await photos.DeleteUnattachedAsync(ct);
        var seen = await db.ListingSeen.Where(s => s.Day < seenBefore).ExecuteDeleteAsync(ct);
        var keys = await db.IdempotencyKeys.Where(k => k.CreatedAt < keysBefore).ExecuteDeleteAsync(ct);
        var outbox = await db.Outbox.Where(m => m.SentAt < outboxBefore).ExecuteDeleteAsync(ct);
        var stats = await db.ListingDailyStats.Where(s => s.Day < statsBefore).ExecuteDeleteAsync(ct);
        var audit = await db.AuditLog.Where(a => a.CreatedAt < decisionsBefore).ExecuteDeleteAsync(ct);
        var decisions = await db.ModerationDecisions.Where(d => d.CreatedAt < decisionsBefore).ExecuteDeleteAsync(ct);
        var unsigned = await db.PaymentEvents.Where(e => !e.SignatureOk && e.ReceivedAt < unsignedBefore).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);
        return new ListingsCleanupResult(deletedPhotos, seen, keys, outbox, stats, audit, decisions, unsigned);
    }
}

/// <summary>Both clean-ups, once a day (ARCHITECTURE.md §12 <c>Cleanup</c>).</summary>
public sealed class Cleanup(AccountsCleanup accounts, ListingsCleanup listings) : IJobStep
{
    public async Task<string?> RunAsync(CancellationToken ct)
    {
        var a = await accounts.RunAsync(ct);
        var l = await listings.RunAsync(ct);
        if (a is null && l is null)
        {
            return null;
        }

        return $"deleted {a?.OtpChallenges ?? 0} SMS codes, {a?.Sessions ?? 0} ended sessions, {l?.Photos ?? 0} unattached photos, "
            + $"{l?.Seen ?? 0} seen rows, {l?.IdempotencyKeys ?? 0} idempotency keys, {l?.Outbox ?? 0} sent messages, "
            + $"{l?.DailyStats ?? 0} old daily stats, {l?.Audit ?? 0} audit entries, {l?.Decisions ?? 0} decisions, "
            + $"{l?.UnsignedPaymentEvents ?? 0} unsigned payment callbacks";
    }
}

public static class JobsSetup
{
    public static IServiceCollection AddJobs(this IServiceCollection services)
    {
        services.AddOptions<JobsOptions>()
            .BindConfiguration(JobsOptions.Section)
            .Validate(o => o.FirstRunDelaySeconds >= 0 && o.ExpireListingsSeconds > 0 && o.OutboxSeconds > 0 && o.PromotionsSeconds > 0, "Jobs: the intervals must be positive.")
            .ValidateOnStart();
        services.AddOptions<CleanupOptions>()
            .BindConfiguration(CleanupOptions.Section)
            .Validate(o => o.FirstRunDelaySeconds >= 0, "Cleanup:FirstRunDelaySeconds must not be negative.")
            .ValidateOnStart();

        services.AddScoped<ExpireListings>();
        services.AddScoped<Promotions>();
        services.AddScoped<OutboxDispatcher>();
        services.AddScoped<ListingsCleanup>();
        services.AddScoped<Cleanup>();
        // The outbox logs a failed notice itself, in one line; the client's own request logging would add a stack trace
        // per retry while the site is down.
        services.AddHttpClient<IRevalidationSender, HttpRevalidationSender>((sp, http) =>
                http.Timeout = TimeSpan.FromSeconds(Math.Max(1, sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<RevalidationOptions>>().Value.TimeoutSeconds)))
            .RemoveAllLoggers();

        services.AddHostedService<ExpireListingsJob>();
        services.AddHostedService<PromotionsJob>();
        services.AddHostedService<OutboxJob>();
        services.AddHostedService<CleanupJob>();
        return services;
    }
}
