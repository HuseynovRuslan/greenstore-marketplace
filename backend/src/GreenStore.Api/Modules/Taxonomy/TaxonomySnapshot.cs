using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Taxonomy;

/// <summary>
/// Every category, sub-category and city, read once per request: public responses name them in the request's
/// language, and the tables are small (tens of rows). Inactive rows are included, since old listings keep them.
/// </summary>
public sealed class TaxonomySnapshot(IReadOnlyList<Category> categories, IReadOnlyList<City> cities)
{
    private readonly Dictionary<string, Category> categoriesById = categories.ToDictionary(c => c.Id, StringComparer.Ordinal);
    private readonly Dictionary<string, City> citiesById = cities.ToDictionary(c => c.Id, StringComparer.Ordinal);

    public IReadOnlyList<Category> Categories { get; } = categories;

    public IReadOnlyList<City> Cities { get; } = cities;

    public Category? Category(string? id) => id is not null && categoriesById.TryGetValue(id, out var category) ? category : null;

    public City? City(string? id) => id is not null && citiesById.TryGetValue(id, out var city) ? city : null;

    /// <summary>The name in <paramref name="language"/>; the id itself for an unknown id (never an empty text).</summary>
    public string CategoryName(string id, Language language) => Category(id)?.Name.Get(language) ?? id;

    public string CityName(string id, Language language) => City(id)?.Name.Get(language) ?? id;

    /// <summary>The «Elan yerləşdir» form of a category or of a sub-category's parent.</summary>
    public CategoryForm? FormOf(string categoryId)
    {
        var category = Category(categoryId);
        return category?.Form ?? Category(category?.ParentId)?.Form;
    }

    /// <summary>Is the catalogue filter <paramref name="filterId"/> («rootSystem») turned on for the category?</summary>
    public bool HasFilter(string categoryId, string filterId) =>
        Category(categoryId)?.Filters.Any(f => f.Enabled && f.Id == filterId) == true;

    public static async Task<TaxonomySnapshot> LoadAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var categories = await db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);
        var cities = await db.Cities.AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
            .ToListAsync(cancellationToken);
        return new TaxonomySnapshot(categories, cities);
    }
}
