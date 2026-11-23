using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Listings;

/// <summary>Public reads of services: listings of kind "service" (ARCHITECTURE.md §3, §7).</summary>
public static class ServicesEndpoints
{
    public const string NotFound = "service.not-found";

    /// <summary>src/features/services/query.ts <c>SERVICES_PAGE_SIZE</c>.</summary>
    public const int DefaultPageSize = 6;

    public const int RelatedLimit = 4;

    public static RouteGroupBuilder MapServices(this RouteGroupBuilder api)
    {
        var services = api.MapGroup("/services").WithTags("Services");
        services.MapGet("", Search);
        services.MapGet("/{slug}", GetBySlug);
        services.MapGet("/{id:guid}/related", Related);
        return api;
    }

    /// <summary>
    /// <c>GET /services?q&amp;categoryId&amp;cityId&amp;providerKind&amp;minPrice&amp;maxPrice&amp;sort&amp;page&amp;pageSize</c>.
    /// <c>displayTotal</c> is the number of matches: with no filter that is the platform's total, which is what the
    /// UI shows then.
    /// </summary>
    private static async Task<Ok<ServiceSearchResultDto>> Search(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var filter = ServiceFilter.Read(query);
        var sort = ListingSortQuery.Read(query);
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var read = await ReadContext.CreateAsync(http, db, ct);
        var result = await db.Listings.AsNoTracking()
            .Public(CategoryKind.Service)
            .Filter(filter)
            .Sort(sort)
            .WithCardData()
            .ToPageAsync(page, rows => rows.Select(s => s.ToServiceDto(read)).ToList(), ct);
        return TypedResults.Ok(new ServiceSearchResultDto(result.Items, result.Total, result.Page, result.PageCount, result.Total));
    }

    /// <summary>The service page; like listings, the number at the end of the slug decides.</summary>
    private static async Task<Ok<ServiceDto>> GetBySlug(string slug, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var service = await ListingsEndpoints.FindBySlugAsync(db.Listings.AsNoTracking().Public(CategoryKind.Service), slug, ct)
            ?? throw ApiProblemException.NotFound(NotFound);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(service.ToServiceDto(read));
    }

    /// <summary>
    /// «Bu ustanın digər xidmətləri» (the same provider's) and similar services: the same service type first, then
    /// any other, newest first (src/app/(main)/xidmetler/[slug]/page.tsx).
    /// </summary>
    private static async Task<Ok<RelatedServicesDto>> Related(Guid id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var services = db.Listings.AsNoTracking().Public(CategoryKind.Service);
        var service = await services.Where(l => l.Id == id).Select(l => new { l.OwnerUserId, l.SubcategoryId }).FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(NotFound);

        var fromProvider = await services.Where(l => l.OwnerUserId == service.OwnerUserId && l.Id != id)
            .Sort(ListingSort.Newest).WithCardData().Take(RelatedLimit).ToListAsync(ct);
        var shown = fromProvider.Select(l => l.Id).Append(id).ToList();
        var similar = await services.Where(l => !shown.Contains(l.Id))
            .OrderBy(l => l.SubcategoryId != service.SubcategoryId)
            .ThenByDescending(l => l.IsPromoted)
            .ThenByDescending(l => l.SortAt)
            .ThenByDescending(l => l.Number)
            .WithCardData()
            .Take(RelatedLimit)
            .ToListAsync(ct);

        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(new RelatedServicesDto(
            fromProvider.Select(s => s.ToServiceDto(read)).ToList(),
            similar.Select(s => s.ToServiceDto(read)).ToList()));
    }
}
