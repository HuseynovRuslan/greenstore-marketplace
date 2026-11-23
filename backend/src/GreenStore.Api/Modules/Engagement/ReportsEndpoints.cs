using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>What <c>POST /reports</c> answers (<c>submitReport</c> of the contract).</summary>
public sealed record ReportCreatedDto(string Id);

/// <summary>
/// «Şikayət et» (backend-contract.md 4.1): anyone may report a public listing, service or seller, signed in or not,
/// limited per IP. Staff see the reports in <c>/admin/reports</c>.
/// </summary>
public static class ReportsEndpoints
{
    public static RouteGroupBuilder MapReports(this RouteGroupBuilder api)
    {
        api.MapPost("/reports", Submit).WithTags("Engagement").RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        return api;
    }

    /// <summary>
    /// <c>POST /reports</c> <c>{ target, targetId, reason, comment? }</c> → 201 <c>{ id }</c>. The target must be on the
    /// site (404 <c>listing.not-found</c>, <c>service.not-found</c>, <c>seller.not-found</c>); <c>reason</c> one of the
    /// target's codes; <c>other</c> needs a comment. The same reporter's unresolved report of the same target and reason
    /// is answered again (200, its id) instead of being written twice. 429 <c>rate-limited</c> per IP.
    /// </summary>
    private static async Task<Results<Created<ReportCreatedDto>, Ok<ReportCreatedDto>>> Submit(
        ReportInputDto body,
        HttpContext http,
        AppDbContext db,
        ServerHash hash,
        TimeProvider clock,
        CancellationToken ct)
    {
        var (submission, errors) = ReportRules.Validate(body);
        errors.ThrowIfAny();
        var report = submission!;

        Guid? listingId = null;
        Guid? sellerId = null;
        if (report.Target == ReportTarget.Seller)
        {
            var exists = await db.Sellers.AnyAsync(s => s.Id == report.TargetId && s.Owner!.Status == UserStatus.Active, ct);
            sellerId = exists ? report.TargetId : throw ApiProblemException.NotFound(SellersEndpoints.SellerNotFound);
        }
        else
        {
            var kind = report.Target == ReportTarget.Service ? CategoryKind.Service : CategoryKind.Product;
            var exists = await db.Listings.Public(kind).AnyAsync(l => l.Id == report.TargetId, ct);
            listingId = exists
                ? report.TargetId
                : throw ApiProblemException.NotFound(kind == CategoryKind.Service ? ServicesEndpoints.NotFound : ListingErrors.NotFound);
        }

        var me = CurrentUser.Of(http);
        var ip = hash.Ip(http.GetClientIp().Address);
        var reporter = me?.UserId;
        var same = db.Reports.Where(r =>
            r.Status != ReportStatus.Resolved
            && r.ReasonCode == report.Reason
            && r.ListingId == listingId
            && r.SellerId == sellerId);
        same = reporter is { } userId
            ? same.Where(r => r.ReporterUserId == userId)
            : same.Where(r => r.ReporterUserId == null && r.ReporterIpHash == ip);
        if (await same.Select(r => (Guid?)r.Id).FirstOrDefaultAsync(ct) is { } existing)
        {
            return TypedResults.Ok(new ReportCreatedDto(existing.ToString()));
        }

        var row = new Report
        {
            Id = Ids.New(clock),
            TargetKind = report.Target,
            ListingId = listingId,
            SellerId = sellerId,
            ReasonCode = report.Reason,
            Comment = report.Comment,
            ReporterUserId = reporter,
            ReporterIpHash = ip,
            Status = ReportStatus.Open,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Reports.Add(row);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created((string?)null, new ReportCreatedDto(row.Id.ToString()));
    }
}
