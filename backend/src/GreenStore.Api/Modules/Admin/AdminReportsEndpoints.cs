using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary>
/// Reports for the staff («Şikayətlər», backend-contract.md 3.5 <c>reports</c>, <c>updateReport</c>): moderators and
/// admins see every report with its target as the owner sees it, and move it open → investigating → resolved. Each
/// change is written to <c>audit_log</c> (<c>report.update</c>), which is also the report's history («Qərar
/// tarixçəsi») and keeps the moderator's notes.
/// </summary>
public static class AdminReportsEndpoints
{
    public const int DefaultPageSize = 20;

    public const string AuditAction = "report.update";

    public const string AuditTarget = "report";

    public static RouteGroupBuilder MapAdminReports(this RouteGroupBuilder api)
    {
        var reports = api.MapGroup("/admin/reports").WithTags("Admin").RequireAuthorization(Access.StaffPolicy);
        reports.MapGet("", List);
        reports.MapGet("/{id:guid}", Get);
        reports.MapPatch("/{id:guid}", Update);
        return api;
    }

    /// <summary>
    /// <c>GET /admin/reports?status&amp;target&amp;reason&amp;sort&amp;page&amp;pageSize</c> → <c>PageResult</c> of
    /// reports plus <c>totals</c> (<c>{ open, investigating, resolved }</c>, of every report). Every status unless
    /// <c>status</c> is given; <c>sort</c> <c>newest</c> (the default) or <c>oldest</c>.
    /// </summary>
    private static async Task<Ok<ReportQueueDto>> List(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var status = query.Enum<ReportStatus>("status");
        var target = query.Enum<ReportTarget>("target");
        var reason = query.Enum<ReportReason>("reason");
        var sort = query.Enum<ModerationSort>("sort") ?? ModerationSort.Newest;
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var reports = db.Reports.AsNoTracking();
        if (status is { } s)
        {
            reports = reports.Where(r => r.Status == s);
        }

        if (target is { } t)
        {
            reports = reports.Where(r => r.TargetKind == t);
        }

        if (reason is { } why)
        {
            reports = reports.Where(r => r.ReasonCode == why);
        }

        var ordered = sort == ModerationSort.Oldest
            ? reports.OrderBy(r => r.CreatedAt).ThenBy(r => r.Id)
            : reports.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id);
        var total = await ordered.CountAsync(ct);
        var current = page.Clamp(total);
        var rows = await ordered.Skip((current - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        var items = await ReportReads.ItemsAsync(db, rows, await ReadContext.CreateAsync(http, db, ct), ct);

        var counts = await db.Reports.AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var totals = new ReportTotalsDto(
            counts.GetValueOrDefault(ReportStatus.Open),
            counts.GetValueOrDefault(ReportStatus.Investigating),
            counts.GetValueOrDefault(ReportStatus.Resolved));
        return TypedResults.Ok(new ReportQueueDto(items, total, current, page.PageCount(total), totals));
    }

    /// <summary><c>GET /admin/reports/{id}</c> → one report; 404 <c>report.not-found</c>.</summary>
    private static async Task<Ok<ReportItemDto>> Get(Guid id, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var report = await db.Reports.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw ApiProblemException.NotFound(EngagementErrors.ReportNotFound);
        return TypedResults.Ok((await ReportReads.ItemsAsync(db, [report], await ReadContext.CreateAsync(http, db, ct), ct))[0]);
    }

    /// <summary>
    /// <c>PATCH /admin/reports/{id}</c> <c>{ status?, resolution?, note? }</c> → the report. Resolving needs a
    /// <c>resolution</c> (<c>action-taken</c>, <c>no-violation</c>); reopening clears it. The note (≤ 500) goes into the
    /// history. 400 <c>validation</c>, 404 <c>report.not-found</c>.
    /// </summary>
    private static async Task<Ok<ReportItemDto>> Update(
        Guid id,
        ReportUpdateDto body,
        CurrentUser me,
        HttpContext http,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw ApiProblemException.NotFound(EngagementErrors.ReportNotFound);
        var (change, errors) = ReportRules.Update(body, report.Status, report.Resolution);
        errors.ThrowIfAny();

        var now = clock.GetUtcNow();
        var previous = report.Status;
        report.Status = change!.Status;
        report.Resolution = change.Resolution;
        report.HandledBy = me.UserId;
        report.HandledAt = now;
        Audit.Add(db, me.UserId, AuditAction, AuditTarget, report.Id.ToString(), new ReportAuditData(change.Status, previous, change.Resolution, change.Note), now);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok((await ReportReads.ItemsAsync(db, [report], await ReadContext.CreateAsync(http, db, ct), ct))[0]);
    }
}

/// <summary>What a <c>report.update</c> entry of <c>audit_log</c> holds.</summary>
public sealed record ReportAuditData(ReportStatus Status, ReportStatus Previous, ReportResolution? Resolution, string? Note);

/// <summary>Reports as the staff see them: the target, its owner, the reporter and the history.</summary>
public static class ReportReads
{
    public static async Task<IReadOnlyList<ReportItemDto>> ItemsAsync(AppDbContext db, IReadOnlyList<Report> reports, ReadContext read, CancellationToken ct)
    {
        var listingIds = reports.Where(r => r.ListingId != null).Select(r => r.ListingId!.Value).Distinct().ToList();
        var sellerIds = reports.Where(r => r.SellerId != null).Select(r => r.SellerId!.Value).Distinct().ToList();
        var listings = await db.Listings.AsNoTracking()
            .Where(l => listingIds.Contains(l.Id))
            .WithCardData()
            .ToDictionaryAsync(l => l.Id, ct);
        var sellers = await db.Sellers.AsNoTracking()
            .Where(s => sellerIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var ids = reports.Select(r => r.Id.ToString()).ToList();
        var history = await db.AuditLog.AsNoTracking()
            .Where(e => e.TargetType == AdminReportsEndpoints.AuditTarget && ids.Contains(e.TargetId) && e.Action == AdminReportsEndpoints.AuditAction)
            .OrderBy(e => e.CreatedAt).ThenBy(e => e.Id)
            .ToListAsync(ct);

        var userIds = reports.SelectMany(r => new[] { r.ReporterUserId, r.HandledBy })
            .Concat(history.Select(e => e.ActorUserId))
            .Concat(listings.Values.Select(l => (Guid?)l.OwnerUserId))
            .Concat(sellers.Values.Select(s => (Guid?)s.OwnerUserId))
            .OfType<Guid>()
            .Distinct()
            .ToList();
        var users = await db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);

        var open = await db.Reports.AsNoTracking()
            .Where(r => r.Status != ReportStatus.Resolved && ((r.ListingId != null && listingIds.Contains(r.ListingId.Value)) || (r.SellerId != null && sellerIds.Contains(r.SellerId.Value))))
            .GroupBy(r => r.ListingId ?? r.SellerId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var openByTarget = open.Where(g => g.Key != null).ToDictionary(g => g.Key!.Value, g => g.Count);

        StaffRefDto? Ref(Guid? id) => id is { } userId && users.TryGetValue(userId, out var user) ? new StaffRefDto(user.Id.ToString(), user.FullName) : null;

        return reports.Select(r =>
        {
            var listing = r.ListingId is { } lid ? listings.GetValueOrDefault(lid) : null;
            var seller = r.SellerId is { } sid ? sellers.GetValueOrDefault(sid) : null;
            var ownerId = listing?.OwnerUserId ?? seller?.OwnerUserId;
            var owner = ownerId is { } oid ? users.GetValueOrDefault(oid) : null;
            var entries = history.Where(e => e.TargetId == r.Id.ToString())
                .Select(e => (Entry: e, Data: Read(e.Data)))
                .Where(e => e.Data is not null)
                .Select(e => new ReportHistoryDto(e.Data!.Status, e.Data.Resolution, e.Data.Note, e.Entry.CreatedAt, Ref(e.Entry.ActorUserId)))
                .ToList();
            return new ReportItemDto
            {
                Id = r.Id.ToString(),
                Target = r.TargetKind,
                TargetId = (r.ListingId ?? r.SellerId)!.Value.ToString(),
                Reason = r.ReasonCode,
                Comment = r.Comment,
                Status = r.Status,
                Resolution = r.Resolution,
                CreatedAt = r.CreatedAt,
                HandledAt = r.HandledAt,
                HandledBy = Ref(r.HandledBy),
                Reporter = Ref(r.ReporterUserId),
                Owner = owner is null ? null : new ReportOwnerDto(owner.Id.ToString(), owner.FullName, owner.AccountType, owner.Status),
                Listing = listing?.ToOwnListingDto(read),
                Seller = seller is null ? null : new ReportSellerDto(seller.Id.ToString(), seller.Slug, seller.Name, seller.VerifiedAt is not null),
                TargetDeleted = listing?.DeletedAt is not null,
                OpenReportsOnTarget = (r.ListingId ?? r.SellerId) is { } key ? openByTarget.GetValueOrDefault(key) : 0,
                Note = entries.LastOrDefault(e => e.Note is not null)?.Note,
                History = entries,
            };
        }).ToList();
    }

    private static ReportAuditData? Read(string? json)
    {
        if (json is null)
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<ReportAuditData>(json, ColumnMapping.StorageJson);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

/// <summary>A page of reports, with every report's count by status for the chips.</summary>
public sealed record ReportQueueDto(IReadOnlyList<ReportItemDto> Items, int Total, int Page, int PageCount, ReportTotalsDto Totals);

/// <summary>
/// A report as the staff see it (<c>Complaint</c> of the admin pages, with codes instead of ready texts): the reason
/// code, the reporter's words, the target (a listing or service as its owner sees it, number included, or a seller),
/// the account behind it (to block it), how many open reports the target has, and the history of decisions.
/// </summary>
public sealed record ReportItemDto
{
    public required string Id { get; init; }

    public ReportTarget Target { get; init; }

    /// <summary>The listing's, service's or seller's id.</summary>
    public required string TargetId { get; init; }

    public ReportReason Reason { get; init; }

    public string? Comment { get; init; }

    public ReportStatus Status { get; init; }

    public ReportResolution? Resolution { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? HandledAt { get; init; }

    public StaffRefDto? HandledBy { get; init; }

    /// <summary>The signed-in reporter; a guest has none.</summary>
    public StaffRefDto? Reporter { get; init; }

    /// <summary>The account behind the target.</summary>
    public ReportOwnerDto? Owner { get; init; }

    public OwnListingDto? Listing { get; init; }

    public ReportSellerDto? Seller { get; init; }

    /// <summary>The listing was deleted after the report.</summary>
    public bool TargetDeleted { get; init; }

    /// <summary>Unresolved reports of the same target, this one included.</summary>
    public int OpenReportsOnTarget { get; init; }

    /// <summary>«Moderator qeydi»: the latest note of the history.</summary>
    public string? Note { get; init; }

    /// <summary>Each staff change, oldest first; the report's arrival is <see cref="CreatedAt"/>.</summary>
    public required IReadOnlyList<ReportHistoryDto> History { get; init; }
}

/// <summary>An account named in a staff answer: its id and name.</summary>
public sealed record StaffRefDto(string UserId, string Name);

public sealed record ReportOwnerDto(string UserId, string Name, AccountType AccountType, UserStatus Status);

public sealed record ReportSellerDto(string Id, string Slug, string Name, bool Verified);

/// <summary>One change of a report: the status it got, the resolution, the note, when and by whom.</summary>
public sealed record ReportHistoryDto(ReportStatus Status, ReportResolution? Resolution, string? Note, DateTimeOffset At, StaffRefDto? By);
