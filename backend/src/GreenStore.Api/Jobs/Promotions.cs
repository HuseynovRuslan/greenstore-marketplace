using System.Globalization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Promotion;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Jobs;

/// <summary>What one run of <see cref="Promotions"/> did.</summary>
public sealed record PromotionsRun(int FeaturesEnded, int ListingsBumped);

/// <summary>
/// The paid promotions over time (ARCHITECTURE.md §12, every 10 minutes): an «Önə çıxar» whose last paid day is over
/// takes the «Önə çıxan» badge off its listing, and «İrəli çək» lifts its listing again when the next lift is due
/// (<c>bumped_at</c> and <c>sort_at</c> = now, one lift less). A listing off the site keeps its lifts until it is back.
/// The rows are locked with <c>FOR UPDATE SKIP LOCKED</c>, so an owner's or a moderator's change at the same moment is
/// left to the next run; the site is told to refresh the pages that changed.
/// </summary>
public sealed class Promotions(AppDbContext db, TimeProvider clock) : IJobStep
{
    private const string LockKey = "job:promotions";

    /// <summary>Listings ended and lifts done per run; a backlog is worked off over the next runs.</summary>
    public const int BatchSize = 500;

    public async Task<string?> RunAsync(CancellationToken ct)
    {
        var run = await RunOnceAsync(ct);
        return run is { FeaturesEnded: > 0 } or { ListingsBumped: > 0 }
            ? string.Create(CultureInfo.InvariantCulture, $"{run.FeaturesEnded} promotions ended, {run.ListingsBumped} listings lifted")
            : null;
    }

    /// <summary>What it did; null when another instance holds the job.</summary>
    public async Task<PromotionsRun?> RunOnceAsync(CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await db.TryAdvisoryLockAsync(LockKey, ct))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var changed = new Dictionary<Guid, Listing>();

        // «Önə çıxar» over. A listing promoted without an end (the demo data) is not touched.
        var overIds = await db.Database.SqlQuery<Guid>($"""
            SELECT id AS "Value" FROM listings
            WHERE is_promoted AND promoted_until <= {now}
            ORDER BY promoted_until
            LIMIT {BatchSize}
            FOR UPDATE SKIP LOCKED
            """).ToListAsync(ct);
        var over = await db.Listings.Include(l => l.Seller).Where(l => overIds.Contains(l.Id)).ToListAsync(ct);
        foreach (var listing in over.Where(l => PromotionRules.FeatureOver(l.IsPromoted, l.PromotedUntil, now)))
        {
            listing.IsPromoted = false;
            listing.PromotedAt = null;
            changed[listing.Id] = listing;
        }

        // «İrəli çək» lifts due, of listings on the site.
        var dueIds = await db.Database.SqlQuery<Guid>($"""
            SELECT p.id AS "Value" FROM listing_promotions p
            JOIN listings l ON l.id = p.listing_id
            WHERE p.bumps_left > 0 AND p.next_bump_at <= {now} AND l.status = 'active' AND l.deleted_at IS NULL
            ORDER BY p.next_bump_at
            LIMIT {BatchSize}
            FOR UPDATE OF p, l SKIP LOCKED
            """).ToListAsync(ct);
        var due = await db.ListingPromotions.Include(p => p.Order!).ThenInclude(o => o.Option).Where(p => dueIds.Contains(p.Id)).ToListAsync(ct);
        var bumpedListingIds = due.Select(p => p.ListingId).Distinct().ToList();
        var toBump = await db.Listings.Include(l => l.Seller).Where(l => bumpedListingIds.Contains(l.Id)).ToListAsync(ct);
        var bumped = 0;
        foreach (var listing in toBump)
        {
            var onSite = listing.Status == ListingStatus.Active && listing.DeletedAt is null;
            var rows = due.Where(p => p.ListingId == listing.Id && PromotionRules.BumpDue(p.BumpsLeft, p.NextBumpAt, onSite, now)).ToList();
            if (rows.Count == 0)
            {
                continue;
            }

            listing.BumpedAt = now;
            listing.SortAt = now;
            changed[listing.Id] = listing;
            bumped++;
            foreach (var row in rows)
            {
                var option = row.Order!.Option!;
                (row.BumpsLeft, row.NextBumpAt) = PromotionRules.AfterBump(row.BumpsLeft, PromotionRules.BumpInterval(option.Days, option.Bumps), now);
            }
        }

        if (changed.Count == 0)
        {
            return new PromotionsRun(0, 0);
        }

        var visible = changed.Values.Where(l => l.Status == ListingStatus.Active && l.DeletedAt is null);
        Revalidation.Enqueue(db, visible.SelectMany(l => Revalidation.TagsFor(l, l.Seller?.Slug)), now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new PromotionsRun(over.Count(l => !l.IsPromoted), bumped);
    }
}
