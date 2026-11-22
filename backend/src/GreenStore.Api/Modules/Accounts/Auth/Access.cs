using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Modules.Accounts.Auth;

/// <summary>
/// The one place that decides who may change what (ARCHITECTURE.md §18, decision 1: <c>CanManage</c>). Every owner
/// check of the API goes through here, so branches or staff accounts of a business can be added in one place later.
/// Endpoints of /me act on the caller's own data; a resource that is not the caller's answers 404, not 403, so ids of
/// other people's data cannot be probed.
/// </summary>
public static class Access
{
    /// <summary>Policy names for <c>RequireAuthorization(…)</c>.</summary>
    public const string StaffPolicy = "staff";

    public const string AdminPolicy = "admin";

    /// <summary>May <paramref name="user"/> manage something owned by <paramref name="ownerUserId"/>? Today: only the owner.</summary>
    public static bool CanManage(CurrentUser user, Guid? ownerUserId) => ownerUserId is { } owner && owner == user.UserId;

    /// <summary>Throws the resource's 404 unless <paramref name="user"/> may manage it (null: there is no such resource).</summary>
    public static void EnsureCanManage(CurrentUser user, Guid? ownerUserId, string notFoundCode)
    {
        if (!CanManage(user, ownerUserId))
        {
            throw ApiProblemException.NotFound(notFoundCode);
        }
    }

    /// <summary>Moderators and admins: moderation and reports (phase 3 and 4).</summary>
    public static bool IsStaff(UserRole role) => role is UserRole.Moderator or UserRole.Admin;

    /// <summary>Admins only: categories, verification, blocking (phase 4).</summary>
    public static bool IsAdmin(UserRole role) => role is UserRole.Admin;
}
