using System.Text.Json.Serialization;
using GreenStore.Api.Common.Localization;

// The phase 0 stand-ins for the contract's unions, used by the JSON convention tests. Their own namespace keeps them
// apart from the real enums of the modules (GreenStore.Api.Modules.*), which have the same names.
namespace GreenStore.Api.Tests.Infrastructure.Samples;

/// <summary>
/// A DTO shaped like the contract: TypeScript unions as enums, optional fields (`= null`, like `sun?:` in
/// TypeScript), a UTC date, a LocalizedText.
/// </summary>
public sealed record SampleDto(
    Guid Id,
    string Title,
    RootSystem RootSystem,
    BusinessKind BusinessKind,
    PromotionPackageId PackageId,
    ListingStatus Status,
    PriceUnit PriceUnit,
    DateTimeOffset PublishedAt,
    int Stock,
    LocalizedText Name,
    SunNeed? Sun = null,
    string? Area = null);

/// <summary>The C# side of the unions in src/types/index.ts.</summary>
public enum RootSystem
{
    Container,
    Rootball,
    BareRoot,
}

public enum SunNeed
{
    FullSun,
    PartShade,
    Shade,
}

public enum BusinessKind
{
    Nursery,
    GardenCentre,
    Landscaping,
}

public enum PromotionPackageId
{
    OneCixar,
    IreliCek,
    Paket,
}

public enum ListingStatus
{
    Active,
    Pending,
    Rejected,
    Expired,
    Inactive,
    Draft,
}

public enum IconName
{
    Trees,
    [JsonStringEnumMemberName("flower-2")]
    Flower2,
    Flower,
}

public enum PriceUnit
{
    Piece,
    Kg,
    Litre,
    Sqm,
    Bag,
    Set,
    Metre,
    Hour,
    Job,
}
