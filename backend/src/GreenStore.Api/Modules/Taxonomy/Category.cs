using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;

namespace GreenStore.Api.Modules.Taxonomy;

/// <summary>
/// A category or, with <see cref="ParentId"/>, a sub-category (two levels, DATABASE.md §3.1). The id is also the URL
/// slug (<c>agaclar</c>, <c>agaclar-meyve</c>). Service types («Landşaft dizaynı», …) are the sub-categories of the
/// service category <c>landsaft-xidmetleri</c>.
/// </summary>
public sealed class Category : IHasUpdatedAt, IHasRowVersion
{
    public required string Id { get; set; }

    /// <summary>Null for a category, the category's id for a sub-category.</summary>
    public string? ParentId { get; set; }

    public Category? Parent { get; set; }

    public List<Category> Subcategories { get; set; } = [];

    public CategoryKind Kind { get; set; }

    /// <summary>The «Elan yerləşdir» attribute set; set on categories only, never on sub-categories.</summary>
    public CategoryForm? Form { get; set; }

    public required LocalizedText Name { get; set; }

    public LocalizedText? Description { get; set; }

    /// <summary>A lucide icon name (<c>IconName</c> in src/types), on categories.</summary>
    public string? Icon { get; set; }

    /// <summary>Catalogue filters the admin turned on or off, in the admin's order.</summary>
    public List<CategoryFilter> Filters { get; set; } = [];

    public int SortOrder { get; set; }

    /// <summary>False: taken off the site; its old listings keep it.</summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public uint Version { get; set; }
}

/// <summary>One catalogue filter of a category: <c>{ "id": "rootSystem", "enabled": true }</c>.</summary>
public sealed record CategoryFilter(string Id, bool Enabled);

/// <summary>
/// The filter ids a category can turn on or off (src/data/categories.ts <c>attributes</c>; the admin's
/// «Filtrlər»). The attributes themselves are in code, not in the database (DATABASE.md decision 2): the admin only
/// chooses which of its form's filters the catalogue shows. Of these, the API itself reads <see cref="RootSystem"/>
/// (the catalogue's «Kök sistemi»); the others are for the site.
/// </summary>
public static class CategoryFilters
{
    /// <summary>«Növ».</summary>
    public const string Species = "species";

    /// <summary>«Hündürlük».</summary>
    public const string Height = "height";

    /// <summary>«Yaş».</summary>
    public const string Age = "age";

    /// <summary>«Kök sistemi».</summary>
    public const string RootSystem = "rootSystem";

    /// <summary>«Xidmət növü».</summary>
    public const string ServiceType = "serviceType";

    /// <summary>«Ərazi».</summary>
    public const string Area = "area";

    /// <summary>«Qiymət forması».</summary>
    public const string PriceType = "priceType";

    /// <summary>The filters a category of <paramref name="form"/> can have, in the catalogue's order.</summary>
    public static IReadOnlyList<string> For(CategoryForm? form) => form switch
    {
        CategoryForm.Plant => [Species, Height, Age, RootSystem],
        CategoryForm.Service => [ServiceType, Area, PriceType],
        _ => [],
    };
}

/// <summary><c>CategoryKind</c> in src/types; also the kind of a listing.</summary>
public enum CategoryKind
{
    Product,
    Service,
}

/// <summary><c>CategoryForm</c> in src/data/categories.ts: which attributes «Elan yerləşdir» asks for.</summary>
public enum CategoryForm
{
    Plant,
    Pack,
    Goods,
    Grass,
    Service,
}

public sealed class City
{
    public required string Id { get; set; }

    public required LocalizedText Name { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}
