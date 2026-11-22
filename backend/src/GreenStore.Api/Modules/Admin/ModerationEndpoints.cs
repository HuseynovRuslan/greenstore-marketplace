using System.Text.Json.Serialization;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary>Where a listing is in moderation (<c>ModerationStatus</c> of src/data/admin.ts).</summary>
public enum ModerationStatus
{
    /// <summary>Waiting: status <c>pending</c>.</summary>
    Pending,

    /// <summary>On the site, or was: <c>active</c>, <c>expired</c>, <c>inactive</c>.</summary>
    Approved,

    Rejected,
}

/// <summary>«Yoxlamada» (the first version) or «Təkrar yoxlama» (a later one): <c>ModerationKind</c> of src/data/admin.ts.</summary>
public enum ModerationKind
{
    New,
    Recheck,
}

/// <summary>Queue order: «Əvvəl ən yenilər» / «Əvvəl ən köhnələr», by the time the version was sent.</summary>
public enum ModerationSort
{
    Newest,
    Oldest,
}

/// <summary>
/// The moderation queue and decisions (ARCHITECTURE.md §6–7, backend-contract.md 3.5). Staff only (moderators and
/// admins). Each item carries the listing as its owner sees it (the number included: staff see numbers), whether the
/// number is the account's verified one, and what changed since the last approved version. A decision names the
/// <c>version</c> the moderator saw: when the owner edited the listing or another moderator decided in between, the
/// decision is refused (409) instead of approving what nobody checked.
/// </summary>
public static class ModerationEndpoints
{
    public const int DefaultPageSize = 20;

    public const string NoteRequired = "required";

    public static RouteGroupBuilder MapModeration(this RouteGroupBuilder api)
    {
        var moderation = api.MapGroup("/admin/moderation").WithTags("Admin").RequireAuthorization(Access.StaffPolicy);
        moderation.MapGet("", Queue);
        moderation.MapGet("/{listingId:guid}", Item);
        moderation.MapPost("/{listingId:guid}/decision", Decide);
        return api;
    }

    /// <summary>
    /// <c>GET /admin/moderation?status&amp;kind&amp;sort&amp;q&amp;page&amp;pageSize</c> → <c>PageResult&lt;ModerationItem&gt;</c>
    /// plus <c>totals</c> (<c>{ pending, recheck, approved, rejected }</c>). <c>status</c> defaults to <c>pending</c>,
    /// <c>sort</c> to <c>newest</c>; <c>q</c> is a listing number or words of the title.
    /// </summary>
    private static async Task<Ok<ModerationQueueDto>> Queue(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var status = query.Enum<ModerationStatus>("status") ?? ModerationStatus.Pending;
        var kind = query.Enum<ModerationKind>("kind");
        var sort = query.Enum<ModerationSort>("sort") ?? ModerationSort.Newest;
        var text = query.String("q");
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var listings = InStatus(db, status);
        if (kind is { } wanted)
        {
            listings = wanted == ModerationKind.New
                ? listings.Where(l => (db.ListingRevisions.Where(r => r.ListingId == l.Id).Max(r => (int?)r.Revision) ?? 1) <= 1)
                : listings.Where(l => (db.ListingRevisions.Where(r => r.ListingId == l.Id).Max(r => (int?)r.Revision) ?? 1) > 1);
        }

        if (text is not null)
        {
            listings = ListingSlug.TryGetNumber(text, out var number) && text.All(char.IsAsciiDigit)
                ? listings.Where(l => l.Number == number)
                : listings.Matching(text);
        }

        var ordered = sort == ModerationSort.Oldest
            ? listings.OrderBy(l => l.SubmittedAt ?? l.CreatedAt).ThenBy(l => l.Number)
            : listings.OrderByDescending(l => l.SubmittedAt ?? l.CreatedAt).ThenByDescending(l => l.Number);

        var total = await ordered.CountAsync(ct);
        var current = page.Clamp(total);
        var rows = await ordered.Skip((current - 1) * page.PageSize).Take(page.PageSize)
            .WithCardData().Include(l => l.Owner)
            .ToListAsync(ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        var items = await ModerationReads.ItemsAsync(db, rows, read, ct);

        var pending = InStatus(db, ModerationStatus.Pending);
        var totals = new ModerationTotalsDto(
            await pending.CountAsync(ct),
            await pending.CountAsync(l => (db.ListingRevisions.Where(r => r.ListingId == l.Id).Max(r => (int?)r.Revision) ?? 1) > 1, ct),
            await InStatus(db, ModerationStatus.Approved).CountAsync(ct),
            await InStatus(db, ModerationStatus.Rejected).CountAsync(ct));
        return TypedResults.Ok(new ModerationQueueDto(items, total, current, page.PageCount(total), totals));
    }

    /// <summary><c>GET /admin/moderation/{listingId}</c> → one <c>ModerationItem</c> (any status but deleted).</summary>
    private static async Task<Ok<ModerationItemDto>> Item(Guid listingId, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var listing = await db.Listings.AsNoTracking()
            .Where(l => l.Id == listingId && l.DeletedAt == null)
            .WithCardData().Include(l => l.Owner)
            .FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(ListingErrors.NotFound);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok((await ModerationReads.ItemsAsync(db, [listing], read, ct))[0]);
    }

    /// <summary>
    /// <c>POST /admin/moderation/{listingId}/decision</c> <c>{ decision: "approve" | "reject", reasonCode?, note?,
    /// version }</c> → <c>{ listingId, decision, status, version }</c>. Approving puts the listing on the site for 30
    /// days; rejecting needs a reason code (and a note for <c>other</c>). 400 <c>validation</c>, 404, 409
    /// <c>concurrency-conflict</c> (the listing changed since <c>version</c>), 409 <c>listing.wrong-status</c> (not
    /// pending). Written to <c>audit_log</c>.
    /// </summary>
    private static async Task<Ok<ModerationDecisionResultDto>> Decide(
        Guid listingId,
        DecisionRequest body,
        CurrentUser me,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var errors = new FieldErrors();
        var note = (body.Note ?? body.Explanation)?.Trim();
        if (string.IsNullOrEmpty(note))
        {
            note = null;
        }

        errors.Add("decision", body.Decision is null ? FieldErrors.Required : null);
        uint version = 0;
        errors.Add("version", body.Version is null ? FieldErrors.Required : RowVersion.TryParse(body.Version, out version) ? null : FieldErrors.Invalid);
        if (body.Decision == ModerationVerdict.Reject)
        {
            errors.Add("reasonCode", body.ReasonCode is null ? FieldErrors.Required : null);
            errors.Add("note", body.ReasonCode == RejectionReason.Other && note is null ? NoteRequired : null);
        }

        errors.Add("note", note is { Length: > 500 } ? FieldErrors.TooLong : null);
        errors.ThrowIfAny();

        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var listing = await db.Listings
            .Include(l => l.Photos.OrderBy(p => p.Position))
            .Include(l => l.Seller)
            .AsSplitQuery()
            .FirstOrDefaultAsync(l => l.Id == listingId && l.DeletedAt == null, ct)
            ?? throw ApiProblemException.NotFound(ListingErrors.NotFound);
        if (listing.Version != version)
        {
            throw ApiProblemException.Conflict(ErrorCodes.ConcurrencyConflict);
        }

        db.SetExpectedVersion(listing, version);
        var approve = body.Decision == ModerationVerdict.Approve;
        var next = ListingLifecycle.Apply(
            LifecycleState.Of(listing),
            approve ? ListingAction.Approve : ListingAction.Reject,
            now,
            approve ? null : body.ReasonCode,
            approve ? null : note);

        // The version decided is the newest one sent. Listings from before revisions existed (the demo data) get
        // theirs written now, so the decision has a version to point at.
        var revision = await db.ListingRevisions.Where(r => r.ListingId == listing.Id).MaxAsync(r => (int?)r.Revision, ct);
        if (revision is null)
        {
            revision = 1;
            db.ListingRevisions.Add(new ListingRevision { ListingId = listing.Id, Revision = 1, Data = ListingContent.Of(listing), CreatedAt = now });
        }

        next.ApplyTo(listing);
        db.ModerationDecisions.Add(new ModerationDecision
        {
            Id = Ids.New(clock),
            ListingId = listing.Id,
            Revision = revision.Value,
            ModeratorId = me.UserId,
            Decision = body.Decision!.Value,
            ReasonCode = approve ? null : body.ReasonCode,
            Note = note,
            CreatedAt = now,
        });
        Audit.Add(
            db,
            me.UserId,
            approve ? "listing.approve" : "listing.reject",
            "listing",
            listing.Id.ToString(),
            new AuditDecision(listing.Number, revision.Value, approve ? null : body.ReasonCode, note),
            now);
        if (approve)
        {
            Revalidation.Enqueue(db, Revalidation.TagsFor(listing, listing.Seller?.Slug), now);
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new ModerationDecisionResultDto(listing.Id.ToString(), body.Decision.Value, listing.Status, RowVersion.Format(listing.Version)));
    }

    private static IQueryable<Listing> InStatus(AppDbContext db, ModerationStatus status)
    {
        var listings = db.Listings.AsNoTracking().Where(l => l.DeletedAt == null);
        return status switch
        {
            ModerationStatus.Pending => listings.Where(l => l.Status == ListingStatus.Pending),
            ModerationStatus.Rejected => listings.Where(l => l.Status == ListingStatus.Rejected),
            _ => listings.Where(l => l.Status == ListingStatus.Active || l.Status == ListingStatus.Expired || l.Status == ListingStatus.Inactive),
        };
    }

    private sealed record AuditDecision(long Number, int Revision, RejectionReason? ReasonCode, string? Note);
}

/// <summary>The queue's items: what the review panel shows.</summary>
public static class ModerationReads
{
    public static async Task<IReadOnlyList<ModerationItemDto>> ItemsAsync(AppDbContext db, IReadOnlyList<Listing> listings, ReadContext read, CancellationToken ct)
    {
        var ids = listings.Select(l => l.Id).ToList();
        var revisions = await db.ListingRevisions.AsNoTracking()
            .Where(r => ids.Contains(r.ListingId))
            .ToListAsync(ct);
        var decisions = await db.ModerationDecisions.AsNoTracking()
            .Where(d => ids.Contains(d.ListingId))
            .OrderByDescending(d => d.CreatedAt).ThenByDescending(d => d.Id)
            .ToListAsync(ct);
        var sellerIds = listings.Where(l => l.SellerId != null).Select(l => l.SellerId!.Value).Distinct().ToList();
        var activeBySeller = await db.Listings
            .Where(l => l.SellerId != null && sellerIds.Contains(l.SellerId.Value) && l.Status == ListingStatus.Active && l.DeletedAt == null)
            .GroupBy(l => l.SellerId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);

        return listings.Select(l =>
        {
            var own = revisions.Where(r => r.ListingId == l.Id).OrderBy(r => r.Revision).ToList();
            var latest = own.LastOrDefault();
            var listingDecisions = decisions.Where(d => d.ListingId == l.Id).ToList();
            var approvedRevision = listingDecisions.FirstOrDefault(d => d.Decision == ModerationVerdict.Approve)?.Revision;
            // Without a recorded approval, a listing that was published (the demo data) counts its first version as
            // the approved one.
            approvedRevision ??= l.PublishedAt is not null && own.Count > 1 ? own[0].Revision : null;
            var baseline = approvedRevision is { } approved && latest is not null && approved < latest.Revision
                ? own.FirstOrDefault(r => r.Revision == approved)
                : null;
            var changes = baseline is not null ? RevisionDiff.Compare(baseline.Data, latest!.Data) : [];
            var last = listingDecisions.FirstOrDefault();
            var seller = l.Seller;
            return new ModerationItemDto
            {
                Id = l.Id.ToString(),
                ListingId = l.Id.ToString(),
                Number = l.Number,
                Title = l.Title,
                SellerName = seller?.Name ?? l.Owner?.FullName ?? string.Empty,
                SubmittedAt = l.SubmittedAt ?? l.CreatedAt,
                CategoryId = l.CategoryId,
                Kind = (latest?.Revision ?? 1) > 1 ? ModerationKind.Recheck : ModerationKind.New,
                Status = l.Status switch
                {
                    ListingStatus.Pending => ModerationStatus.Pending,
                    ListingStatus.Rejected => ModerationStatus.Rejected,
                    _ => ModerationStatus.Approved,
                },
                Revision = latest?.Revision ?? 1,
                Version = RowVersion.Format(l.Version),
                ContactPhoneVerified = l.ContactPhoneVerified,
                PhotoCount = l.Photos.Count,
                Seller = new ModerationSellerDto
                {
                    UserId = l.OwnerUserId.ToString(),
                    SellerId = seller?.Id.ToString(),
                    Name = seller?.Name ?? l.Owner?.FullName ?? string.Empty,
                    AccountType = l.Owner?.AccountType ?? Accounts.AccountType.Individual,
                    Verified = seller?.VerifiedAt is not null,
                    ActiveListings = seller is null ? 0 : activeBySeller.GetValueOrDefault(seller.Id),
                    MemberSince = (seller?.CreatedAt ?? l.Owner?.CreatedAt)?.Year,
                },
                Listing = l.ToOwnListingDto(read),
                Changes = changes,
                LastDecision = last is null ? null : new ModerationDecisionDto(last.Decision, last.ReasonCode, last.Note, last.CreatedAt),
            };
        }).ToList();
    }
}

/// <summary>A queue page: <c>PageResult&lt;ModerationItem&gt;</c> plus the totals of the header and the chips.</summary>
public sealed record ModerationQueueDto(IReadOnlyList<ModerationItemDto> Items, int Total, int Page, int PageCount, ModerationTotalsDto Totals);

/// <summary>«12 gözləyən elan · 3 təkrar yoxlama», «Təsdiqlənmiş · 146», «Rədd edilmiş · 8».</summary>
public sealed record ModerationTotalsDto(int Pending, int Recheck, int Approved, int Rejected);

/// <summary>
/// <c>ModerationItem</c> of src/data/admin.ts (to move to src/types, backend-contract.md 3.5), with what the review
/// panel needs instead of ready texts: the listing itself, the seller, the changes and the last decision.
/// </summary>
public sealed record ModerationItemDto
{
    /// <summary>The listing's id (the queue has one item per listing).</summary>
    public required string Id { get; init; }

    public required string ListingId { get; init; }

    public long Number { get; init; }

    public required string Title { get; init; }

    public required string SellerName { get; init; }

    public DateTimeOffset SubmittedAt { get; init; }

    public required string CategoryId { get; init; }

    public ModerationKind Kind { get; init; }

    public ModerationStatus Status { get; init; }

    /// <summary>The version sent last (1, 2, …).</summary>
    public int Revision { get; init; }

    /// <summary>Send back with the decision.</summary>
    public required string Version { get; init; }

    /// <summary>False: «Əlaqə nömrəsi təsdiqlənməyib» (decision 3).</summary>
    public bool ContactPhoneVerified { get; init; }

    public int PhotoCount { get; init; }

    public required ModerationSellerDto Seller { get; init; }

    /// <summary>The listing as its owner sees it, the number included.</summary>
    public required OwnListingDto Listing { get; init; }

    /// <summary>What changed since the last approved version; empty for a first version.</summary>
    public required IReadOnlyList<FieldChange> Changes { get; init; }

    public ModerationDecisionDto? LastDecision { get; init; }
}

public sealed record ModerationSellerDto
{
    public required string UserId { get; init; }

    public string? SellerId { get; init; }

    public required string Name { get; init; }

    public Accounts.AccountType AccountType { get; init; }

    /// <summary>«Təsdiqlənmiş biznes».</summary>
    public bool Verified { get; init; }

    /// <summary>The business's active listings («24 aktiv elan»); 0 for an individual.</summary>
    public int ActiveListings { get; init; }

    public int? MemberSince { get; init; }
}

public sealed record ModerationDecisionDto(ModerationVerdict Decision, RejectionReason? ReasonCode, string? Note, DateTimeOffset CreatedAt);

/// <summary>
/// <c>decide(listingId, { decision, reasonCode?, explanation?, version })</c> of backend-contract.md 3.5. The moderator's
/// words are <c>note</c> (<c>explanation</c> is taken as the same).
/// </summary>
public sealed record DecisionRequest
{
    public ModerationVerdict? Decision { get; init; }

    public RejectionReason? ReasonCode { get; init; }

    public string? Note { get; init; }

    [JsonPropertyName("explanation")]
    public string? Explanation { get; init; }

    public string? Version { get; init; }
}

public sealed record ModerationDecisionResultDto(string ListingId, ModerationVerdict Decision, ListingStatus Status, string Version);
