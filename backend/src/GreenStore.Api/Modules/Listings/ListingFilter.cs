using System.Text.Json.Serialization;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Modules.Accounts;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The product catalogue's filters (<c>GET /listings</c>, <c>/listings/facets</c>), the same set as
/// <c>ListingFilters</c> in src/services/marketplace.ts plus the sub-category of src/features/search/searchState.ts.
/// </summary>
public sealed record ListingFilter
{
    /// <summary>Search words; every one must occur in the listing's search text.</summary>
    public string? Query { get; init; }

    public string? CategoryId { get; init; }

    public string? SubcategoryId { get; init; }

    public IReadOnlyList<string> CityIds { get; init; } = [];

    public decimal? MinPrice { get; init; }

    public decimal? MaxPrice { get; init; }

    /// <summary>«Önə çıxan» only.</summary>
    public bool PromotedOnly { get; init; }

    public bool DeliveryOnly { get; init; }

    /// <summary>Business: listings of a business profile; individual: listings without one.</summary>
    public AccountType? SellerType { get; init; }

    public Guid? SellerId { get; init; }

    public int? HeightMin { get; init; }

    public int? HeightMax { get; init; }

    public int? AgeMin { get; init; }

    public int? AgeMax { get; init; }

    public RootSystem? RootSystem { get; init; }

    /// <summary>Has a price filter: listings priced «Razılaşma ilə» then do not match (they have no price).</summary>
    [JsonIgnore]
    public bool HasPriceRange => MinPrice is not null || MaxPrice is not null;

    /// <summary>The catalogue query parameters (ARCHITECTURE.md §7).</summary>
    public static ListingFilter Read(QueryReader query) => new()
    {
        Query = query.String("q"),
        CategoryId = query.String("categoryId"),
        SubcategoryId = query.String("subcategoryId"),
        CityIds = query.List("cityIds"),
        MinPrice = query.Amount("minPrice"),
        MaxPrice = query.Amount("maxPrice"),
        PromotedOnly = query.Bool("promoted") ?? false,
        DeliveryOnly = query.Bool("delivery") ?? false,
        SellerType = query.Enum<AccountType>("sellerType"),
        SellerId = query.Guid("sellerId"),
        HeightMin = query.Int("heightMin"),
        HeightMax = query.Int("heightMax"),
        AgeMin = query.Int("ageMin"),
        AgeMax = query.Int("ageMax"),
        RootSystem = query.Enum<RootSystem>("rootSystem"),
    };
}

/// <summary>The services catalogue's filters (<c>GET /services</c>, src/features/services/query.ts).</summary>
public sealed record ServiceFilter
{
    public string? Query { get; init; }

    /// <summary>The service type, a sub-category of the service category («landsaft-dizayni»): one of the service's types.</summary>
    public string? CategoryId { get; init; }

    /// <summary>A city the service covers.</summary>
    public string? CityId { get; init; }

    /// <summary>«Təsdiqlənmiş şirkətlər» (a verified business profile) or «Fərdi ustalar» (no business profile).</summary>
    public ProviderKind? ProviderKind { get; init; }

    public decimal? MinPrice { get; init; }

    public decimal? MaxPrice { get; init; }

    public bool HasPriceRange => MinPrice is not null || MaxPrice is not null;

    /// <summary>True when nothing narrows the catalogue.</summary>
    public bool IsEmpty =>
        string.IsNullOrEmpty(Query) && CategoryId is null && CityId is null && ProviderKind is null && !HasPriceRange;

    public static ServiceFilter Read(QueryReader query) => new()
    {
        Query = query.String("q"),
        CategoryId = query.String("categoryId"),
        CityId = query.String("cityId"),
        ProviderKind = query.Enum<ProviderKind>("providerKind"),
        MinPrice = query.Amount("minPrice"),
        MaxPrice = query.Amount("maxPrice"),
    };
}

/// <summary><c>ServiceProvider.kind</c> in src/types.</summary>
public enum ProviderKind
{
    Company,
    Individual,
}

public static class ListingSortQuery
{
    /// <summary><c>sort=newest|price-asc|price-desc</c>; «Ən yenilər» when missing.</summary>
    public static ListingSort Read(QueryReader query) => query.Enum<ListingSort>("sort") ?? ListingSort.Newest;
}
