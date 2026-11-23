using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary>
/// Builds <c>listings.search_text</c> again for the listings of a category or sub-category whose name changed
/// (DATABASE.md §4): the names are in the text in all three languages, so «розы» finds a renamed category's listings
/// only after this. Runs in the admin's request, in batches of one SQL statement each: a category has at most a few
/// thousand listings (ARCHITECTURE.md §13), and the admin then sees the search right at once.
/// </summary>
public static class SearchTextRebuilder
{
    public const int BatchSize = 500;

    /// <summary>The listings (not deleted) of <paramref name="categoryId"/>, as a category or as a sub-category; returns how many.</summary>
    public static async Task<int> RebuildAsync(AppDbContext db, string categoryId, CancellationToken ct)
    {
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var done = 0;
        long after = 0;
        while (true)
        {
            var batch = await db.Listings.AsNoTracking()
                .Where(l => (l.CategoryId == categoryId || l.SubcategoryId == categoryId) && l.DeletedAt == null && l.Number > after)
                .OrderBy(l => l.Number)
                .Take(BatchSize)
                .Include(l => l.Seller)
                .Include(l => l.Owner)
                .ToListAsync(ct);
            if (batch.Count == 0)
            {
                return done;
            }

            var ids = batch.Select(l => l.Id).ToArray();
            var texts = batch.Select(l => ListingSearchText.For(l, taxonomy, l.Seller?.Name ?? l.Owner?.FullName)).ToArray();
            await db.Database.ExecuteSqlAsync(
                $"UPDATE listings AS l SET search_text = v.search_text FROM unnest({ids}, {texts}) AS v(id, search_text) WHERE l.id = v.id",
                ct);
            done += batch.Count;
            after = batch[^1].Number;
        }
    }
}
