using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// A product or a service listing (DATABASE.md §3.4; one table for both, ARCHITECTURE.md §3). Plant facts that filters
/// use (species, height, age, root system) are columns; the facts only shown are in <see cref="Plant"/>. View counts
/// live in <see cref="ListingCounter"/>, so a view never changes this row's <c>xmin</c>.
/// </summary>
public sealed class Listing : IHasRowVersion
{
    public Guid Id { get; set; }

    /// <summary>«Elan № 10482»; from <c>listing_number_seq</c> when not set.</summary>
    public long Number { get; set; }

    /// <summary>«zeytun-agaci-10482»: the title in ASCII, then the number (<see cref="ListingSlug"/>).</summary>
    public required string Slug { get; set; }

    public CategoryKind Kind { get; set; }

    public Guid OwnerUserId { get; set; }

    public User? Owner { get; set; }

    /// <summary>Set when the owner has a business profile.</summary>
    public Guid? SellerId { get; set; }

    public Seller? Seller { get; set; }

    public required string CategoryId { get; set; }

    public Category? Category { get; set; }

    /// <summary>For a service: the service type («landsaft-dizayni»).</summary>
    public string? SubcategoryId { get; set; }

    public Category? Subcategory { get; set; }

    public ListingStatus Status { get; set; }

    public required string Title { get; set; }

    /// <summary>Paragraphs separated by a blank line.</summary>
    public string Description { get; set; } = string.Empty;

    public PriceType PriceType { get; set; }

    /// <summary>Null for <see cref="PriceType.Agreement"/> (the API sends 0); for a service, the «…-dən» price.</summary>
    public decimal? Price { get; set; }

    public PriceUnit? PriceUnit { get; set; }

    public decimal? WholesalePrice { get; set; }

    public int? WholesaleMinQty { get; set; }

    public int? QuantityAvailable { get; set; }

    public Availability? Availability { get; set; }

    /// <summary>
    /// The promotion option chosen in «Elan yerləşdir» (<c>ListingInput.promotion</c>), not paid yet: the owner pays for
    /// it from the cabinet once the listing is approved; a paid order of the listing clears it.
    /// </summary>
    public string? PendingPromotionOptionId { get; set; }

    public required string CityId { get; set; }

    public City? City { get; set; }

    /// <summary>Village, district or street after the city: «Məhəmmədi qəsəbəsi».</summary>
    public string? Area { get; set; }

    public bool DeliveryAvailable { get; set; }

    public string? DeliveryAreas { get; set; }

    public bool PlantingAvailable { get; set; }

    public required string ContactName { get; set; }

    /// <summary>E.164. Never in public responses: only the phone-reveal endpoint returns it (decision 4).</summary>
    public required string ContactPhone { get; set; }

    /// <summary>Is it the account's verified number (decision 3)?</summary>
    public bool ContactPhoneVerified { get; set; }

    public bool Whatsapp { get; set; }

    public bool PhoneHidden { get; set; }

    /// <summary>Latin name: «Olea europaea».</summary>
    public string? Species { get; set; }

    public int? HeightMinCm { get; set; }

    public int? HeightMaxCm { get; set; }

    public short? AgeYears { get; set; }

    public RootSystem? RootSystem { get; set; }

    /// <summary>The other plant facts: pot size, sun, water, frost hardiness, foliage, planting months.</summary>
    public PlantDetails? Plant { get; set; }

    /// <summary>The form's raw values (<c>ListingInput.attributes</c>), by attribute id.</summary>
    public Dictionary<string, string> Attributes { get; set; } = [];

    public List<string> CareTips { get; set; } = [];

    /// <summary>A service's areas (<c>Service.areas</c>): city ids, named in the request's language.</summary>
    public List<string> ServiceCityIds { get; set; } = [];

    /// <summary>A service's «✓ …» checklist.</summary>
    public List<string> Includes { get; set; } = [];

    /// <summary>Normalised words the search matches (<see cref="ListingSearchText"/>, DATABASE.md §4).</summary>
    public string SearchText { get; set; } = string.Empty;

    /// <summary>«Önə çıxan»: <c>vip</c> in the API.</summary>
    public bool IsPromoted { get; set; }

    /// <summary>The end of the paid «Önə çıxan»; null while promoted without an end (the demo data).</summary>
    public DateTimeOffset? PromotedUntil { get; set; }

    /// <summary>
    /// When the running «Önə çıxan» began: the newest first in the «Önə çıxan» group of the home page and «Ən yenilər»,
    /// so a listing that has just paid gets the places the package sells. Set exactly while <see cref="IsPromoted"/>.
    /// </summary>
    public DateTimeOffset? PromotedAt { get; set; }

    /// <summary>greatest(published_at, bumped_at): the «Ən yenilər» order.</summary>
    public DateTimeOffset? SortAt { get; set; }

    public RejectionReason? RejectionReasonCode { get; set; }

    public string? RejectionNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>The owner's last edit or renewal («Yeniləndi»).</summary>
    public DateTimeOffset? EditedAt { get; set; }

    public DateTimeOffset? SubmittedAt { get; set; }

    /// <summary>First approval.</summary>
    public DateTimeOffset? PublishedAt { get; set; }

    public DateTimeOffset? BumpedAt { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }

    public List<ListingPhoto> Photos { get; set; } = [];

    public ListingCounter? Counter { get; set; }

    public uint Version { get; set; }
}

/// <summary>The plant facts kept in the <c>plant</c> jsonb (the rest of <c>PlantFacts</c> in src/types).</summary>
public sealed record PlantDetails
{
    public decimal? PotLitres { get; init; }

    public SunNeed? Sun { get; init; }

    public WaterNeed? Water { get; init; }

    public int? FrostHardinessC { get; init; }

    public Foliage? Foliage { get; init; }

    public IReadOnlyList<int>? PlantingMonths { get; init; }
}

/// <summary>A listing's photo at a position: 0 is the cover, at most 12 (DATABASE.md §3.5).</summary>
public sealed class ListingPhoto
{
    public const int MaxPhotos = 12;

    public Guid ListingId { get; set; }

    public short Position { get; set; }

    public Guid PhotoId { get; set; }

    public Photo? Photo { get; set; }
}

/// <summary>Views, phone reveals and favourites (DATABASE.md §3.6).</summary>
public sealed class ListingCounter
{
    public Guid ListingId { get; set; }

    public int Views { get; set; }

    public int PhoneReveals { get; set; }

    public int Favourites { get; set; }
}
