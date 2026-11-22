using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary>The admin home (<c>/idareetme</c>): the numbers behind each section's tab, for moderators and admins.</summary>
public static class AdminOverviewEndpoints
{
    /// <summary>«Bu həftə»: accounts, requests and messages of the last 7 days.</summary>
    public const int RecentDays = 7;

    public static RouteGroupBuilder MapAdminOverview(this RouteGroupBuilder api)
    {
        api.MapGet("/admin/overview", Overview).WithTags("Admin").RequireAuthorization(Access.StaffPolicy);
        return api;
    }

    /// <summary>
    /// <c>GET /admin/overview</c> → <c>{ moderation, reports, listings, users, sellers, serviceRequests, support,
    /// categories }</c>: the moderation queue's totals (as <c>GET /admin/moderation</c> has them), reports by status,
    /// listings by status, accounts, businesses, «Usta çağır» requests (<c>unrouted</c>: no provider got them), support
    /// messages by status, and categories. Deleted listings and accounts are not counted.
    /// </summary>
    private static async Task<Ok<AdminOverviewDto>> Overview(AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var since = clock.GetUtcNow().AddDays(-RecentDays);

        var reports = await db.Reports.AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var listings = await db.Listings.AsNoTracking()
            .Where(l => l.DeletedAt == null)
            .GroupBy(l => l.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var support = await db.SupportMessages.AsNoTracking()
            .GroupBy(m => m.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

        var users = db.Users.AsNoTracking().Where(u => u.Status != UserStatus.Deleted);
        var requests = db.ServiceRequests.AsNoTracking();
        return TypedResults.Ok(new AdminOverviewDto(
            await ModerationEndpoints.TotalsAsync(db, ct),
            new ReportTotalsDto(
                reports.GetValueOrDefault(ReportStatus.Open),
                reports.GetValueOrDefault(ReportStatus.Investigating),
                reports.GetValueOrDefault(ReportStatus.Resolved)),
            new ListingTotalsDto(
                listings.GetValueOrDefault(ListingStatus.Active),
                listings.GetValueOrDefault(ListingStatus.Pending),
                listings.GetValueOrDefault(ListingStatus.Rejected),
                listings.GetValueOrDefault(ListingStatus.Expired),
                listings.GetValueOrDefault(ListingStatus.Inactive)),
            new UserTotalsDto(
                await users.CountAsync(ct),
                await users.CountAsync(u => u.AccountType == AccountType.Individual, ct),
                await users.CountAsync(u => u.AccountType == AccountType.Business, ct),
                await users.CountAsync(u => u.Status == UserStatus.Blocked, ct),
                await users.CountAsync(u => u.Role != UserRole.User, ct),
                await users.CountAsync(u => u.CreatedAt > since, ct)),
            new SellerTotalsDto(
                await db.Sellers.CountAsync(ct),
                await db.Sellers.CountAsync(s => s.VerifiedAt != null, ct)),
            new ServiceRequestTotalsDto(
                await requests.CountAsync(ct),
                await requests.CountAsync(r => r.CreatedAt > since, ct),
                await requests.CountAsync(r => r.Status == ServiceRequestStatus.New, ct)),
            new SupportTotalsDto(
                support.GetValueOrDefault(SupportStatus.New),
                support.GetValueOrDefault(SupportStatus.Answered),
                support.GetValueOrDefault(SupportStatus.Closed)),
            new CategoryTotalsDto(
                await db.Categories.CountAsync(c => c.ParentId == null, ct),
                await db.Categories.CountAsync(c => c.ParentId == null && c.IsActive, ct),
                await db.Categories.CountAsync(c => c.ParentId != null, ct))));
    }
}

/// <summary>The admin home's numbers.</summary>
public sealed record AdminOverviewDto(
    ModerationTotalsDto Moderation,
    ReportTotalsDto Reports,
    ListingTotalsDto Listings,
    UserTotalsDto Users,
    SellerTotalsDto Sellers,
    ServiceRequestTotalsDto ServiceRequests,
    SupportTotalsDto Support,
    CategoryTotalsDto Categories);

/// <summary>«7 açıq şikayət · 2 araşdırılır · 18 həll olunub».</summary>
public sealed record ReportTotalsDto(int Open, int Investigating, int Resolved);

/// <summary>Listings by status, deleted ones left out.</summary>
public sealed record ListingTotalsDto(int Active, int Pending, int Rejected, int Expired, int Inactive);

/// <summary>Accounts that are not deleted; <c>staff</c>: moderators and admins; <c>newThisWeek</c>: the last 7 days.</summary>
public sealed record UserTotalsDto(int Total, int Individual, int Business, int Blocked, int Staff, int NewThisWeek);

/// <summary>Business profiles («mağaza»), and how many are «Təsdiqlənmiş satıcı».</summary>
public sealed record SellerTotalsDto(int Total, int Verified);

/// <summary>«Usta çağır»: all, the last 7 days, and those no provider got (<c>unrouted</c>).</summary>
public sealed record ServiceRequestTotalsDto(int Total, int ThisWeek, int Unrouted);

public sealed record SupportTotalsDto(int New, int Answered, int Closed);

/// <summary>Categories (active ones too) and sub-categories.</summary>
public sealed record CategoryTotalsDto(int Total, int Active, int Subcategories);
