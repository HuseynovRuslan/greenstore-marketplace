using System.Diagnostics.CodeAnalysis;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// The signed-in business's own profile, «mağaza» (<c>GET</c> and <c>PATCH /me/seller</c>, ARCHITECTURE.md §7): what
/// /kabinet/profil edits and /saticilar/&lt;slug&gt; shows. An individual account has none (404
/// <c>seller.not-found</c>).
/// </summary>
public static class SellerProfileEndpoints
{
    public static RouteGroupBuilder MapSellerProfile(this RouteGroupBuilder api)
    {
        var profile = api.MapGroup("/me/seller").WithTags("Me").RequireAuthorization();
        profile.MapGet("", Get);
        profile.MapPatch("", Update);
        return api;
    }

    /// <summary><c>GET /me/seller</c> → the public <c>Seller</c> plus the business's own <c>phone</c> and the <c>version</c> to send back.</summary>
    private static async Task<Ok<OwnSellerDto>> Get(CurrentUser me, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var seller = await FindAsync(db, me, tracked: false, ct);
        return TypedResults.Ok(await ToDtoAsync(db, seller, http, ct));
    }

    /// <summary>
    /// <c>PATCH /me/seller</c> → the same as <c>GET</c>. Changes show on the seller page and in the directory at once.
    /// 400 <c>validation</c>; 409 <c>concurrency-conflict</c> when <c>version</c> was sent and the profile changed since.
    /// </summary>
    private static async Task<Ok<OwnSellerDto>> Update(SellerPatch body, CurrentUser me, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var seller = await FindAsync(db, me, tracked: true, ct);
        if (body.Has(nameof(SellerPatch.Version)) && body.Version is not null)
        {
            if (!RowVersion.TryParse(body.Version, out var version))
            {
                throw ApiProblemException.Validation("version", FieldErrors.Invalid);
            }

            db.SetExpectedVersion(seller, version);
        }

        var cities = await db.Cities.Where(c => c.IsActive).Select(c => c.Id).ToListAsync(ct);
        SellerProfileRules.Apply(seller, body, cities.ToHashSet(StringComparer.Ordinal)).ThrowIfAny();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ToDtoAsync(db, seller, http, ct));
    }

    private static async Task<Seller> FindAsync(AppDbContext db, CurrentUser me, bool tracked, CancellationToken ct)
    {
        var sellers = tracked ? db.Sellers : db.Sellers.AsNoTracking();
        var seller = await sellers
            .Include(s => s.Owner).Include(s => s.LogoPhoto).Include(s => s.CoverPhoto)
            .FirstOrDefaultAsync(s => s.OwnerUserId == me.UserId, ct);
        Access.EnsureCanManage(me, seller?.OwnerUserId, SellersEndpoints.SellerNotFound);
        return seller!;
    }

    private static async Task<OwnSellerDto> ToDtoAsync(AppDbContext db, Seller seller, HttpContext http, CancellationToken ct)
    {
        var read = await ReadContext.CreateAsync(http, db, ct);
        var dto = (await SellerReads.ToDtosAsync(db, [seller], read, ct))[0];
        return new OwnSellerDto(dto) { Phone = seller.Phone, Version = RowVersion.Format(seller.Version) };
    }
}

/// <summary>
/// The owner's view of the profile: the public <c>Seller</c> with the business's own number (<c>phone</c>, when it
/// has one; else the owner's number is shown masked) and <c>version</c> for <c>PATCH</c>.
/// </summary>
public sealed record OwnSellerDto : SellerDto
{
    [SetsRequiredMembers]
    public OwnSellerDto(SellerDto seller)
        : base(seller)
    {
    }

    public string? Phone { get; init; }

    public string Version { get; init; } = string.Empty;
}
