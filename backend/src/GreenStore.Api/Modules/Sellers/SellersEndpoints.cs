using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>Seller pages, the sellers directory and service providers (ARCHITECTURE.md §7).</summary>
public static class SellersEndpoints
{
    public const string SellerNotFound = "seller.not-found";
    public const string ProviderNotFound = "provider.not-found";

    public const int DefaultPageSize = 24;

    public static RouteGroupBuilder MapSellers(this RouteGroupBuilder api)
    {
        var sellers = api.MapGroup("/sellers").WithTags("Sellers");
        sellers.MapGet("", List);
        sellers.MapGet("/{slug}", GetBySlug);
        sellers.MapGet("/by-id/{id:guid}", GetById);

        var providers = api.MapGroup("/providers").WithTags("Sellers");
        providers.MapGet("/{id:guid}", GetProvider);
        providers.MapGet("/{id:guid}/services", ListProviderServices);
        return api;
    }

    /// <summary>
    /// <c>GET /sellers?businessKind&amp;cityId&amp;page&amp;pageSize</c>: the directory, one page (backend-contract.md
    /// 1.1), verified businesses first, then by name in Azerbaijani alphabetical order.
    /// </summary>
    private static async Task<Ok<PageResult<SellerDto>>> List(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var businessKind = query.Enum<BusinessKind>("businessKind");
        var cityId = query.String("cityId");
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var sellers = db.Sellers.AsNoTracking();
        if (businessKind is { } kind)
        {
            // A business with several kinds is listed under each: `'nursery' = ANY (business_kinds)` in SQL.
            var code = KebabCase.Value(kind);
            sellers = sellers.Where(s => s.BusinessKinds.Contains(code));
        }

        if (cityId is not null)
        {
            sellers = sellers.Where(s => s.CityId == cityId);
        }

        var read = await ReadContext.CreateAsync(http, db, ct);
        var ordered = sellers
            .OrderBy(s => s.VerifiedAt == null)
            .ThenBy(s => EF.Functions.Collate(s.Name, SellerReads.AzerbaijaniCollation))
            .ThenBy(s => s.Slug)
            .Include(s => s.Owner)
            .Include(s => s.LogoPhoto)
            .Include(s => s.CoverPhoto);

        var total = await ordered.CountAsync(ct);
        var current = page.Clamp(total);
        var rows = await ordered.Skip((current - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        var items = await SellerReads.ToDtosAsync(db, rows, read, ct);
        return TypedResults.Ok(new PageResult<SellerDto>(items, total, current, page.PageCount(total)));
    }

    private static async Task<Ok<SellerDto>> GetBySlug(string slug, HttpContext http, AppDbContext db, CancellationToken ct) =>
        await GetAsync(db.Sellers.Where(s => s.Slug == slug), http, db, ct);

    private static async Task<Ok<SellerDto>> GetById(Guid id, HttpContext http, AppDbContext db, CancellationToken ct) =>
        await GetAsync(db.Sellers.Where(s => s.Id == id), http, db, ct);

    private static async Task<Ok<SellerDto>> GetAsync(IQueryable<Seller> match, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var seller = await match.AsNoTracking()
            .Include(s => s.Owner).Include(s => s.LogoPhoto).Include(s => s.CoverPhoto)
            .FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(SellerNotFound);
        var read = await ReadContext.CreateAsync(http, db, ct);
        var dtos = await SellerReads.ToDtosAsync(db, [seller], read, ct);
        return TypedResults.Ok(dtos[0]);
    }

    /// <summary>
    /// <c>GET /providers/{id}</c>: whoever publishes services, by account id. Only accounts with at least one active
    /// service are providers; anyone else is a 404, so the endpoint cannot be used to look accounts up.
    /// </summary>
    private static async Task<Ok<ServiceProviderDto>> GetProvider(Guid id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var provides = await db.Listings.Public(CategoryKind.Service).AnyAsync(l => l.OwnerUserId == id, ct);
        var owner = provides ? await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) : null;
        if (owner is null)
        {
            throw ApiProblemException.NotFound(ProviderNotFound);
        }

        var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.OwnerUserId == id, ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(SellerMapping.ToProviderDto(owner, seller, read));
    }

    /// <summary>
    /// <c>GET /providers/{id}/services</c>: the provider's active services, newest first (none for an unknown id).
    /// <c>id</c> is the provider's account id (<c>Service.providerId</c>) or, for a business, its seller id: the seller
    /// page lists the business's services by the id it has (<c>listProviderServices(seller.id)</c>, as in the mock,
    /// where a business provider's id is its seller id). Ids are UUIDs, so the two never collide.
    /// </summary>
    private static async Task<Ok<List<ServiceDto>>> ListProviderServices(Guid id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var services = await db.Listings.AsNoTracking().Public(CategoryKind.Service)
            .Where(l => l.OwnerUserId == id || l.SellerId == id)
            .Sort(ListingSort.Newest)
            .WithCardData()
            .ToListAsync(ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(services.Select(s => s.ToServiceDto(read)).ToList());
    }
}

/// <summary>Seller reads shared with the home page.</summary>
public static class SellerReads
{
    /// <summary>ICU collation that sorts ç, ə, ğ, ı, ö, ş, ü where the Azerbaijani alphabet has them (DATABASE.md §2).</summary>
    public const string AzerbaijaniCollation = "az-x-icu";

    /// <summary>The DTOs, with each seller's active product listings counted and its active services listed.</summary>
    public static async Task<IReadOnlyList<SellerDto>> ToDtosAsync(AppDbContext db, IReadOnlyList<Seller> sellers, ReadContext read, CancellationToken ct)
    {
        var ids = sellers.Select(s => s.Id).ToList();
        var counts = await db.Listings.Public(CategoryKind.Product)
            .Where(l => l.SellerId != null && ids.Contains(l.SellerId.Value))
            .GroupBy(l => l.SellerId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var services = await db.Listings.Public(CategoryKind.Service)
            .Where(l => l.SellerId != null && ids.Contains(l.SellerId.Value))
            .Sort(ListingSort.Newest)
            .Select(l => new { SellerId = l.SellerId!.Value, l.Id })
            .ToListAsync(ct);

        return sellers
            .Select(s => s.ToSellerDto(
                new SellerStats(counts.GetValueOrDefault(s.Id), services.Where(x => x.SellerId == s.Id).Select(x => x.Id).ToList()),
                read))
            .ToList();
    }

    /// <summary>«Etibar etdiyiniz satıcılar»: verified businesses with the most active product listings.</summary>
    public static async Task<IReadOnlyList<SellerDto>> FeaturedAsync(AppDbContext db, int count, ReadContext read, CancellationToken ct)
    {
        var featured = await db.Sellers.AsNoTracking()
            .Where(s => s.VerifiedAt != null)
            .OrderByDescending(s => db.Listings.Count(l =>
                l.SellerId == s.Id && l.Kind == CategoryKind.Product && l.Status == ListingStatus.Active && l.DeletedAt == null))
            .ThenBy(s => s.CreatedAt)
            .ThenBy(s => s.Slug)
            .Include(s => s.Owner).Include(s => s.LogoPhoto).Include(s => s.CoverPhoto)
            .Take(count)
            .ToListAsync(ct);
        return await ToDtosAsync(db, featured, read, ct);
    }
}
