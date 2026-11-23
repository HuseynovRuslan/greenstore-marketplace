using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// <c>Seller</c> of src/types: a business profile. Never carries <c>phone</c> (backend-contract.md 3.1); the number is
/// given by «Nömrəni göstər» only. Not sealed: the owner's view adds to it (<see cref="OwnSellerDto"/>).
/// </summary>
public record SellerDto
{
    public required string Id { get; init; }

    public required string Slug { get; init; }

    public required string Name { get; init; }

    /// <summary>«Tingçilik təsərrüfatı»: <see cref="BusinessKind"/> named in the request's language.</summary>
    public required string Kind { get; init; }

    public AccountType Type { get; init; } = AccountType.Business;

    public required string CityId { get; init; }

    public int ActiveListings { get; init; }

    public bool Verified { get; init; }

    public int MemberSince { get; init; }

    /// <summary>The card image: the cover photo, else the logo.</summary>
    public required string Image { get; init; }

    public string? CoverImage { get; init; }

    public string? PhoneMasked { get; init; }

    public string? Email { get; init; }

    public string? About { get; init; }

    public string? Terms { get; init; }

    public string? Address { get; init; }

    public string? ContactPerson { get; init; }

    public BusinessKind BusinessKind { get; init; }

    public string? Logo { get; init; }

    public IReadOnlyList<OpeningHours>? Hours { get; init; }

    public bool Whatsapp { get; init; }

    public string? Instagram { get; init; }

    public string? Website { get; init; }

    public LocationDto? Location { get; init; }

    public IReadOnlyList<SellerOffer>? Offers { get; init; }

    public int? ResponseMinutes { get; init; }

    /// <summary>The ids of the business's active services.</summary>
    public IReadOnlyList<string>? ServiceIds { get; init; }
}

public sealed record LocationDto(decimal Lat, decimal Lng);

/// <summary>
/// <c>ServiceProvider</c> of src/types: whoever publishes a service. Its id is the owner's account id; a business has
/// a seller page too (<see cref="SellerId"/>).
/// </summary>
public sealed record ServiceProviderDto
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public bool Verified { get; init; }

    public string? SellerId { get; init; }

    /// <summary>«Landşaft şirkəti · Bakı, Nərimanov rayonu»: the kind of business and where it is.</summary>
    public string? Summary { get; init; }

    public string? PhoneMasked { get; init; }

    public ProviderKind Kind { get; init; }
}

/// <summary>The numbers a seller DTO needs that are not columns.</summary>
public sealed record SellerStats(int ActiveListings, IReadOnlyList<Guid> ServiceIds);

public static class SellerMapping
{
    public static SellerDto ToSellerDto(this Seller s, SellerStats stats, ReadContext read)
    {
        var cover = read.PhotoUrl(s.CoverPhoto);
        var logo = read.PhotoUrl(s.LogoPhoto);
        return new SellerDto
        {
            Id = s.Id.ToString(),
            Slug = s.Slug,
            Name = s.Name,
            Kind = SellerTexts.BusinessKindName(s.BusinessKind, read.Language),
            CityId = s.CityId,
            ActiveListings = stats.ActiveListings,
            Verified = s.VerifiedAt is not null,
            MemberSince = s.CreatedAt.UtcDateTime.Year,
            Image = cover ?? logo ?? string.Empty,
            CoverImage = cover,
            PhoneMasked = PhoneNumbers.Mask(s.Phone ?? s.Owner?.Phone),
            Email = s.Email,
            About = s.About,
            Terms = s.Terms,
            Address = s.Address,
            ContactPerson = s.ContactPerson,
            BusinessKind = s.BusinessKind,
            Logo = logo,
            Hours = s.Hours is { Count: > 0 } hours ? hours : null,
            Whatsapp = s.Whatsapp,
            Instagram = s.Instagram,
            Website = s.Website,
            Location = s.Lat is { } lat && s.Lng is { } lng ? new LocationDto(Money.Trim(lat), Money.Trim(lng)) : null,
            Offers = s.Offers.Count > 0 ? s.Offers.Select(KebabCase.Parse<SellerOffer>).ToList() : null,
            ResponseMinutes = s.ResponseMinutes,
            ServiceIds = stats.ServiceIds.Count > 0 ? stats.ServiceIds.Select(id => id.ToString()).ToList() : null,
        };
    }

    /// <summary>A provider from its account and, for a business, its seller profile.</summary>
    public static ServiceProviderDto ToProviderDto(User owner, Seller? seller, ReadContext read)
    {
        if (seller is null)
        {
            return new ServiceProviderDto
            {
                Id = owner.Id.ToString(),
                Name = owner.FullName,
                Verified = false,
                PhoneMasked = PhoneNumbers.Mask(owner.Phone),
                Kind = ProviderKind.Individual,
            };
        }

        var place = seller.Address ?? read.Taxonomy.CityName(seller.CityId, read.Language);
        return new ServiceProviderDto
        {
            Id = owner.Id.ToString(),
            Name = seller.Name,
            Verified = seller.VerifiedAt is not null,
            SellerId = seller.Id.ToString(),
            Summary = $"{SellerTexts.BusinessKindName(seller.BusinessKind, read.Language)} · {place}",
            PhoneMasked = PhoneNumbers.Mask(seller.Phone ?? owner.Phone),
            Kind = ProviderKind.Company,
        };
    }
}

/// <summary>Seller texts in the request's language. Russian and English are DRAFT translations.</summary>
public static class SellerTexts
{
    /// <summary>«Tingçilik təsərrüfatı», «Bağ mərkəzi», «Landşaft şirkəti» (src/views/RegisterPage.tsx).</summary>
    public static string BusinessKindName(BusinessKind kind, Language language) => (kind, language) switch
    {
        (BusinessKind.Nursery, Language.Ru) => "Питомник растений",
        (BusinessKind.GardenCentre, Language.Ru) => "Садовый центр",
        (BusinessKind.Landscaping, Language.Ru) => "Ландшафтная компания",
        (BusinessKind.Nursery, Language.En) => "Plant nursery",
        (BusinessKind.GardenCentre, Language.En) => "Garden centre",
        (BusinessKind.Landscaping, Language.En) => "Landscaping company",
        (BusinessKind.Nursery, _) => "Tingçilik təsərrüfatı",
        (BusinessKind.GardenCentre, _) => "Bağ mərkəzi",
        _ => "Landşaft şirkəti",
    };
}
