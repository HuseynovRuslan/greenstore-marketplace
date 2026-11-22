using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Usta çağır» (ARCHITECTURE.md §7, DATABASE.md §3.8): a customer sends a request, signed in or not; the providers it
/// went to find it in their inbox, <c>GET /me/service-requests</c> (the site's page for it comes later).
/// </summary>
public static class ServiceRequestsEndpoints
{
    public const int DefaultPageSize = 20;

    public static RouteGroupBuilder MapServiceRequests(this RouteGroupBuilder api)
    {
        api.MapPost("/service-requests", Submit).WithTags("Engagement").RequireRateLimiting(RateLimitPolicies.AnonymousWrites)
            .Produces<ServiceRequestResultDto>(StatusCodes.Status201Created);

        var inbox = api.MapGroup("/me/service-requests").WithTags("Me").RequireAuthorization();
        inbox.MapGet("", Inbox);
        inbox.MapPost("/{id:guid}/seen", Seen);
        return api;
    }

    /// <summary>
    /// <c>POST /service-requests</c> <c>ServiceRequestInput</c> → 201 <c>{ id, number }</c>. Takes an
    /// <c>Idempotency-Key</c> header (the same key again answers the same request). 400 <c>validation</c>, 404
    /// <c>service.not-found</c> / <c>provider.not-found</c>, 422 <c>idempotency.key-reused</c>, 429
    /// <c>rate-limited</c> (per IP), <c>service-request.phone-limit</c>, <c>service-request.ip-limit</c>.
    /// </summary>
    private static async Task<IResult> Submit(
        ServiceRequestInputDto body,
        HttpContext http,
        AppDbContext db,
        ServerHash hash,
        TimeProvider clock,
        IdempotentRequests idempotency,
        ServiceRequestService requests,
        CancellationToken ct)
    {
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var (draft, errors) = ServiceRequestRules.Validate(body, taxonomy, BakuTime.Today(clock.GetUtcNow()));
        errors.ThrowIfAny();

        var me = CurrentUser.Of(http);
        var ip = hash.Ip(http.GetClientIp().Address);
        // A guest's keys are the IP's: two guests behind one address could only meet with the same key.
        var scope = me is not null ? me.UserId.ToString() : $"ip:{Convert.ToHexString(ip)}";
        return await idempotency.RunAsync(
            http,
            scope,
            body,
            async token => (StatusCodes.Status201Created, await requests.SubmitAsync(draft!, me, ip, token)),
            ct);
    }

    /// <summary>
    /// <c>GET /me/service-requests?page&amp;pageSize</c> → the requests that came to the caller, newest first:
    /// <c>PageResult</c> plus <c>unseen</c> (not opened yet). Each has the customer's name and number to call back.
    /// Requests marked spam are left out.
    /// </summary>
    private static async Task<Ok<ServiceRequestInboxDto>> Inbox(CurrentUser me, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var page = query.Page(DefaultPageSize);
        query.ThrowIfInvalid();

        var mine = db.ServiceRequestRecipients.AsNoTracking()
            .Where(r => r.ProviderUserId == me.UserId && r.Request!.Status != ServiceRequestStatus.Spam);
        var total = await mine.CountAsync(ct);
        var unseen = await mine.CountAsync(r => r.SeenAt == null, ct);
        var current = page.Clamp(total);
        var rows = await mine
            .OrderByDescending(r => r.Request!.CreatedAt).ThenByDescending(r => r.Request!.Number)
            .Skip((current - 1) * page.PageSize).Take(page.PageSize)
            .Select(r => new
            {
                r.SeenAt,
                r.NotifiedAt,
                Request = r.Request!,
                RecipientCount = r.Request!.Recipients.Count,
                Service = r.Request.Listing == null ? null : new { r.Request.Listing.Id, r.Request.Listing.Slug, r.Request.Listing.Title },
            })
            .ToListAsync(ct);

        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var language = http.GetLanguage();
        var items = rows.Select(row => new IncomingServiceRequestDto
        {
            Id = row.Request.Id.ToString(),
            Number = row.Request.Number,
            CategoryId = row.Request.CategoryId,
            Category = taxonomy.CategoryName(row.Request.CategoryId, language),
            CityId = row.Request.CityId,
            City = taxonomy.CityName(row.Request.CityId, language),
            Area = row.Request.Area,
            PreferredDate = row.Request.PreferredDate,
            Size = row.Request.Size,
            Description = row.Request.Description,
            CustomerName = row.Request.CustomerName,
            CustomerPhone = row.Request.CustomerPhone,
            CreatedAt = row.Request.CreatedAt,
            SeenAt = row.SeenAt,
            NotifiedAt = row.NotifiedAt,
            RecipientCount = row.RecipientCount,
            Service = row.Service is null ? null : new ServiceRequestServiceDto(row.Service.Id.ToString(), row.Service.Slug, row.Service.Title),
        }).ToList();
        return TypedResults.Ok(new ServiceRequestInboxDto(items, total, current, page.PageCount(total), unseen));
    }

    /// <summary><c>POST /me/service-requests/{id}/seen</c> → 204: the provider opened it. 404 when it did not come to them.</summary>
    private static async Task<NoContent> Seen(Guid id, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var recipient = await db.ServiceRequestRecipients.FirstOrDefaultAsync(r => r.RequestId == id && r.ProviderUserId == me.UserId, ct)
            ?? throw ApiProblemException.NotFound(EngagementErrors.ServiceRequestNotFound);
        if (recipient.SeenAt is null)
        {
            recipient.SeenAt = clock.GetUtcNow();
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.NoContent();
    }
}

/// <summary>The provider's inbox: <c>PageResult</c> of the requests, and how many are not opened yet.</summary>
public sealed record ServiceRequestInboxDto(IReadOnlyList<IncomingServiceRequestDto> Items, int Total, int Page, int PageCount, int Unseen);

/// <summary>A request in a provider's inbox. Names are in the request's language.</summary>
public sealed record IncomingServiceRequestDto
{
    public required string Id { get; init; }

    /// <summary>«Sorğu № 3021».</summary>
    public long Number { get; init; }

    /// <summary>The service type.</summary>
    public required string CategoryId { get; init; }

    public required string Category { get; init; }

    public required string CityId { get; init; }

    public required string City { get; init; }

    public string? Area { get; init; }

    /// <summary><c>YYYY-MM-DD</c>.</summary>
    public DateOnly? PreferredDate { get; init; }

    public string? Size { get; init; }

    public required string Description { get; init; }

    public required string CustomerName { get; init; }

    /// <summary>E.164: the provider calls the customer back.</summary>
    public required string CustomerPhone { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>When the provider opened it; not sent while unseen.</summary>
    public DateTimeOffset? SeenAt { get; init; }

    /// <summary>When the SMS notice went out.</summary>
    public DateTimeOffset? NotifiedAt { get; init; }

    /// <summary>How many providers got it: 1 when the customer chose this one.</summary>
    public int RecipientCount { get; init; }

    /// <summary>The service whose page it came from.</summary>
    public ServiceRequestServiceDto? Service { get; init; }
}

public sealed record ServiceRequestServiceDto(string Id, string Slug, string Title);
