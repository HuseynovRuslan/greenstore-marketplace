using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Sellers;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The buyer's side of the counters (DATABASE.md §3.6) and «Nömrəni göstər» (backend-contract.md 3.1): a listing
/// page reports its view, and the number is given only here, limited per IP. A visitor's view and reveal count once a
/// day (<c>listing_seen</c>); the owner's own do not count.
/// </summary>
public static class ListingCountersEndpoints
{
    public static RouteGroupBuilder MapListingCounters(this RouteGroupBuilder api)
    {
        api.MapPost("/listings/{id:guid}/views", View).WithTags("Listings").RequireRateLimiting(RateLimitPolicies.Views);
        api.MapPost("/listings/{id:guid}/phone-reveals", RevealListing).WithTags("Listings").RequireRateLimiting(RateLimitPolicies.PhoneReveals);
        api.MapPost("/sellers/{id:guid}/phone-reveals", RevealSeller).WithTags("Sellers").RequireRateLimiting(RateLimitPolicies.PhoneReveals);
        return api;
    }

    /// <summary><c>POST /listings/{id}/views</c> → 204. Counts a view of a public listing or service; 404 otherwise.</summary>
    private static async Task<NoContent> View(Guid id, HttpContext http, AppDbContext db, ServerHash hash, TimeProvider clock, CancellationToken ct)
    {
        var owner = await PublicOwnerAsync(db, id, ct);
        if (CurrentUser.Of(http)?.UserId != owner)
        {
            await CountAsync(db, id, Visitor(http, hash), SeenAction.View, clock.GetUtcNow(), ct);
        }

        return TypedResults.NoContent();
    }

    /// <summary>
    /// <c>POST /listings/{id}/phone-reveals</c> → <c>{ phone?, whatsappUrl? }</c> for a public listing or service (404
    /// otherwise). <c>phone</c> is E.164; a number the seller hid comes back as the WhatsApp link only.
    /// </summary>
    private static async Task<Ok<ContactRevealDto>> RevealListing(Guid id, HttpContext http, AppDbContext db, ServerHash hash, TimeProvider clock, CancellationToken ct)
    {
        var listing = await db.Listings.AsNoTracking()
            .Where(l => l.Id == id && l.Status == ListingStatus.Active && l.DeletedAt == null)
            .Select(l => new { l.OwnerUserId, l.ContactPhone, l.Whatsapp, l.PhoneHidden })
            .FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(ListingErrors.NotFound);
        if (CurrentUser.Of(http)?.UserId != listing.OwnerUserId)
        {
            await CountAsync(db, id, Visitor(http, hash), SeenAction.Reveal, clock.GetUtcNow(), ct);
        }

        return TypedResults.Ok(ContactRevealDto.Of(listing.ContactPhone, listing.Whatsapp, listing.PhoneHidden));
    }

    /// <summary>
    /// <c>POST /sellers/{id}/phone-reveals</c> → <c>{ phone?, whatsappUrl? }</c>: the business's number, else its
    /// owner's. Not counted (there is no seller counter, DATABASE.md §3.6), but limited like the listings'. A blocked
    /// or deleted owner's business gives no number (404). A new business without listings yet still does: its page
    /// is public from the start.
    /// </summary>
    private static async Task<Ok<ContactRevealDto>> RevealSeller(Guid id, AppDbContext db, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking()
            .Where(s => s.Id == id && s.Owner!.Status == UserStatus.Active)
            .Select(s => new { s.Phone, OwnerPhone = s.Owner!.Phone, s.Whatsapp })
            .FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(SellersEndpoints.SellerNotFound);
        return TypedResults.Ok(ContactRevealDto.Of(seller.Phone ?? seller.OwnerPhone, seller.Whatsapp, hidden: false));
    }

    private static async Task<Guid> PublicOwnerAsync(AppDbContext db, Guid id, CancellationToken ct) =>
        await db.Listings
            .Where(l => l.Id == id && l.Status == ListingStatus.Active && l.DeletedAt == null)
            .Select(l => (Guid?)l.OwnerUserId)
            .FirstOrDefaultAsync(ct)
        ?? throw ApiProblemException.NotFound(ListingErrors.NotFound);

    private static byte[] Visitor(HttpContext http, ServerHash hash) =>
        hash.Visitor(CurrentUser.Of(http)?.SessionId, http.GetClientIp().Address, http.Request.Headers.UserAgent);

    /// <summary>
    /// One statement (DATABASE.md §3.6): the visitor's first time today goes into <c>listing_seen</c>, and only then the
    /// total and today's row grow by one. True when it counted.
    /// </summary>
    public static async Task<bool> CountAsync(AppDbContext db, Guid listingId, byte[] visitor, SeenAction action, DateTimeOffset now, CancellationToken ct)
    {
        var day = BakuTime.Today(now);
        var kind = KebabCase.Value(action);
        var counted = action == SeenAction.View
            ? await db.Database.ExecuteSqlAsync($"""
                WITH first AS (
                  INSERT INTO listing_seen (listing_id, visitor_hash, day, action) VALUES ({listingId}, {visitor}, {day}, {kind})
                  ON CONFLICT DO NOTHING RETURNING listing_id
                ), total AS (
                  INSERT INTO listing_counters (listing_id, views) SELECT listing_id, 1 FROM first
                  ON CONFLICT (listing_id) DO UPDATE SET views = listing_counters.views + 1
                )
                INSERT INTO listing_daily_stats (listing_id, day, views) SELECT listing_id, {day}, 1 FROM first
                ON CONFLICT (listing_id, day) DO UPDATE SET views = listing_daily_stats.views + 1
                """, ct)
            : await db.Database.ExecuteSqlAsync($"""
                WITH first AS (
                  INSERT INTO listing_seen (listing_id, visitor_hash, day, action) VALUES ({listingId}, {visitor}, {day}, {kind})
                  ON CONFLICT DO NOTHING RETURNING listing_id
                ), total AS (
                  INSERT INTO listing_counters (listing_id, phone_reveals) SELECT listing_id, 1 FROM first
                  ON CONFLICT (listing_id) DO UPDATE SET phone_reveals = listing_counters.phone_reveals + 1
                )
                INSERT INTO listing_daily_stats (listing_id, day, phone_reveals) SELECT listing_id, {day}, 1 FROM first
                ON CONFLICT (listing_id, day) DO UPDATE SET phone_reveals = listing_daily_stats.phone_reveals + 1
                """, ct);
        return counted > 0;
    }
}

/// <summary><c>ContactReveal</c> of src/types: the number (E.164) and a WhatsApp chat link when it takes messages.</summary>
public sealed record ContactRevealDto(string? Phone = null, string? WhatsappUrl = null)
{
    public static ContactRevealDto Of(string? phone, bool whatsapp, bool hidden)
    {
        if (string.IsNullOrEmpty(phone))
        {
            return new ContactRevealDto();
        }

        return new ContactRevealDto(hidden ? null : phone, whatsapp ? $"https://wa.me/{phone.TrimStart('+')}" : null);
    }
}
