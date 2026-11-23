using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Seçilmişlər» of the signed-in user (backend-contract.md 2.3). Keys are <c>listing:&lt;id&gt;</c> and
/// <c>service:&lt;id&gt;</c>, oldest first (the order the site adds them in). Adding and removing are idempotent; the
/// listing's <c>listing_counters.favourites</c> changes in the same transaction, only when a row really changed.
/// </summary>
public static class FavoritesEndpoints
{
    /// <summary>The most keys one merge takes (a guest's browser list).</summary>
    public const int MergeLimit = 500;

    public static RouteGroupBuilder MapFavorites(this RouteGroupBuilder api)
    {
        var favorites = api.MapGroup("/me/favorites").WithTags("Me").RequireAuthorization();
        favorites.MapGet("", List);
        favorites.MapGet("/items", Items);
        favorites.MapPut("/{kind}/{id:guid}", Add);
        favorites.MapDelete("/{kind}/{id:guid}", Remove);
        favorites.MapPost("/merge", Merge);
        return api;
    }

    /// <summary><c>GET /me/favorites</c> → <c>string[]</c>: the keys of the favourites that still exist.</summary>
    private static async Task<Ok<List<string>>> List(CurrentUser me, FavoritesService favorites, CancellationToken ct) =>
        TypedResults.Ok(await favorites.KeysAsync(me.UserId, ct));

    /// <summary>
    /// <c>GET /me/favorites/items</c> → <c>{ listings: Listing[], services: Service[] }</c>: the favourites that are
    /// public now, as cards, in the order of the keys (the «Seçilmişlər» page; a key whose listing is no longer active
    /// has no card).
    /// </summary>
    private static async Task<Ok<FavoriteItemsDto>> Items(CurrentUser me, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var rows = await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == me.UserId)
            .OrderBy(f => f.CreatedAt).ThenBy(f => f.ListingId)
            .Select(f => f.ListingId)
            .ToListAsync(ct);
        var listings = await db.Listings.AsNoTracking()
            .Where(l => rows.Contains(l.Id) && l.Status == ListingStatus.Active && l.DeletedAt == null)
            .WithCardData()
            .ToListAsync(ct);
        var order = rows.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
        var read = await ReadContext.CreateAsync(http, db, ct);
        var sorted = listings.OrderBy(l => order[l.Id]).ToList();
        return TypedResults.Ok(new FavoriteItemsDto(
            sorted.Where(l => l.Kind == CategoryKind.Product).Select(l => l.ToListingDto(read)).ToList(),
            sorted.Where(l => l.Kind == CategoryKind.Service).Select(l => l.ToServiceDto(read)).ToList()));
    }

    /// <summary>
    /// <c>PUT /me/favorites/{listing|service}/{id}</c> → 204. A new favourite must be an active listing of that kind
    /// (404 <c>listing.not-found</c> / <c>service.not-found</c> otherwise); one already saved stays saved.
    /// </summary>
    private static async Task<NoContent> Add(string kind, Guid id, CurrentUser me, FavoritesService favorites, CancellationToken ct)
    {
        var listingKind = ParseKind(kind);
        await favorites.AddAsync(me.UserId, listingKind, id, ct);
        return TypedResults.NoContent();
    }

    /// <summary><c>DELETE /me/favorites/{listing|service}/{id}</c> → 204, also when it was not a favourite.</summary>
    private static async Task<NoContent> Remove(string kind, Guid id, CurrentUser me, FavoritesService favorites, CancellationToken ct)
    {
        var listingKind = ParseKind(kind);
        await favorites.RemoveAsync(me.UserId, listingKind, id, ct);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// <c>POST /me/favorites/merge</c> <c>{ keys }</c> → <c>string[]</c>: a guest's favourites join the account's after
    /// signing in. Keys that are malformed, of another kind, or of listings that are not active are skipped.
    /// </summary>
    private static async Task<Ok<List<string>>> Merge(MergeFavoritesRequest body, CurrentUser me, FavoritesService favorites, CancellationToken ct)
    {
        if (body.Keys.Count > MergeLimit)
        {
            throw ApiProblemException.Validation("keys", "too-many");
        }

        return TypedResults.Ok(await favorites.MergeAsync(me.UserId, body.Keys, ct));
    }

    private static CategoryKind ParseKind(string kind) =>
        FavoriteKeys.TryParseKind(kind, out var listingKind) ? listingKind : throw ApiProblemException.NotFound();
}

public sealed record MergeFavoritesRequest(IReadOnlyList<string> Keys);

/// <summary>The favourites as cards: <c>Listing[]</c> and <c>Service[]</c> of src/types.</summary>
public sealed record FavoriteItemsDto(IReadOnlyList<ListingDto> Listings, IReadOnlyList<ServiceDto> Services);

/// <summary>Reads and writes of «Seçilmişlər».</summary>
public sealed class FavoritesService(AppDbContext db, TimeProvider clock)
{
    public async Task<List<string>> KeysAsync(Guid userId, CancellationToken ct)
    {
        var rows = await db.Favorites.AsNoTracking()
            .Where(f => f.UserId == userId && f.Listing!.DeletedAt == null)
            .OrderBy(f => f.CreatedAt).ThenBy(f => f.ListingId)
            .Select(f => new { f.ListingId, f.Listing!.Kind })
            .ToListAsync(ct);
        return rows.Select(r => FavoriteKeys.Format(r.Kind, r.ListingId)).ToList();
    }

    public async Task AddAsync(Guid userId, CategoryKind kind, Guid listingId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var status = await db.Listings
            .Where(l => l.Id == listingId && l.Kind == kind && l.DeletedAt == null)
            .Select(l => (ListingStatus?)l.Status)
            .FirstOrDefaultAsync(ct);
        var saved = status is not null && await db.Favorites.AnyAsync(f => f.UserId == userId && f.ListingId == listingId, ct);
        if (saved)
        {
            return;
        }

        if (status != ListingStatus.Active)
        {
            throw ApiProblemException.NotFound(kind == CategoryKind.Service ? ServicesEndpoints.NotFound : ListingsEndpoints.NotFound);
        }

        var added = await InsertAsync(userId, [listingId], ct);
        await CountAsync(added, +1, ct);
        await transaction.CommitAsync(ct);
    }

    public async Task RemoveAsync(Guid userId, CategoryKind kind, Guid listingId, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var removed = await db.Favorites
            .Where(f => f.UserId == userId && f.ListingId == listingId && f.Listing!.Kind == kind)
            .ExecuteDeleteAsync(ct);
        if (removed > 0)
        {
            await CountAsync([listingId], -1, ct);
        }

        await transaction.CommitAsync(ct);
    }

    public async Task<List<string>> MergeAsync(Guid userId, IReadOnlyList<string> keys, CancellationToken ct)
    {
        var wanted = new List<(CategoryKind Kind, Guid Id)>();
        foreach (var key in keys)
        {
            if (FavoriteKeys.TryParse(key, out var kind, out var id) && !wanted.Contains((kind, id)))
            {
                wanted.Add((kind, id));
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (wanted.Count > 0)
        {
            var ids = wanted.Select(w => w.Id).ToList();
            var live = await db.Listings
                .Where(l => ids.Contains(l.Id) && l.Status == ListingStatus.Active && l.DeletedAt == null)
                .Select(l => new { l.Id, l.Kind })
                .ToDictionaryAsync(l => l.Id, l => l.Kind, ct);
            var valid = wanted.Where(w => live.TryGetValue(w.Id, out var kind) && kind == w.Kind).Select(w => w.Id).ToList();
            var added = await InsertAsync(userId, valid, ct);
            await CountAsync(added, +1, ct);
        }

        await transaction.CommitAsync(ct);
        return await KeysAsync(userId, ct);
    }

    /// <summary>Inserts the favourites that are not there yet, in the given order; returns the ids really added.</summary>
    private async Task<List<Guid>> InsertAsync(Guid userId, IReadOnlyList<Guid> listingIds, CancellationToken ct)
    {
        if (listingIds.Count == 0)
        {
            return [];
        }

        // One microsecond apart, so the list keeps the order they were given in.
        var now = clock.GetUtcNow();
        var ids = listingIds.ToArray();
        var times = ids.Select((_, i) => now.AddTicks(i * 10)).ToArray();
        return await db.Database.SqlQuery<Guid>($"""
            INSERT INTO favorites (user_id, listing_id, created_at)
            SELECT {userId}, t.id, t.at FROM unnest({ids}, {times}) AS t(id, at)
            ON CONFLICT DO NOTHING
            RETURNING listing_id AS "Value"
            """).ToListAsync(ct);
    }

    /// <summary><c>listing_counters.favourites</c> ± 1 for each listing (never below 0; the row is created when missing).</summary>
    private async Task CountAsync(IReadOnlyCollection<Guid> listingIds, int delta, CancellationToken ct)
    {
        if (listingIds.Count == 0)
        {
            return;
        }

        var ids = listingIds.ToArray();
        await db.Database.ExecuteSqlAsync($"""
            INSERT INTO listing_counters (listing_id, favourites)
            SELECT id, greatest({delta}, 0) FROM unnest({ids}) AS t(id)
            ON CONFLICT (listing_id) DO UPDATE SET favourites = greatest(listing_counters.favourites + {delta}, 0)
            """, ct);
        if (delta > 0)
        {
            // The day's row counts favourites added that day (Baku time); a removal does not take one back.
            var day = BakuTime.Today(clock.GetUtcNow());
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO listing_daily_stats (listing_id, day, favourites)
                SELECT id, {day}, {delta} FROM unnest({ids}) AS t(id)
                ON CONFLICT (listing_id, day) DO UPDATE SET favourites = listing_daily_stats.favourites + {delta}
                """, ct);
        }
    }
}
