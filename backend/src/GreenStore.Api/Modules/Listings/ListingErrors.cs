namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The stable codes of the listing lifecycle endpoints (ProblemDetails <c>code</c> and field error codes). Clients
/// choose their message by these; a code never changes once released.
/// </summary>
public static class ListingErrors
{
    /// <summary>404: no such listing, or not the caller's (the same answer, so ids cannot be probed).</summary>
    public const string NotFound = ListingsEndpoints.NotFound;

    /// <summary>409: the action is not allowed in the listing's status (<c>listingStatus</c> says which it is).</summary>
    public const string WrongStatus = "listing.wrong-status";

    /// <summary>429: the account sent <see cref="ListingsOptions.MaxSubmissionsPerDay"/> listings in the last 24 hours.</summary>
    public const string DailyLimit = "listing.daily-limit";

    public const string DraftNotFound = "draft.not-found";

    /// <summary>409: the account keeps <see cref="ListingsOptions.MaxDraftsPerUser"/> drafts already.</summary>
    public const string TooManyDrafts = "draft.too-many";

    /* Field error codes of photoIds */

    /// <summary>A photo id that is not one of the caller's photos.</summary>
    public const string PhotoNotFound = "not-found";

    /// <summary>A photo still waiting for its file, or one whose file was refused.</summary>
    public const string PhotoNotReady = "not-ready";

    /// <summary>A photo of another listing.</summary>
    public const string PhotoInUse = "in-use";
}

/// <summary>Listing settings (section "Listings").</summary>
public sealed class ListingsOptions
{
    public const string Section = "Listings";

    /// <summary>New listings one account may send in 24 hours (spam protection; edits do not count).</summary>
    public int MaxSubmissionsPerDay { get; set; } = 30;

    /// <summary>Server-side drafts one account keeps.</summary>
    public int MaxDraftsPerUser { get; set; } = 20;

    /// <summary>The largest draft (the wizard's JSON), in bytes.</summary>
    public int MaxDraftBytes { get; set; } = 64 * 1024;
}
