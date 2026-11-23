namespace GreenStore.Api.Modules.Admin;

/// <summary>
/// The stable codes of the staff endpoints (ProblemDetails <c>code</c> and field error codes). Clients choose their
/// message by these; a code never changes once released.
/// </summary>
public static class AdminErrors
{
    /// <summary>409: approving a listing of a blocked account (it stays off the site until the account is unblocked).</summary>
    public const string OwnerBlocked = "listing.owner-blocked";

    /// <summary>404: no such category or sub-category.</summary>
    public const string CategoryNotFound = Taxonomy.TaxonomyEndpoints.CategoryNotFound;

    /// <summary>409: listings, sub-categories or requests use the category: deactivate it instead (<c>isActive: false</c>).</summary>
    public const string CategoryInUse = "category.in-use";

    /// <summary>404: no such account (or a deleted one).</summary>
    public const string AccountNotFound = Accounts.AccountErrors.AccountNotFound;

    /// <summary>409: an admin cannot block their own account.</summary>
    public const string CannotBlockSelf = "account.cannot-block-self";

    /* Field error codes */

    /// <summary>Another category under the same parent has this Azerbaijani name, or another category this id.</summary>
    public const string NameTaken = "taken";

    /// <summary>A filter id the category's form has not, or a field a sub-category has not (<c>icon</c>, <c>filters</c>).</summary>
    public const string NotAllowed = "not-allowed";

    public const string Duplicate = "duplicate";

    public const string OutOfRange = "out-of-range";
}
