using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Yadda saxlanılan axtarışlar» of the signed-in user (backend-contract.md 2.3), newest first. Saving a search that
/// is saved already (the same filters) updates it, and a user keeps at most <see cref="Limit"/>: the oldest goes, as
/// on the site (src/features/saved-searches/useSavedSearches.ts).
/// </summary>
public static class SavedSearchesEndpoints
{
    public const string NotFound = "saved-search.not-found";

    /// <summary>The site's <c>MAX_SAVED_SEARCHES</c>.</summary>
    public const int Limit = 20;

    public const int NameMaxLength = 60;

    public static RouteGroupBuilder MapSavedSearches(this RouteGroupBuilder api)
    {
        var searches = api.MapGroup("/me/saved-searches").WithTags("Me").RequireAuthorization();
        searches.MapGet("", List);
        searches.MapPost("", Save);
        searches.MapPatch("/{id:guid}", Update);
        searches.MapPost("/{id:guid}/opened", Opened);
        searches.MapDelete("/{id:guid}", Delete);
        return api;
    }

    /// <summary><c>GET /me/saved-searches</c> → <c>SavedSearch[]</c> with <c>newCount</c>.</summary>
    private static async Task<Ok<List<SavedSearchDto>>> List(CurrentUser me, AppDbContext db, CancellationToken ct)
    {
        var rows = await db.SavedSearches.AsNoTracking()
            .Where(s => s.UserId == me.UserId)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .ToListAsync(ct);
        var result = new List<SavedSearchDto>(rows.Count);
        foreach (var row in rows)
        {
            result.Add(await ToDtoAsync(db, row, ct));
        }

        return TypedResults.Ok(result);
    }

    /// <summary>
    /// <c>POST /me/saved-searches</c> <c>{ name, query, alerts }</c> → 201 <c>SavedSearch</c>, or 200 when the same
    /// search was saved already (it gets the new name and alerts). <c>query</c> is stored without page, sort and view.
    /// </summary>
    private static async Task<Results<Created<SavedSearchDto>, Ok<SavedSearchDto>>> Save(
        SaveSearchRequest body,
        CurrentUser me,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken ct)
    {
        var query = CatalogueQueryString.Normalize(body.Query);
        var name = body.Name.Trim();
        var errors = new FieldErrors();
        errors.Add("name", NameError(name));
        errors.Add("query", query.Length > CatalogueQueryString.MaxLength ? FieldErrors.TooLong : null);
        errors.ThrowIfAny();

        var existing = await db.SavedSearches.FirstOrDefaultAsync(s => s.UserId == me.UserId && s.Query == query, ct);
        if (existing is not null)
        {
            existing.Name = name;
            existing.Alerts = body.Alerts;
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(await ToDtoAsync(db, existing, ct));
        }

        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var now = clock.GetUtcNow();
        var search = new SavedSearch
        {
            Id = Ids.New(clock),
            UserId = me.UserId,
            Name = name,
            Query = query,
            Filter = CatalogueQueryString.ToFilter(query, taxonomy),
            Alerts = body.Alerts,
            LastOpenedAt = now,
            CreatedAt = now,
        };
        db.SavedSearches.Add(search);
        await db.SaveChangesAsync(ct);

        // The newest Limit stay.
        var keep = db.SavedSearches.Where(s => s.UserId == me.UserId)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .Take(Limit)
            .Select(s => s.Id);
        await db.SavedSearches.Where(s => s.UserId == me.UserId && !keep.Contains(s.Id)).ExecuteDeleteAsync(ct);
        return TypedResults.Created($"{ApiRoutes.Prefix}/me/saved-searches/{search.Id}", await ToDtoAsync(db, search, ct));
    }

    /// <summary><c>PATCH /me/saved-searches/{id}</c> <c>{ name?, alerts? }</c> → <c>SavedSearch</c>.</summary>
    private static async Task<Ok<SavedSearchDto>> Update(Guid id, SavedSearchPatch body, CurrentUser me, AppDbContext db, CancellationToken ct)
    {
        var search = await FindAsync(db, id, me, ct);
        var errors = new FieldErrors();
        if (body.Has(nameof(SavedSearchPatch.Name)))
        {
            var name = body.Name?.Trim() ?? string.Empty;
            errors.Add("name", NameError(name));
            search.Name = name;
        }

        if (body.Has(nameof(SavedSearchPatch.Alerts)))
        {
            errors.Add("alerts", body.Alerts is null ? FieldErrors.Required : null);
            search.Alerts = body.Alerts ?? search.Alerts;
        }

        errors.ThrowIfAny();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ToDtoAsync(db, search, ct));
    }

    /// <summary>
    /// <c>POST /me/saved-searches/{id}/opened</c> → <c>SavedSearch</c> (<c>newCount: 0</c>): the user opened the search,
    /// so the listings found until now are no longer new.
    /// </summary>
    private static async Task<Ok<SavedSearchDto>> Opened(Guid id, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var search = await FindAsync(db, id, me, ct);
        search.LastOpenedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await ToDtoAsync(db, search, ct));
    }

    /// <summary><c>DELETE /me/saved-searches/{id}</c> → 204.</summary>
    private static async Task<NoContent> Delete(Guid id, CurrentUser me, AppDbContext db, CancellationToken ct)
    {
        var search = await FindAsync(db, id, me, ct);
        db.SavedSearches.Remove(search);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    /// <summary>The search, when it is the caller's (<see cref="Access"/>); 404 <c>saved-search.not-found</c> otherwise.</summary>
    private static async Task<SavedSearch> FindAsync(AppDbContext db, Guid id, CurrentUser me, CancellationToken ct)
    {
        var search = await db.SavedSearches.FirstOrDefaultAsync(s => s.Id == id, ct);
        Access.EnsureCanManage(me, search?.UserId, NotFound);
        return search!;
    }

    /// <summary>The DTO with <c>newCount</c>: the active listings it finds that were published after it was last opened.</summary>
    private static async Task<SavedSearchDto> ToDtoAsync(AppDbContext db, SavedSearch search, CancellationToken ct)
    {
        var since = search.LastOpenedAt;
        var newCount = await db.Listings.Public(CategoryKind.Product)
            .Filter(search.Filter)
            .CountAsync(l => l.PublishedAt > since, ct);
        return new SavedSearchDto(search.Id.ToString(), search.Name, search.Query, search.Alerts, search.CreatedAt, newCount);
    }

    private static string? NameError(string name) => name.Length switch
    {
        0 => FieldErrors.Required,
        > NameMaxLength => FieldErrors.TooLong,
        _ => null,
    };
}

/// <summary><c>SavedSearch</c> of src/types.</summary>
public sealed record SavedSearchDto(string Id, string Name, string Query, bool Alerts, DateTimeOffset CreatedAt, int NewCount);

public sealed record SaveSearchRequest(string Name, string Query, bool Alerts = false);

/// <summary><c>PATCH /me/saved-searches/{id}</c>: what is sent changes.</summary>
public sealed class SavedSearchPatch : PatchBody
{
    public string? Name { get; set => field = Sent(value); }

    public bool? Alerts { get; set => field = Sent(value); }
}
