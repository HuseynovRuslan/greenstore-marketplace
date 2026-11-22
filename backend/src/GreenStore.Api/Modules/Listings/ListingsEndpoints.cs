using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Listings;

/// <summary>Public reads of product listings (ARCHITECTURE.md §7): home, catalogue, filter counts, listing page.</summary>
public static class ListingsEndpoints
{
    public const string NotFound = "listing.not-found";

    /// <summary>Catalogue page size when the request names none (src/seo/catalog.ts <c>CATALOG_PAGE_SIZE</c>).</summary>
    public const int DefaultPageSize = 24;

    /// <summary>«Satıcının digər elanları» and «Oxşar elanlar»: four cards each (src/features/listing/detail.ts).</summary>
    public const int RelatedLimit = 4;

    public static RouteGroupBuilder MapListings(this RouteGroupBuilder api)
    {
        api.MapGet("/home", GetHome).WithTags("Listings");

        var listings = api.MapGroup("/listings").WithTags("Listings");
        listings.MapGet("", Search);
        listings.MapGet("/facets", Facets);
        listings.MapGet("/count", Count);
        listings.MapGet("/{slug}", GetBySlug);
        listings.MapGet("/{id:guid}/related", Related);
        return api;
    }

    /// <summary>
    /// The home page (<c>HomeContent</c>): the newest «Önə çıxan» listings, the newest other listings, the verified
    /// businesses with most listings and the newest services.
    /// </summary>
    private static async Task<Ok<HomeContentDto>> GetHome(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var read = await ReadContext.CreateAsync(http, db, ct);
        var products = db.Listings.AsNoTracking().Public(CategoryKind.Product);

        var promoted = await products.Where(l => l.IsPromoted).Sort(ListingSort.Newest).WithCardData().Take(HomeContentDto.PromotedCount).ToListAsync(ct);
        var shown = promoted.Select(l => l.Id).ToList();
        var latest = await products.Where(l => !shown.Contains(l.Id)).Sort(ListingSort.Newest).WithCardData().Take(HomeContentDto.LatestCount).ToListAsync(ct);
        var sellers = await SellerReads.FeaturedAsync(db, HomeContentDto.SellerCount, read, ct);
        var services = await db.Listings.AsNoTracking().Public(CategoryKind.Service)
            .Sort(ListingSort.Newest).WithCardData().Take(HomeContentDto.ServiceCount).ToListAsync(ct);

        return TypedResults.Ok(new HomeContentDto(
            promoted.Select(l => l.ToListingDto(read)).ToList(),
            latest.Select(l => l.ToListingDto(read)).ToList(),
            sellers,
            services.Select(s => s.ToServiceDto(read)).Select(s => new HomeServiceDto(s, s.Cover)).ToList()));
    }

    /// <summary><c>GET /listings?q&amp;categoryId&amp;…&amp;sort&amp;page&amp;pageSize</c>: one page of the catalogue.</summary>
    private static async Task<Ok<PageResult<ListingDto>>> Search(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var filter = ListingFilter.Read(query);
        var sort = ListingSortQuery.Read(query);
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var read = await ReadContext.CreateAsync(http, db, ct);
        var result = await db.Listings.AsNoTracking()
            .Public(CategoryKind.Product)
            .Filter(filter)
            .Sort(sort)
            .WithCardData()
            .ToPageAsync(page, rows => rows.Select(l => l.ToListingDto(read)).ToList(), ct);
        return TypedResults.Ok(result);
    }

    /// <summary>
    /// The counts next to the catalogue's categories, sub-categories and cities (src/features/search/facets.ts): each
    /// one is the number of listings the current filters would find with that option chosen instead. Choosing a
    /// category clears the sub-category and keeps «Kök sistemi» only where the category has that filter
    /// (<c>selectCategory</c> in searchUrl.ts).
    /// </summary>
    private static async Task<Ok<FacetCountsDto>> Facets(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var filter = ListingFilter.Read(query);
        query.ThrowIfInvalid();

        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var products = db.Listings.AsNoTracking().Public(CategoryKind.Product);

        var anyCategory = products.Filter(filter, FilterPart.Category | FilterPart.RootSystem);
        var withRoot = filter.RootSystem is { } root ? anyCategory.Where(l => l.RootSystem == root) : anyCategory;
        var all = await anyCategory.CountAsync(ct);
        var byCategory = await CountByAsync(anyCategory, l => l.CategoryId, ct);
        var byCategoryWithRoot = filter.RootSystem is null ? byCategory : await CountByAsync(withRoot, l => l.CategoryId, ct);
        var bySubcategory = await CountByAsync(anyCategory.Where(l => l.SubcategoryId != null), l => l.SubcategoryId!, ct);
        var bySubcategoryWithRoot = filter.RootSystem is null
            ? bySubcategory
            : await CountByAsync(withRoot.Where(l => l.SubcategoryId != null), l => l.SubcategoryId!, ct);

        var anyCity = products.Filter(filter, FilterPart.Cities);
        var cityAll = await anyCity.CountAsync(ct);
        var byCity = await CountByAsync(anyCity, l => l.CityId, ct);

        var categories = new Dictionary<string, int>(StringComparer.Ordinal);
        var subcategories = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var category in taxonomy.Categories.Where(c => c.ParentId is null && c.Kind == CategoryKind.Product && c.IsActive))
        {
            var rootApplies = taxonomy.HasFilter(category.Id, CategoryFilters.RootSystem);
            categories[category.Id] = (rootApplies ? byCategoryWithRoot : byCategory).GetValueOrDefault(category.Id);
            foreach (var sub in taxonomy.Categories.Where(c => c.ParentId == category.Id && c.IsActive))
            {
                subcategories[sub.Id] = (rootApplies ? bySubcategoryWithRoot : bySubcategory).GetValueOrDefault(sub.Id);
            }
        }

        var cities = taxonomy.Cities.Where(c => c.IsActive).ToDictionary(c => c.Id, c => byCity.GetValueOrDefault(c.Id), StringComparer.Ordinal);
        return TypedResults.Ok(new FacetCountsDto(
            new CategoryFacetDto(all, categories),
            subcategories,
            new CityFacetDto(cityAll, cities)));
    }

    /// <summary><c>GET /listings/count?categoryId&amp;cityId</c> (<c>countListings</c>).</summary>
    private static async Task<Ok<ListingCountDto>> Count(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var filter = new ListingFilter
        {
            CategoryId = query.String("categoryId"),
            CityIds = query.String("cityId") is { } cityId ? [cityId] : [],
        };
        query.ThrowIfInvalid();

        var count = await db.Listings.AsNoTracking().Public(CategoryKind.Product).Filter(filter).CountAsync(ct);
        return TypedResults.Ok(new ListingCountDto(count));
    }

    /// <summary>
    /// The listing page. The number at the end of the slug decides (decision 3): an old slug still finds the listing,
    /// and the response's <c>slug</c> is the current one, so the page can redirect to it.
    /// </summary>
    private static async Task<Ok<ListingDto>> GetBySlug(string slug, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var listing = await FindBySlugAsync(db.Listings.AsNoTracking().Public(CategoryKind.Product), slug, ct)
            ?? throw ApiProblemException.NotFound(NotFound);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(listing.ToListingDto(read));
    }

    /// <summary>«Satıcının digər elanları» (the same owner's) and «Oxşar elanlar» (the same category, not shown yet).</summary>
    private static async Task<Ok<RelatedListingsDto>> Related(Guid id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var products = db.Listings.AsNoTracking().Public(CategoryKind.Product);
        var listing = await products.Where(l => l.Id == id).Select(l => new { l.OwnerUserId, l.CategoryId }).FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(NotFound);

        var fromSeller = await products.Where(l => l.OwnerUserId == listing.OwnerUserId && l.Id != id)
            .Sort(ListingSort.Newest).WithCardData().Take(RelatedLimit).ToListAsync(ct);
        var shown = fromSeller.Select(l => l.Id).Append(id).ToList();
        var similar = await products.Where(l => l.CategoryId == listing.CategoryId && !shown.Contains(l.Id))
            .Sort(ListingSort.Newest).WithCardData().Take(RelatedLimit).ToListAsync(ct);

        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(new RelatedListingsDto(
            fromSeller.Select(l => l.ToListingDto(read)).ToList(),
            similar.Select(l => l.ToListingDto(read)).ToList()));
    }

    /// <summary>The exact slug, else the listing with the slug's number (backend-contract.md 1.2).</summary>
    internal static async Task<Listing?> FindBySlugAsync(IQueryable<Listing> listings, string slug, CancellationToken ct)
    {
        var exact = await listings.WithCardData().FirstOrDefaultAsync(l => l.Slug == slug, ct);
        if (exact is not null || !ListingSlug.TryGetNumber(slug, out var number))
        {
            return exact;
        }

        return await listings.WithCardData().FirstOrDefaultAsync(l => l.Number == number, ct);
    }

    private static async Task<Dictionary<string, int>> CountByAsync(
        IQueryable<Listing> listings,
        System.Linq.Expressions.Expression<Func<Listing, string>> key,
        CancellationToken ct) =>
        await listings.GroupBy(key).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count, StringComparer.Ordinal, ct);
}

/// <summary><c>HomeContent</c> of src/services/repository.ts.</summary>
public sealed record HomeContentDto(
    IReadOnlyList<ListingDto> Vip,
    IReadOnlyList<ListingDto> Latest,
    IReadOnlyList<SellerDto> Sellers,
    IReadOnlyList<HomeServiceDto> Services)
{
    /// <summary>«Önə çıxan elanlar»: one row of four cards.</summary>
    public const int PromotedCount = 4;

    /// <summary>«Son elanlar»: two rows of four.</summary>
    public const int LatestCount = 8;

    /// <summary>«Etibar etdiyiniz satıcılar».</summary>
    public const int SellerCount = 3;

    /// <summary>«Bağınıza peşəkar toxunuş».</summary>
    public const int ServiceCount = 3;
}

public sealed record HomeServiceDto(ServiceDto Service, string Image);

/// <summary>Filter counts (backend-contract.md 1.4), shaped like <c>FacetCounts</c> in src/features/search/facets.ts.</summary>
public sealed record FacetCountsDto(CategoryFacetDto Categories, IReadOnlyDictionary<string, int> Subcategories, CityFacetDto Cities);

public sealed record CategoryFacetDto(int All, IReadOnlyDictionary<string, int> ById);

public sealed record CityFacetDto(int All, IReadOnlyDictionary<string, int> ByCity);
