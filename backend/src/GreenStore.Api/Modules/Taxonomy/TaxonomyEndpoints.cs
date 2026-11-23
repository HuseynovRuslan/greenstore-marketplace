using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Taxonomy;

/// <summary>Categories and cities, named in the request's language (ARCHITECTURE.md §7, §8).</summary>
public static class TaxonomyEndpoints
{
    public const string CategoryNotFound = "category.not-found";

    public static RouteGroupBuilder MapTaxonomy(this RouteGroupBuilder api)
    {
        var categories = api.MapGroup("/categories").WithTags("Taxonomy");
        categories.MapGet("", ListCategories);
        categories.MapGet("/{id}", GetCategory);
        api.MapGet("/cities", ListCities).WithTags("Taxonomy");
        return api;
    }

    /// <summary><c>GET /categories?kind=product|service</c>: the site's categories in order, with their active listings counted.</summary>
    private static async Task<Ok<List<CategoryDto>>> ListCategories(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var kind = query.Enum<CategoryKind>("kind");
        query.ThrowIfInvalid();

        var categories = db.Categories.AsNoTracking().Where(c => c.ParentId == null && c.IsActive);
        if (kind is { } k)
        {
            categories = categories.Where(c => c.Kind == k);
        }

        var rows = await categories.OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync(ct);
        var counts = await CountsAsync(db, ct);
        var language = http.GetLanguage();
        return TypedResults.Ok(rows.Select(c => c.ToDto(counts.GetValueOrDefault(c.Id), language)).ToList());
    }

    /// <summary><c>GET /categories/{id}</c>: one active category (a sub-category id is not found).</summary>
    private static async Task<Ok<CategoryDto>> GetCategory(string id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id && c.ParentId == null && c.IsActive, ct)
            ?? throw ApiProblemException.NotFound(CategoryNotFound);
        var count = await db.Listings.Public(category.Kind).CountAsync(l => l.CategoryId == id, ct);
        return TypedResults.Ok(category.ToDto(count, http.GetLanguage()));
    }

    /// <summary><c>GET /cities</c> (<c>listCities</c>, <c>getCity</c>).</summary>
    private static async Task<Ok<List<CityDto>>> ListCities(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var language = http.GetLanguage();
        var cities = await db.Cities.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync(ct);
        return TypedResults.Ok(cities.Select(c => new CityDto(c.Id, c.Name.Get(language))).ToList());
    }

    /// <summary>Active listings per category; a category counts the listings of its own kind.</summary>
    private static async Task<Dictionary<string, int>> CountsAsync(AppDbContext db, CancellationToken ct) =>
        await db.Listings.AsNoTracking()
            .Where(l => l.Status == ListingStatus.Active && l.DeletedAt == null && l.Kind == l.Category!.Kind)
            .GroupBy(l => l.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, StringComparer.Ordinal, ct);
}

/// <summary><c>Category</c> of src/types. The id is also the slug (/kateqoriyalar/{id}).</summary>
public sealed record CategoryDto(string Id, string Slug, string Name, string Icon, int ListingCount, CategoryKind Kind, string? Description = null);

/// <summary><c>City</c> of src/types.</summary>
public sealed record CityDto(string Id, string Name);

public static class TaxonomyMapping
{
    public static CategoryDto ToDto(this Category c, int listingCount, Language language) =>
        new(c.Id, c.Id, c.Name.Get(language), c.Icon ?? string.Empty, listingCount, c.Kind, c.Description?.Get(language));
}
