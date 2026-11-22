namespace GreenStore.Api.Modules.Listings;

/// <summary>What can happen to a stored listing (ARCHITECTURE.md §6).</summary>
public enum ListingAction
{
    /// <summary>The owner sends a changed version («Redaktə et», «Düzəlt»): back to the moderator.</summary>
    Edit,

    /// <summary>The moderator approves the pending version.</summary>
    Approve,

    /// <summary>The moderator rejects the pending version, with a reason.</summary>
    Reject,

    /// <summary>The 30 days are over (the ExpireListings job).</summary>
    Expire,

    /// <summary>«Yenilə (pulsuz)»: an expired listing gets 30 new days, without going to the top.</summary>
    Renew,

    /// <summary>«Deaktiv et»: the owner takes an active listing off the site.</summary>
    Deactivate,

    /// <summary>«Aktiv et»: a deactivated listing goes back on the site.</summary>
    Activate,

    /// <summary>«Sil»: the row stays (<c>deleted_at</c>), the listing is gone for everyone.</summary>
    Delete,
}

/// <summary>
/// The lifecycle fields of a listing: what <see cref="ListingLifecycle"/> reads and writes. The service copies them
/// from and to the entity (<see cref="Of"/>, <see cref="ApplyTo"/>), so the rules stay free of EF and HTTP.
/// </summary>
public sealed record LifecycleState
{
    public ListingStatus Status { get; init; }

    public DateTimeOffset? DeletedAt { get; init; }

    public DateTimeOffset? SubmittedAt { get; init; }

    public DateTimeOffset? EditedAt { get; init; }

    /// <summary>The first approval; set once.</summary>
    public DateTimeOffset? PublishedAt { get; init; }

    public DateTimeOffset? BumpedAt { get; init; }

    public DateTimeOffset? SortAt { get; init; }

    public DateTimeOffset? ExpiresAt { get; init; }

    /// <summary>The end of a running «Önə çıxar»: the listing may not expire before it (ARCHITECTURE.md §6).</summary>
    public DateTimeOffset? PromotedUntil { get; init; }

    public RejectionReason? RejectionReasonCode { get; init; }

    public string? RejectionNote { get; init; }

    public bool IsDeleted => DeletedAt is not null;

    public static LifecycleState Of(Listing l) => new()
    {
        Status = l.Status,
        DeletedAt = l.DeletedAt,
        SubmittedAt = l.SubmittedAt,
        EditedAt = l.EditedAt,
        PublishedAt = l.PublishedAt,
        BumpedAt = l.BumpedAt,
        SortAt = l.SortAt,
        ExpiresAt = l.ExpiresAt,
        PromotedUntil = l.PromotedUntil,
        RejectionReasonCode = l.RejectionReasonCode,
        RejectionNote = l.RejectionNote,
    };

    public void ApplyTo(Listing l)
    {
        l.Status = Status;
        l.DeletedAt = DeletedAt;
        l.SubmittedAt = SubmittedAt;
        l.EditedAt = EditedAt;
        l.PublishedAt = PublishedAt;
        l.BumpedAt = BumpedAt;
        l.SortAt = SortAt;
        l.ExpiresAt = ExpiresAt;
        l.RejectionReasonCode = RejectionReasonCode;
        l.RejectionNote = RejectionNote;
    }
}

/// <summary>A transition the lifecycle does not allow: 409 <c>listing.wrong-status</c>.</summary>
public sealed class ListingTransitionException(ListingStatus status, ListingAction action)
    : Exception($"A {status} listing cannot be {action}d.")
{
    public ListingStatus Status { get; } = status;

    public ListingAction Action { get; } = action;
}

/// <summary>
/// Every status change of a listing, in one place (ARCHITECTURE.md §6). No ASP.NET or EF: the unit tests check every
/// allowed and every forbidden transition.
/// <code>
/// (new) ──submit──► pending ──approve──► active ──30 days──► expired ──renew──► active
///                    │  ▲                 │  ▲
///             reject │  │ edit   deactivate│  │ activate
///                    ▼  │                 ▼  │
///                  rejected              inactive
/// active, expired, inactive, rejected, pending ──edit──► pending      any ──delete──► deleted_at
/// </code>
/// </summary>
public static class ListingLifecycle
{
    /// <summary>A listing's term from approval or renewal.</summary>
    public static readonly TimeSpan Term = TimeSpan.FromDays(30);

    /// <summary>Is <paramref name="action"/> allowed for a listing in <paramref name="status"/> (not deleted)?</summary>
    public static bool Allows(ListingStatus status, ListingAction action) => action switch
    {
        ListingAction.Edit or ListingAction.Delete => true,
        ListingAction.Approve or ListingAction.Reject => status == ListingStatus.Pending,
        ListingAction.Expire or ListingAction.Deactivate => status == ListingStatus.Active,
        ListingAction.Renew => status == ListingStatus.Expired,
        ListingAction.Activate => status == ListingStatus.Inactive,
        _ => false,
    };

    /// <summary>A new listing as «Elan yerləşdir» sends it: pending, waiting for the moderator.</summary>
    public static LifecycleState Submit(DateTimeOffset now) => new() { Status = ListingStatus.Pending, SubmittedAt = now };

    /// <summary>
    /// The state after <paramref name="action"/>. Throws <see cref="ListingTransitionException"/> when the lifecycle
    /// does not allow it; a deleted listing allows nothing. A rejection needs <paramref name="reason"/>.
    /// </summary>
    public static LifecycleState Apply(
        LifecycleState state,
        ListingAction action,
        DateTimeOffset now,
        RejectionReason? reason = null,
        string? note = null)
    {
        if (state.IsDeleted || !Allows(state.Status, action))
        {
            throw new ListingTransitionException(state.Status, action);
        }

        switch (action)
        {
            case ListingAction.Edit:
                // Hidden until the moderator has seen the new version (decision 2); the old reason no longer applies.
                return state with
                {
                    Status = ListingStatus.Pending,
                    SubmittedAt = now,
                    EditedAt = now,
                    RejectionReasonCode = null,
                    RejectionNote = null,
                };

            case ListingAction.Approve:
                {
                    var published = state.PublishedAt ?? now;
                    return state with
                    {
                        Status = ListingStatus.Active,
                        PublishedAt = published,
                        // The first approval puts the listing at the top of «Ən yenilər»; approving an edit does not.
                        SortAt = state.SortAt ?? Latest(published, state.BumpedAt),
                        ExpiresAt = ExpiryFrom(now, state.PromotedUntil),
                        RejectionReasonCode = null,
                        RejectionNote = null,
                    };
                }

            case ListingAction.Reject:
                return state with
                {
                    Status = ListingStatus.Rejected,
                    RejectionReasonCode = reason ?? throw new ArgumentNullException(nameof(reason), "A rejection needs a reason."),
                    RejectionNote = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                };

            case ListingAction.Expire:
                if (state.ExpiresAt is { } expires && expires > now)
                {
                    throw new ListingTransitionException(state.Status, action);
                }

                return state with { Status = ListingStatus.Expired };

            case ListingAction.Renew:
                // Free, and it does not lift the listing (decision 5): sort_at stays.
                return state with
                {
                    Status = ListingStatus.Active,
                    EditedAt = now,
                    ExpiresAt = ExpiryFrom(now, state.PromotedUntil),
                };

            case ListingAction.Deactivate:
                return state with { Status = ListingStatus.Inactive };

            case ListingAction.Activate:
                // The term kept running while it was off the site: past its end, it comes back as expired («Yenilə»).
                return state with { Status = state.ExpiresAt is { } end && end > now ? ListingStatus.Active : ListingStatus.Expired };

            case ListingAction.Delete:
                return state with { DeletedAt = now };

            default:
                throw new ListingTransitionException(state.Status, action);
        }
    }

    /// <summary>30 days from now, but never before a paid «Önə çıxar» ends.</summary>
    public static DateTimeOffset ExpiryFrom(DateTimeOffset now, DateTimeOffset? promotedUntil)
    {
        var term = now + Term;
        return promotedUntil is { } until && until > term ? until : term;
    }

    /// <summary>
    /// May the owner change the category in an edit? Not once the listing was published (turbo.az locks the make and
    /// model the same way): buyers and the statistics know it by its category.
    /// </summary>
    public static bool CategoryLocked(LifecycleState state) => state.PublishedAt is not null;

    private static DateTimeOffset Latest(DateTimeOffset a, DateTimeOffset? b) => b is { } other && other > a ? other : a;
}
