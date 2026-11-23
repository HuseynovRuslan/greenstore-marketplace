namespace GreenStore.Api.Modules.Listings;

// The C# side of the unions in src/types/index.ts. JSON and the database use the kebab-case names
// (ContractShapeTests compares them with src/types).

/// <summary>
/// The statuses a stored listing has (<c>ListingStatus</c> in src/types). The contract's <c>draft</c> is not here:
/// drafts live in <c>listing_drafts</c> (phase 3), never in <c>listings</c>.
/// </summary>
public enum ListingStatus
{
    Pending,
    Active,
    Rejected,
    Expired,
    Inactive,
}

public enum PriceType
{
    Fixed,
    Negotiable,
    Agreement,
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

/// <summary>«Satışdadır» / «Sifarişlə».</summary>
public enum Availability
{
    InStock,
    OnOrder,
}

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

public enum WaterNeed
{
    Low,
    Medium,
    High,
}

public enum Foliage
{
    Evergreen,
    Deciduous,
}

/// <summary>A moderator's reason for rejecting (backend-contract.md 3.5).</summary>
public enum RejectionReason
{
    WrongCategory,
    WrongPrice,
    UnverifiedContact,
    BadPhotos,
    Duplicate,
    Other,
}

/// <summary>Sort orders of the catalogue (<c>ListingSort</c> in src/services/listingSort.ts).</summary>
public enum ListingSort
{
    Newest,
    PriceAsc,
    PriceDesc,
}
