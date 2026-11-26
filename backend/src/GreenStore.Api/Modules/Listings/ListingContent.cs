using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// What an owner wrote in a listing, checked and normalised (<see cref="ListingInputRules"/>): the columns it fills and
/// the photos in gallery order. It is also a revision's snapshot (<c>listing_revisions.data</c>), so the moderator can
/// compare two submissions field by field (<see cref="RevisionDiff"/>).
/// </summary>
public sealed record ListingContent
{
    public CategoryKind Kind { get; init; }

    public required string CategoryId { get; init; }

    /// <summary>The first of <see cref="SubcategoryIds"/>: a service's main type, a product's sub-category.</summary>
    public string? SubcategoryId { get; init; }

    /// <summary>
    /// Every sub-category, <see cref="SubcategoryId"/> first (a service's types). A revision stored before the list
    /// existed has none here: <see cref="AllSubcategoryIds"/> reads it as its one <see cref="SubcategoryId"/>.
    /// </summary>
    public List<string> SubcategoryIds { get; init; } = [];

    public required string Title { get; init; }

    public string Description { get; init; } = string.Empty;

    /// <summary>The form's raw values by attribute id, as the wizard sent them (trimmed, blanks dropped).</summary>
    public Dictionary<string, string> Attributes { get; init; } = [];

    public string? Species { get; init; }

    public int? HeightMinCm { get; init; }

    public int? HeightMaxCm { get; init; }

    public short? AgeYears { get; init; }

    public RootSystem? RootSystem { get; init; }

    public PlantDetails? Plant { get; init; }

    public Availability? Availability { get; init; }

    public PriceType PriceType { get; init; }

    public decimal? Price { get; init; }

    public PriceUnit? PriceUnit { get; init; }

    public decimal? WholesalePrice { get; init; }

    public int? WholesaleMinQty { get; init; }

    public int? QuantityAvailable { get; init; }

    public required string CityId { get; init; }

    public string? Area { get; init; }

    public bool DeliveryAvailable { get; init; }

    public string? DeliveryAreas { get; init; }

    public bool PlantingAvailable { get; init; }

    public required string ContactName { get; init; }

    /// <summary>E.164.</summary>
    public required string ContactPhone { get; init; }

    public bool Whatsapp { get; init; }

    public bool PhoneHidden { get; init; }

    /// <summary>A service's areas (city ids).</summary>
    public List<string> ServiceCityIds { get; init; } = [];

    /// <summary>Cover first; at most <see cref="ListingPhoto.MaxPhotos"/>.</summary>
    public List<Guid> PhotoIds { get; init; } = [];

    /// <summary>
    /// «Önə çıxar» chosen while posting: kept in the revision, and as the listing's
    /// <see cref="Listing.PendingPromotionOptionId"/> the owner pays for after approval.
    /// </summary>
    public PromotionChoice? Promotion { get; init; }

    /// <summary>The sub-categories as a list, also for a revision stored before the list existed.</summary>
    public IReadOnlyList<string> AllSubcategoryIds() => ListingSubcategories.Of(SubcategoryId, SubcategoryIds);

    /// <summary>Writes the content into the listing's columns (not the photos, the slug or the search text).</summary>
    public void ApplyTo(Listing listing)
    {
        listing.Kind = Kind;
        listing.CategoryId = CategoryId;
        listing.SubcategoryId = SubcategoryId;
        listing.SubcategoryIds = [.. AllSubcategoryIds()];
        listing.Title = Title;
        listing.Description = Description;
        listing.Attributes = new Dictionary<string, string>(Attributes, StringComparer.Ordinal);
        listing.Species = Species;
        listing.HeightMinCm = HeightMinCm;
        listing.HeightMaxCm = HeightMaxCm;
        listing.AgeYears = AgeYears;
        listing.RootSystem = RootSystem;
        listing.Plant = Plant;
        listing.Availability = Availability;
        listing.PriceType = PriceType;
        listing.Price = Price;
        listing.PriceUnit = PriceUnit;
        listing.WholesalePrice = WholesalePrice;
        listing.WholesaleMinQty = WholesaleMinQty;
        listing.QuantityAvailable = QuantityAvailable;
        listing.CityId = CityId;
        listing.Area = Area;
        listing.DeliveryAvailable = DeliveryAvailable;
        listing.DeliveryAreas = DeliveryAreas;
        listing.PlantingAvailable = PlantingAvailable;
        listing.ContactName = ContactName;
        listing.ContactPhone = ContactPhone;
        listing.Whatsapp = Whatsapp;
        listing.PhoneHidden = PhoneHidden;
        listing.ServiceCityIds = [.. ServiceCityIds];
    }

    /// <summary>The content of a stored listing (a listing seeded or posted before revisions existed).</summary>
    public static ListingContent Of(Listing listing) => new()
    {
        Kind = listing.Kind,
        CategoryId = listing.CategoryId,
        SubcategoryId = listing.SubcategoryId,
        SubcategoryIds = [.. ListingSubcategories.Of(listing)],
        Title = listing.Title,
        Description = listing.Description,
        Attributes = new Dictionary<string, string>(listing.Attributes, StringComparer.Ordinal),
        Species = listing.Species,
        HeightMinCm = listing.HeightMinCm,
        HeightMaxCm = listing.HeightMaxCm,
        AgeYears = listing.AgeYears,
        RootSystem = listing.RootSystem,
        Plant = listing.Plant,
        Availability = listing.Availability,
        PriceType = listing.PriceType,
        Price = listing.Price,
        PriceUnit = listing.PriceUnit,
        WholesalePrice = listing.WholesalePrice,
        WholesaleMinQty = listing.WholesaleMinQty,
        QuantityAvailable = listing.QuantityAvailable,
        CityId = listing.CityId,
        Area = listing.Area,
        DeliveryAvailable = listing.DeliveryAvailable,
        DeliveryAreas = listing.DeliveryAreas,
        PlantingAvailable = listing.PlantingAvailable,
        ContactName = listing.ContactName,
        ContactPhone = listing.ContactPhone,
        Whatsapp = listing.Whatsapp,
        PhoneHidden = listing.PhoneHidden,
        ServiceCityIds = [.. listing.ServiceCityIds],
        PhotoIds = listing.Photos.OrderBy(p => p.Position).Select(p => p.PhotoId).ToList(),
    };
}

/// <summary>The promotion package and option chosen in «Elan yerləşdir» (<c>ListingInput.promotion</c>).</summary>
public sealed record PromotionChoice(string PackageId, string OptionId);
