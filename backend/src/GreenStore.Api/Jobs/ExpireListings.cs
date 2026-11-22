using System.Globalization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Jobs;

/// <summary>
/// Ends the term of active listings whose <c>expires_at</c> has passed (ARCHITECTURE.md §12, every 10 minutes): they
/// become <c>expired</c> («Müddəti bitib», «Yenilə» brings them back) and the site is told to refresh their pages.
/// A listing its owner or a moderator changes at the same moment is left to the next run; the rest expire now.
/// </summary>
public sealed class ExpireListings(AppDbContext db, TimeProvider clock, ILogger<ExpireListings> logger) : IJobStep
{
    private const string LockKey = "job:expire-listings";

    /// <summary>Listings per run; a backlog is worked off over the next runs.</summary>
    public const int BatchSize = 500;

    /// <summary>Saves tried in one run when listings change meanwhile; each try leaves the changed ones out.</summary>
    public const int MaxSaveAttempts = 5;

    public async Task<string?> RunAsync(CancellationToken ct)
    {
        var expired = await ExpireAsync(ct);
        return expired is > 0 ? string.Create(CultureInfo.InvariantCulture, $"{expired} listings expired") : null;
    }

    /// <summary>How many expired; null when another instance holds the job.</summary>
    public async Task<int?> ExpireAsync(CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await db.TryAdvisoryLockAsync(LockKey, ct))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var due = await db.Listings
            .Include(l => l.Seller)
            .Where(l => l.Status == ListingStatus.Active && l.DeletedAt == null && l.ExpiresAt <= now)
            .OrderBy(l => l.ExpiresAt)
            .Take(BatchSize)
            .ToListAsync(ct);
        if (due.Count == 0)
        {
            return 0;
        }

        foreach (var listing in due)
        {
            ListingLifecycle.Apply(LifecycleState.Of(listing), ListingAction.Expire, now).ApplyTo(listing);
        }

        for (var attempt = 1; ; attempt++)
        {
            Revalidation.Enqueue(db, due.SelectMany(l => Revalidation.TagsFor(l, l.Seller?.Slug)), now);
            try
            {
                await db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateConcurrencyException conflict) when (attempt < MaxSaveAttempts)
            {
                // An owner or a moderator changed some of them meanwhile. The save was rolled back to its savepoint:
                // those are left to the next run, which looks at them again, and the rest are saved without them.
                var changed = conflict.Entries.Select(e => e.Entity).OfType<Listing>().ToHashSet();
                if (changed.Count == 0)
                {
                    throw;
                }

                foreach (var listing in changed)
                {
                    db.Entry(listing).State = EntityState.Detached;
                }

                foreach (var notice in db.ChangeTracker.Entries<OutboxMessage>().Where(e => e.State == EntityState.Added).ToList())
                {
                    notice.State = EntityState.Detached;
                }

                due.RemoveAll(changed.Contains);
                logger.LogInformation("Expiring listings: {Count} changed meanwhile and wait for the next run", changed.Count);
                if (due.Count == 0)
                {
                    return 0;
                }
            }
            catch (DbUpdateConcurrencyException)
            {
                logger.LogInformation("Expiring listings met concurrent changes {Attempts} times; retrying on the next run", attempt);
                return 0;
            }
        }

        await transaction.CommitAsync(ct);
        return due.Count;
    }
}
