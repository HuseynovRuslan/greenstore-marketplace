using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// The promotion fields of the owner's listings («Elanlarım»): what runs on each (<see cref="PromotionRules.Running"/>)
/// and the choice from posting still to pay for. Two small queries for any number of listings.
/// </summary>
public static class OwnerPromotions
{
    public static async Task<IReadOnlyDictionary<Guid, OwnerPromotion>> LoadAsync(
        AppDbContext db,
        IReadOnlyCollection<Listing> listings,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var ids = listings.Select(l => l.Id).ToList();
        var rows = await (
                from p in db.ListingPromotions.AsNoTracking()
                join o in db.PromotionOrders on p.OrderId equals o.Id
                join option in db.PromotionOptions on o.OptionId equals option.Id
                where ids.Contains(p.ListingId) && p.EndsAt > now
                select new { p.ListingId, p.Kind, p.EndsAt, option.PackageId })
            .ToListAsync(ct);
        var pendingIds = listings.Select(l => l.PendingPromotionOptionId).OfType<string>().Distinct().ToList();
        var packageOf = pendingIds.Count == 0
            ? new Dictionary<string, string>()
            : await db.PromotionOptions.AsNoTracking().Where(o => pendingIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.PackageId, ct);

        var result = new Dictionary<Guid, OwnerPromotion>();
        foreach (var listing in listings)
        {
            var running = PromotionRules.Running(
                rows.Where(r => r.ListingId == listing.Id).Select(r => new PromotionRun(r.Kind, r.PackageId, r.EndsAt)),
                now);
            var pending = listing.PendingPromotionOptionId is { } optionId && packageOf.TryGetValue(optionId, out var packageId)
                ? new PendingPromotionDto(packageId, optionId)
                : null;
            if (running is not null || pending is not null)
            {
                result[listing.Id] = new OwnerPromotion(running is null ? null : new ListingPromotionDto(running.PackageId, running.EndsAt), pending);
            }
        }

        return result;
    }
}
