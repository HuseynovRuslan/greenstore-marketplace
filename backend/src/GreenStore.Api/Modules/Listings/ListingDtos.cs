using System.Diagnostics.CodeAnalysis;
using System.Text.Json.Serialization;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// <c>Listing</c> of src/types as public endpoints send it (a product listing). Never carries <c>contactPhone</c>
/// (decision 4, backend-contract.md 3.1), <c>stats</c> or the moderator's reason: those are for the owner
/// (<see cref="OwnListingDto"/>). Not sealed for that reason.
/// </summary>
public record ListingDto
{
    public required string Id { get; init; }

    public required string Slug { get; init; }

    public long Number { get; init; }

    public required string Title { get; init; }

    /// <summary>0 for «Razılaşma ilə» (backend-contract.md 1.6).</summary>
    public decimal Price { get; init; }

    public required IReadOnlyList<string> Attributes { get; init; }

    public required string CityId { get; init; }

    public DateTimeOffset PublishedAt { get; init; }

    /// <summary>«Önə çıxan» (<c>is_promoted</c>); the word "VIP" is never shown.</summary>
    public bool Vip { get; init; }

    public required string CategoryId { get; init; }

    /// <summary>The sub-category's name in the request's language.</summary>
    public string? Subcategory { get; init; }

    public string? SubcategoryId { get; init; }

    public string? SellerId { get; init; }

    public required string Cover { get; init; }

    public required IReadOnlyList<string> Images { get; init; }

    public IReadOnlyList<string>? Description { get; init; }

    public bool DeliveryAvailable { get; init; }

    public ListingStatus Status { get; init; }

    public int Views { get; init; }

    public DateTimeOffset? UpdatedAt { get; init; }

    public DateTimeOffset? ExpiresAt { get; init; }

    public DateTimeOffset? BumpedAt { get; init; }

    public PriceType PriceType { get; init; }

    public PriceUnit? PriceUnit { get; init; }

    public WholesaleDto? Wholesale { get; init; }

    public int? QuantityAvailable { get; init; }

    public string? Area { get; init; }

    public PlantFactsDto? Plant { get; init; }

    public IReadOnlyList<string>? CareTips { get; init; }

    public bool PlantingAvailable { get; init; }

    public string? DeliveryAreas { get; init; }

    public string? ContactName { get; init; }

    public bool Whatsapp { get; init; }

    public bool PhoneHidden { get; init; }

    /// <summary>«+994 50 *** ** 34»; not sent when the number is hidden.</summary>
    public string? PhoneMasked { get; init; }
}

/// <summary>
/// A listing as its owner sees it («Elanlarım», <c>GET /me/listings</c>) and as the moderator sees it: the public
/// <c>Listing</c> plus the number itself, whether it is the account's verified number, the moderator's reason as a code
/// (backend-contract.md 3.5: the UI words it) and the row's <c>version</c>. Any status but deleted.
/// </summary>
public sealed record OwnListingDto : ListingDto
{
    [SetsRequiredMembers]
    public OwnListingDto(ListingDto listing)
        : base(listing)
    {
    }

    /// <summary><c>product</c> or <c>service</c>: services are listings too, under the service category.</summary>
    [JsonPropertyOrder(1)]
    public CategoryKind Kind { get; init; }

    [JsonPropertyOrder(1)]
    public string? ContactPhone { get; init; }

    /// <summary>The account's own (SMS-verified) number; the moderator sees «nömrə təsdiqlənməyib» otherwise (decision 3).</summary>
    [JsonPropertyOrder(1)]
    public bool ContactPhoneVerified { get; init; }

    [JsonPropertyOrder(1)]
    public RejectionReason? RejectionReasonCode { get; init; }

    [JsonPropertyOrder(1)]
    public string? RejectionNote { get; init; }

    /// <summary>When it last went to the moderator.</summary>
    [JsonPropertyOrder(1)]
    public DateTimeOffset? SubmittedAt { get; init; }

    /// <summary>The row's version (<c>xmin</c>): sent back with a change, a newer row answers 409.</summary>
    [JsonPropertyOrder(1)]
    public string Version { get; init; } = string.Empty;

    /// <summary>
    /// The photos' ids in gallery order, the same order as <see cref="ListingDto.Images"/>: an edit sends them back in
    /// <c>ListingInput.photoIds</c> without uploading them again.
    /// </summary>
    [JsonPropertyOrder(1)]
    public IReadOnlyList<string> PhotoIds { get; init; } = [];

    /// <summary>
    /// What runs now: «Önə çıxar» (or the bundle) until its last paid day, otherwise «İrəli çək» (<c>Listing.promotion</c>
    /// of src/types). In the owner's own reads only.
    /// </summary>
    [JsonPropertyOrder(1)]
    public ListingPromotionDto? Promotion { get; init; }

    /// <summary>★ The promotion chosen in «Elan yerləşdir», not paid yet: the cabinet offers it once the listing is active.</summary>
    [JsonPropertyOrder(1)]
    public PendingPromotionDto? PendingPromotion { get; init; }
}

public sealed record WholesaleDto(decimal Price, int MinQuantity);

public sealed record HeightDto(int Min, int? Max = null);

/// <summary><c>PlantFacts</c> of src/types.</summary>
public sealed record PlantFactsDto
{
    public string? Species { get; init; }

    public HeightDto? HeightCm { get; init; }

    public int? AgeYears { get; init; }

    public RootSystem? RootSystem { get; init; }

    public decimal? PotLitres { get; init; }

    public SunNeed? Sun { get; init; }

    public WaterNeed? Water { get; init; }

    public int? FrostHardinessC { get; init; }

    public Foliage? Foliage { get; init; }

    public IReadOnlyList<int>? PlantingMonths { get; init; }
}

/// <summary>
/// <c>Service</c> of src/types: a listing of kind "service". <c>categoryId</c> is the service type (the listing's
/// sub-category); <c>providerId</c> is the owner's account (<c>GET /providers/{id}</c>).
/// </summary>
public sealed record ServiceDto
{
    public required string Id { get; init; }

    public required string Slug { get; init; }

    public required string Title { get; init; }

    /// <summary>Ready text in the request's language until the UI words the price itself (backend-contract.md 1.7).</summary>
    public required string PriceLabel { get; init; }

    public decimal? PriceFrom { get; init; }

    public PriceType PriceType { get; init; }

    public PriceUnit? PriceUnit { get; init; }

    public required string ProviderId { get; init; }

    /// <summary>City names in the request's language.</summary>
    public required IReadOnlyList<string> Areas { get; init; }

    public required string CategoryId { get; init; }

    public required string Cover { get; init; }

    public required IReadOnlyList<string> Images { get; init; }

    public IReadOnlyList<string>? Description { get; init; }

    public IReadOnlyList<string>? Includes { get; init; }

    public long Number { get; init; }

    /// <summary>The provider is a business profile GreenStore verified.</summary>
    public bool Verified { get; init; }
}

public sealed record RelatedListingsDto(IReadOnlyList<ListingDto> FromSeller, IReadOnlyList<ListingDto> Similar);

public sealed record RelatedServicesDto(IReadOnlyList<ServiceDto> FromProvider, IReadOnlyList<ServiceDto> Similar);

/// <summary><c>ServiceSearchResult</c> of src/services/repository.ts.</summary>
public sealed record ServiceSearchResultDto(IReadOnlyList<ServiceDto> Items, int Total, int Page, int PageCount, int DisplayTotal);

public sealed record ListingCountDto(int Count);

/// <summary>Turns listing rows into the public DTOs (manual mapping, no AutoMapper).</summary>
public static class ListingMapping
{
    public static ListingDto ToListingDto(this Listing l, ReadContext read)
    {
        var language = read.Language;
        var photos = PhotoUrls(l, read);
        return new ListingDto
        {
            Id = l.Id.ToString(),
            Slug = l.Slug,
            Number = l.Number,
            Title = l.Title,
            Price = l.Price is { } price ? Money.Trim(price) : 0,
            Attributes = ListingTexts.AttributeLine(
                read.Taxonomy.FormOf(l.CategoryId), l.Attributes, l.HeightMinCm, l.HeightMaxCm, l.AgeYears, l.RootSystem, language),
            CityId = l.CityId,
            PublishedAt = l.PublishedAt ?? l.CreatedAt,
            Vip = l.IsPromoted,
            CategoryId = l.CategoryId,
            Subcategory = l.SubcategoryId is { } sub ? read.Taxonomy.CategoryName(sub, language) : null,
            SubcategoryId = l.SubcategoryId,
            SellerId = l.SellerId?.ToString(),
            Cover = photos.FirstOrDefault() ?? string.Empty,
            Images = photos,
            Description = Paragraphs(l.Description),
            DeliveryAvailable = l.DeliveryAvailable,
            Status = l.Status,
            Views = l.Counter?.Views ?? 0,
            UpdatedAt = l.EditedAt,
            ExpiresAt = l.ExpiresAt,
            BumpedAt = l.BumpedAt,
            PriceType = l.PriceType,
            PriceUnit = l.PriceUnit,
            Wholesale = l.WholesalePrice is { } wholesale && l.WholesaleMinQty is { } minQuantity
                ? new WholesaleDto(Money.Trim(wholesale), minQuantity)
                : null,
            QuantityAvailable = l.QuantityAvailable,
            Area = l.Area,
            Plant = PlantFacts(l),
            CareTips = l.CareTips.Count > 0 ? l.CareTips : null,
            PlantingAvailable = l.PlantingAvailable,
            DeliveryAreas = l.DeliveryAreas,
            ContactName = l.ContactName,
            Whatsapp = l.Whatsapp,
            PhoneHidden = l.PhoneHidden,
            PhoneMasked = l.PhoneHidden ? null : PhoneNumbers.Mask(l.ContactPhone),
        };
    }

    /// <summary>
    /// The owner's (and the moderator's) view of a listing in any status; <paramref name="promotion"/> (the owner's own
    /// reads, <see cref="OwnerPromotions"/>) adds what runs on it and the choice still to pay for.
    /// </summary>
    public static OwnListingDto ToOwnListingDto(this Listing l, ReadContext read, OwnerPromotion? promotion = null)
    {
        var listing = l.ToListingDto(read);
        if (l.Kind == CategoryKind.Service)
        {
            // A service's card line is its areas, as the wizard's preview shows it.
            listing = listing with { Attributes = l.ServiceCityIds.Select(id => read.Taxonomy.CityName(id, read.Language)).ToList() };
        }

        return new OwnListingDto(listing)
        {
            Kind = l.Kind,
            ContactPhone = l.ContactPhone,
            ContactPhoneVerified = l.ContactPhoneVerified,
            RejectionReasonCode = l.Status == ListingStatus.Rejected ? l.RejectionReasonCode : null,
            RejectionNote = l.Status == ListingStatus.Rejected ? l.RejectionNote : null,
            SubmittedAt = l.SubmittedAt,
            Version = RowVersion.Format(l.Version),
            // Only the photos that have an address, as Images has them, so the two lists stay in step.
            PhotoIds = l.Photos.OrderBy(p => p.Position)
                .Where(p => read.PhotoUrl(p.Photo) is not null)
                .Select(p => p.PhotoId.ToString())
                .ToList(),
            Promotion = promotion?.Promotion,
            PendingPromotion = promotion?.Pending,
        };
    }

    public static ServiceDto ToServiceDto(this Listing l, ReadContext read)
    {
        var language = read.Language;
        var photos = PhotoUrls(l, read);
        return new ServiceDto
        {
            Id = l.Id.ToString(),
            Slug = l.Slug,
            Title = l.Title,
            PriceLabel = ListingTexts.ServicePriceLabel(l.PriceType, l.Price, l.PriceUnit, language),
            PriceFrom = l.Price is { } price ? Money.Trim(price) : null,
            PriceType = l.PriceType,
            PriceUnit = l.PriceUnit,
            ProviderId = l.OwnerUserId.ToString(),
            Areas = l.ServiceCityIds.Select(id => read.Taxonomy.CityName(id, language)).ToList(),
            CategoryId = l.SubcategoryId ?? l.CategoryId,
            Cover = photos.FirstOrDefault() ?? string.Empty,
            Images = photos,
            Description = Paragraphs(l.Description),
            Includes = l.Includes.Count > 0 ? l.Includes : null,
            Number = l.Number,
            Verified = l.Seller?.VerifiedAt is not null,
        };
    }

    /// <summary>Paragraphs separated by a blank line; null when there is no text.</summary>
    public static IReadOnlyList<string>? Paragraphs(string text)
    {
        var paragraphs = text.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => p.Length > 0)
            .ToList();
        return paragraphs.Count > 0 ? paragraphs : null;
    }

    /// <summary>The ready photos' addresses, cover first.</summary>
    private static List<string> PhotoUrls(Listing l, ReadContext read) =>
        l.Photos.OrderBy(p => p.Position)
            .Select(p => read.PhotoUrl(p.Photo))
            .OfType<string>()
            .ToList();

    private static PlantFactsDto? PlantFacts(Listing l)
    {
        var details = l.Plant;
        if (l.Species is null && l.HeightMinCm is null && l.AgeYears is null && l.RootSystem is null && details is null)
        {
            return null;
        }

        return new PlantFactsDto
        {
            Species = l.Species,
            HeightCm = l.HeightMinCm is { } min ? new HeightDto(min, l.HeightMaxCm is { } max && max != min ? max : null) : null,
            AgeYears = l.AgeYears,
            RootSystem = l.RootSystem,
            PotLitres = details?.PotLitres is { } pot ? Money.Trim(pot) : null,
            Sun = details?.Sun,
            Water = details?.Water,
            FrostHardinessC = details?.FrostHardinessC,
            Foliage = details?.Foliage,
            PlantingMonths = details?.PlantingMonths is { Count: > 0 } months ? months : null,
        };
    }
}
