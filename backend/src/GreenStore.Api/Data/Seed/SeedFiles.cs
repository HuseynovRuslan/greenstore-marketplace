using System.Text.Json;
using System.Text.Json.Serialization;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Data.Seed;

/// <summary>
/// The seed files of backend/seed (DATABASE.md §7), generated from src/data by <c>node backend/seed/export.mjs</c> and
/// copied next to the API's binaries (<c>seed/</c>). Their shapes are the records below.
/// </summary>
public static class SeedFiles
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false) },
    };

    /// <summary>The seed folder next to the binaries; <c>Seed:Directory</c> overrides it.</summary>
    public static string DefaultDirectory => Path.Combine(AppContext.BaseDirectory, "seed");

    public static IReadOnlyList<T> Read<T>(string directory, string relativePath)
    {
        var path = Path.Combine(directory, relativePath);
        using var stream = File.OpenRead(path);
        var file = JsonSerializer.Deserialize<SeedFile<T>>(stream, Json)
            ?? throw new InvalidDataException($"{path} is empty");
        return file.Items;
    }
}

public sealed record SeedFile<T>(IReadOnlyList<T> Items);

public sealed record CategorySeed(
    string Id,
    CategoryKind Kind,
    CategoryForm Form,
    string Icon,
    LocalizedText Name,
    IReadOnlyList<CategoryFilter> Filters,
    int SortOrder,
    IReadOnlyList<SubcategorySeed> Subcategories,
    LocalizedText? Description = null);

public sealed record SubcategorySeed(string Id, LocalizedText Name, int SortOrder);

public sealed record CitySeed(string Id, LocalizedText Name, int SortOrder);

/// <summary>A promotion package with its options (seed/reference/promotions.json, from src/data/promotions.ts).</summary>
public sealed record PromotionPackageSeed(
    string Id,
    LocalizedText Name,
    LocalizedText Summary,
    IReadOnlyList<LocalizedText> Benefits,
    int SortOrder,
    IReadOnlyList<PromotionOptionSeed> Options);

public sealed record PromotionOptionSeed(string Id, LocalizedText Label, decimal Price, int SortOrder, short? Days = null, short? Bumps = null);

public sealed record UserSeed(string Key, string FullName, string Phone, AccountType AccountType, DateTimeOffset CreatedAt, string? Email = null);

public sealed record SellerSeed(
    string Key,
    string Slug,
    string Owner,
    string Name,
    IReadOnlyList<BusinessKind> BusinessKinds,
    string CityId,
    string Phone,
    bool Whatsapp,
    bool Verified,
    DateTimeOffset CreatedAt,
    IReadOnlyList<SellerOffer> Offers,
    string? Address = null,
    LocationSeed? Location = null,
    string? About = null,
    string? Terms = null,
    List<OpeningHours>? Hours = null,
    string? Email = null,
    string? ContactPerson = null,
    string? Instagram = null,
    string? Website = null,
    int? ResponseMinutes = null,
    string? Logo = null,
    string? Cover = null);

public sealed record LocationSeed(decimal Lat, decimal Lng);

/// <summary>A product listing (seed/demo/listings.json) or a service (seed/demo/services.json).</summary>
public sealed record ListingSeed
{
    public required string Key { get; init; }

    public long Number { get; init; }

    public ListingStatus Status { get; init; }

    public required string Owner { get; init; }

    public string? Seller { get; init; }

    public required string Title { get; init; }

    public IReadOnlyList<string> Description { get; init; } = [];

    public required string CategoryId { get; init; }

    public string? SubcategoryId { get; init; }

    public required string CityId { get; init; }

    public string? Area { get; init; }

    public PriceType PriceType { get; init; }

    public decimal? Price { get; init; }

    public PriceUnit? PriceUnit { get; init; }

    public WholesaleDto? Wholesale { get; init; }

    public int? QuantityAvailable { get; init; }

    public bool DeliveryAvailable { get; init; }

    public string? DeliveryAreas { get; init; }

    public bool PlantingAvailable { get; init; }

    public required string ContactName { get; init; }

    public required string ContactPhone { get; init; }

    public bool Whatsapp { get; init; }

    public bool PhoneHidden { get; init; }

    public PlantFactsDto? Plant { get; init; }

    public Dictionary<string, string> Attributes { get; init; } = [];

    public IReadOnlyList<string> CareTips { get; init; } = [];

    /// <summary>Services: the cities served (ids).</summary>
    public IReadOnlyList<string> Areas { get; init; } = [];

    /// <summary>Services: the «✓ …» checklist.</summary>
    public IReadOnlyList<string> Includes { get; init; } = [];

    public bool Promoted { get; init; }

    public int Views { get; init; }

    public DateTimeOffset? SubmittedAt { get; init; }

    public DateTimeOffset? PublishedAt { get; init; }

    public DateTimeOffset? ExpiresAt { get; init; }

    public DateTimeOffset? EditedAt { get; init; }

    public RejectionReason? RejectionReasonCode { get; init; }

    public string? RejectionNote { get; init; }

    /// <summary>Site paths ("/images/…"), cover first.</summary>
    public IReadOnlyList<string> Photos { get; init; } = [];
}
