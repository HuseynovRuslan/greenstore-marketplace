using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Platform;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// «Elan yerləşdir» and «Elanlarım» (ARCHITECTURE.md §6–7): sending a listing, the owner's listings in every status,
/// editing, renewing, deactivating, activating, deleting, the 14-day statistics and the wizard's server-side drafts.
/// The session decides whose (backend-contract.md 2.2); another account's listing answers 404.
/// </summary>
public static class OwnListingsEndpoints
{
    /// <summary>Days in <c>viewsByDay</c>.</summary>
    public const int StatsDays = 14;

    public static RouteGroupBuilder MapOwnListings(this RouteGroupBuilder api)
    {
        api.MapPost("/listings", Submit).WithTags("Listings").RequireAuthorization()
            .Produces<ListingSubmitResultDto>(StatusCodes.Status201Created);

        var mine = api.MapGroup("/me/listings").WithTags("Me").RequireAuthorization();
        mine.MapGet("", List);
        mine.MapGet("/{id:guid}", Get);
        mine.MapPut("/{id:guid}", Update);
        mine.MapPost("/{id:guid}/renew", (Guid id, CurrentUser me, HttpContext http, AppDbContext db, ListingWriteService writes, CancellationToken ct) =>
            ChangeAsync(id, ListingAction.Renew, me, http, db, writes, ct));
        mine.MapPost("/{id:guid}/deactivate", (Guid id, CurrentUser me, HttpContext http, AppDbContext db, ListingWriteService writes, CancellationToken ct) =>
            ChangeAsync(id, ListingAction.Deactivate, me, http, db, writes, ct));
        mine.MapPost("/{id:guid}/activate", (Guid id, CurrentUser me, HttpContext http, AppDbContext db, ListingWriteService writes, CancellationToken ct) =>
            ChangeAsync(id, ListingAction.Activate, me, http, db, writes, ct));
        mine.MapDelete("/{id:guid}", Delete);
        mine.MapGet("/{id:guid}/stats", Stats);

        var drafts = api.MapGroup("/me/drafts").WithTags("Me").RequireAuthorization();
        drafts.MapGet("", ListDrafts);
        drafts.MapPost("", CreateDraft);
        drafts.MapGet("/{id:guid}", GetDraft);
        drafts.MapPut("/{id:guid}", UpdateDraft);
        drafts.MapDelete("/{id:guid}", DeleteDraft);
        return api;
    }

    /// <summary>
    /// <c>POST /listings</c> <c>ListingInput</c> → 201 <c>{ id, slug, number, status: "pending" }</c>. Takes an
    /// <c>Idempotency-Key</c> header: the same key again answers the same listing. 400 <c>validation</c> (fields of
    /// <c>ListingInput</c>; <c>photoIds</c>: <c>not-found</c>, <c>not-ready</c>, <c>in-use</c>), 422
    /// <c>idempotency.key-reused</c>, 429 <c>listing.daily-limit</c>.
    /// </summary>
    private static Task<IResult> Submit(ListingInputDto body, CurrentUser me, HttpContext http, IdempotentRequests idempotency, ListingWriteService writes, CancellationToken ct) =>
        idempotency.RunAsync(http, me.UserId.ToString(), body, async token => (StatusCodes.Status201Created, await writes.SubmitAsync(me, body, token)), ct);

    /// <summary>
    /// <c>GET /me/listings</c> → <c>Listing[]</c>: every listing of the account in every status but deleted, with the
    /// owner's fields (<c>contactPhone</c>, <c>rejectionReasonCode</c>, <c>version</c>, …), the last changed first.
    /// Drafts are <c>GET /me/drafts</c>.
    /// </summary>
    private static async Task<Ok<List<OwnListingDto>>> List(CurrentUser me, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var rows = await db.Listings.AsNoTracking()
            .Where(l => l.OwnerUserId == me.UserId && l.DeletedAt == null)
            .OrderByDescending(l => l.EditedAt ?? l.PublishedAt ?? l.CreatedAt)
            .ThenByDescending(l => l.Number)
            .WithCardData()
            .ToListAsync(ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(rows.Select(l => l.ToOwnListingDto(read)).ToList());
    }

    /// <summary><c>GET /me/listings/{id}</c> → the owner's <c>Listing</c> (the cabinet's preview, the edit form).</summary>
    private static async Task<Ok<OwnListingDto>> Get(Guid id, CurrentUser me, HttpContext http, AppDbContext db, ListingWriteService writes, CancellationToken ct)
    {
        var listing = await writes.OwnAsync(me, id, ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(listing.ToOwnListingDto(read));
    }

    /// <summary>
    /// <c>PUT /me/listings/{id}</c> <c>ListingInput</c> (+ optional <c>version</c>) → <c>{ id, slug, number, status:
    /// "pending" }</c>. Back to the moderator; the category stays once published (<c>categoryId: locked</c>).
    /// </summary>
    private static async Task<Ok<ListingSubmitResultDto>> Update(Guid id, ListingInputDto body, CurrentUser me, ListingWriteService writes, CancellationToken ct) =>
        TypedResults.Ok(await writes.UpdateAsync(me, id, body, ct));

    /// <summary><c>POST /me/listings/{id}/renew|deactivate|activate</c> → the owner's <c>Listing</c>; 409 <c>listing.wrong-status</c>.</summary>
    private static async Task<Ok<OwnListingDto>> ChangeAsync(Guid id, ListingAction action, CurrentUser me, HttpContext http, AppDbContext db, ListingWriteService writes, CancellationToken ct)
    {
        var listing = await writes.ChangeStatusAsync(me, id, action, ct);
        var read = await ReadContext.CreateAsync(http, db, ct);
        return TypedResults.Ok(listing.ToOwnListingDto(read));
    }

    /// <summary><c>DELETE /me/listings/{id}</c> → 204. The row stays (<c>deleted_at</c>); the listing is gone for everyone.</summary>
    private static async Task<NoContent> Delete(Guid id, CurrentUser me, ListingWriteService writes, CancellationToken ct)
    {
        await writes.ChangeStatusAsync(me, id, ListingAction.Delete, ct);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// <c>GET /me/listings/{id}/stats</c> → <c>ListingStats</c>: the totals and the views of the last 14 days (Baku
    /// time), oldest first, a day without views as 0.
    /// </summary>
    private static async Task<Ok<ListingStatsDto>> Stats(Guid id, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var listing = await db.Listings.AsNoTracking()
            .Where(l => l.Id == id && l.DeletedAt == null)
            .Select(l => new { l.OwnerUserId, l.Counter })
            .FirstOrDefaultAsync(ct);
        Access.EnsureCanManage(me, listing?.OwnerUserId, ListingErrors.NotFound);

        var today = BakuTime.Today(clock.GetUtcNow());
        var first = today.AddDays(-(StatsDays - 1));
        var days = await db.ListingDailyStats.AsNoTracking()
            .Where(s => s.ListingId == id && s.Day >= first && s.Day <= today)
            .ToDictionaryAsync(s => s.Day, s => s.Views, ct);
        var counter = listing!.Counter;
        return TypedResults.Ok(new ListingStatsDto(
            counter?.Views ?? 0,
            counter?.PhoneReveals ?? 0,
            counter?.Favourites ?? 0,
            Enumerable.Range(0, StatsDays)
                .Select(i => first.AddDays(i))
                .Select(day => new DayViewsDto(day.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), days.GetValueOrDefault(day)))
                .ToList()));
    }

    /* Drafts: the wizard's state, stored as it is (DATABASE.md §3.5) */

    /// <summary><c>GET /me/drafts</c> → <c>[{ id, listingId?, data, updatedAt }]</c>, the last changed first.</summary>
    private static async Task<Ok<List<DraftDto>>> ListDrafts(CurrentUser me, AppDbContext db, CancellationToken ct)
    {
        var rows = await db.ListingDrafts.AsNoTracking()
            .Where(d => d.OwnerUserId == me.UserId)
            .OrderByDescending(d => d.UpdatedAt).ThenByDescending(d => d.Id)
            .ToListAsync(ct);
        return TypedResults.Ok(rows.Select(DraftDto.Of).ToList());
    }

    private static async Task<Ok<DraftDto>> GetDraft(Guid id, CurrentUser me, AppDbContext db, CancellationToken ct) =>
        TypedResults.Ok(DraftDto.Of(await OwnDraftAsync(db, me, id, ct)));

    /// <summary>
    /// <c>POST /me/drafts</c> <c>{ data, listingId? }</c> → 201 draft. <c>data</c> is the wizard's JSON object (at most
    /// 64 KB); <c>listingId</c> names the caller's listing it edits. 409 <c>draft.too-many</c>.
    /// </summary>
    private static async Task<Created<DraftDto>> CreateDraft(DraftRequest body, CurrentUser me, AppDbContext db, TimeProvider clock, IOptions<ListingsOptions> options, CancellationToken ct)
    {
        var data = DraftData(body, options.Value);
        if (body.ListingId is { } listingId)
        {
            var owner = await db.Listings.Where(l => l.Id == listingId && l.DeletedAt == null).Select(l => (Guid?)l.OwnerUserId).FirstOrDefaultAsync(ct);
            if (!Access.CanManage(me, owner))
            {
                throw ApiProblemException.Validation("listingId", FieldErrors.Invalid);
            }
        }

        if (await db.ListingDrafts.CountAsync(d => d.OwnerUserId == me.UserId, ct) >= options.Value.MaxDraftsPerUser)
        {
            throw ApiProblemException.Conflict(ListingErrors.TooManyDrafts);
        }

        var draft = new ListingDraft { Id = Ids.New(clock), OwnerUserId = me.UserId, ListingId = body.ListingId, Data = data, UpdatedAt = clock.GetUtcNow() };
        db.ListingDrafts.Add(draft);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"{ApiRoutes.Prefix}/me/drafts/{draft.Id}", DraftDto.Of(draft));
    }

    /// <summary><c>PUT /me/drafts/{id}</c> <c>{ data }</c> → the draft (autosave).</summary>
    private static async Task<Ok<DraftDto>> UpdateDraft(Guid id, DraftRequest body, CurrentUser me, AppDbContext db, IOptions<ListingsOptions> options, CancellationToken ct)
    {
        var draft = await OwnDraftAsync(db, me, id, ct);
        draft.Data = DraftData(body, options.Value);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(DraftDto.Of(draft));
    }

    private static async Task<NoContent> DeleteDraft(Guid id, CurrentUser me, AppDbContext db, CancellationToken ct)
    {
        var draft = await OwnDraftAsync(db, me, id, ct);
        db.ListingDrafts.Remove(draft);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<ListingDraft> OwnDraftAsync(AppDbContext db, CurrentUser me, Guid id, CancellationToken ct)
    {
        var draft = await db.ListingDrafts.FirstOrDefaultAsync(d => d.Id == id, ct);
        Access.EnsureCanManage(me, draft?.OwnerUserId, ListingErrors.DraftNotFound);
        return draft!;
    }

    private static string DraftData(DraftRequest body, ListingsOptions options)
    {
        if (body.Data is not { ValueKind: JsonValueKind.Object } data)
        {
            throw ApiProblemException.Validation("data", body.Data is null ? FieldErrors.Required : FieldErrors.Invalid);
        }

        var text = data.GetRawText();
        if (System.Text.Encoding.UTF8.GetByteCount(text) > options.MaxDraftBytes)
        {
            throw ApiProblemException.Validation("data", FieldErrors.TooLong);
        }

        return text;
    }
}

/// <summary><c>ListingStats</c> of src/types.</summary>
public sealed record ListingStatsDto(int Views, int PhoneReveals, int Favourites, IReadOnlyList<DayViewsDto> ViewsByDay);

/// <summary>One day of the chart: <c>{ date: "2026-11-22", views }</c>.</summary>
public sealed record DayViewsDto(string Date, int Views);

public sealed record DraftRequest(JsonElement? Data = null, Guid? ListingId = null);

/// <summary>A server-side draft of «Elan yerləşdir»: the wizard's own JSON, untouched.</summary>
public sealed record DraftDto(string Id, string? ListingId, JsonElement Data, DateTimeOffset UpdatedAt)
{
    public static DraftDto Of(ListingDraft draft)
    {
        using var document = JsonDocument.Parse(draft.Data);
        return new DraftDto(draft.Id.ToString(), draft.ListingId?.ToString(), document.RootElement.Clone(), draft.UpdatedAt);
    }
}
