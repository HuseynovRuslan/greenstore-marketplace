using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Accounts.Sms;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>What <c>POST /service-requests</c> answers (<c>ServiceRequestResult</c> of src/types: «Sorğu № 3021»).</summary>
public sealed record ServiceRequestResultDto(string Id, long Number);

/// <summary>
/// «Usta çağır» (DATABASE.md §3.8): stores the request and gives it to its providers, in one transaction with their SMS
/// notices (the outbox sends them). From a service page it goes to that service's provider; with a chosen provider to
/// that one; otherwise to up to ten active providers of the type in the city (<see cref="ServiceRequestRules.ChooseProviders"/>).
/// When none is found it stays <c>new</c> for the staff to see.
/// </summary>
public sealed class ServiceRequestService(AppDbContext db, TimeProvider clock, IOptions<ServiceRequestOptions> options, ILogger<ServiceRequestService> logger)
{
    /// <summary>404 <c>service.not-found</c> / <c>provider.not-found</c>; 429 <c>service-request.phone-limit</c> / <c>ip-limit</c>.</summary>
    public async Task<ServiceRequestResultDto> SubmitAsync(ServiceRequestDraft draft, CurrentUser? me, byte[] ipHash, CancellationToken ct)
    {
        var limits = options.Value;
        var now = clock.GetUtcNow();
        var since = now.AddDays(-1);
        if (await db.ServiceRequests.CountAsync(r => r.CustomerPhone == draft.Phone && r.CreatedAt > since, ct) >= limits.MaxPerPhonePerDay)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, EngagementErrors.PhoneLimit, retryAfter: TimeSpan.FromHours(1));
        }

        if (await db.ServiceRequests.CountAsync(r => r.IpHash == ipHash && r.CreatedAt > since, ct) >= limits.MaxPerIpPerDay)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, EngagementErrors.IpLimit, retryAfter: TimeSpan.FromHours(1));
        }

        Guid? listingId = null;
        IReadOnlyList<Guid> providers;
        if (draft.ServiceId is { } serviceId)
        {
            var service = await db.Listings.Public(CategoryKind.Service)
                .Where(l => l.Id == serviceId && l.Owner!.Status == UserStatus.Active)
                .Select(l => new { l.Id, l.OwnerUserId })
                .FirstOrDefaultAsync(ct)
                ?? throw ApiProblemException.NotFound(ServicesEndpoints.NotFound);
            listingId = service.Id;
            providers = [service.OwnerUserId];
        }
        else if (draft.ProviderId is { } providerId)
        {
            providers = [await ProviderAsync(providerId, ct) ?? throw ApiProblemException.NotFound(SellersEndpoints.ProviderNotFound)];
        }
        else
        {
            var candidates = await db.Listings.Public(CategoryKind.Service)
                .Where(l => (l.SubcategoryId == draft.CategoryId || l.CategoryId == draft.CategoryId) && l.Owner!.Status == UserStatus.Active)
                .Select(l => new ProviderCandidate(
                    l.OwnerUserId,
                    l.CategoryId,
                    l.SubcategoryId,
                    l.CityId,
                    l.ServiceCityIds,
                    l.IsPromoted,
                    l.Seller != null && l.Seller.VerifiedAt != null,
                    l.SortAt))
                .ToListAsync(ct);
            providers = ServiceRequestRules.ChooseProviders(candidates, draft.CategoryId, draft.CityId, me?.UserId, limits.MaxRecipients);
        }

        var request = new ServiceRequest
        {
            Id = Ids.New(clock),
            ListingId = listingId,
            CategoryId = draft.CategoryId,
            CityId = draft.CityId,
            Area = draft.Area,
            PreferredDate = draft.PreferredDate,
            Size = draft.Size,
            Description = draft.Description,
            CustomerName = draft.Name,
            CustomerPhone = draft.Phone,
            CustomerUserId = me?.UserId,
            Status = providers.Count > 0 ? ServiceRequestStatus.Sent : ServiceRequestStatus.New,
            IpHash = ipHash,
            CreatedAt = now,
            Recipients = providers.Select(p => new ServiceRequestRecipient { ProviderUserId = p }).ToList(),
        };
        db.ServiceRequests.Add(request);

        // The notices of the last 24 hours, the whole site together: past the cap the request reaches the inboxes only.
        var noticed = await db.Outbox.CountAsync(m => m.Type == OutboxTypes.SmsNotice && m.CreatedAt > since, ct);
        var room = Math.Max(0, limits.DailyNoticeCap - noticed);
        foreach (var provider in providers.Take(room))
        {
            ServiceRequestNotices.Enqueue(db, request.Id, provider, now);
        }

        if (providers.Count > room)
        {
            logger.LogWarning(
                "ServiceRequests:DailyNoticeCap ({Cap}) reached: {Skipped} providers of request {RequestId} get no SMS notice",
                limits.DailyNoticeCap,
                providers.Count - room,
                request.Id);
        }

        await db.SaveChangesAsync(ct);
        return new ServiceRequestResultDto(request.Id.ToString(), request.Number);
    }

    /// <summary>
    /// The account behind a provider id: the account itself (<c>Service.providerId</c>) or a business's seller id. It
    /// must be active and have an active service.
    /// </summary>
    private async Task<Guid?> ProviderAsync(Guid id, CancellationToken ct)
    {
        var owner = await db.Sellers.Where(s => s.Id == id).Select(s => (Guid?)s.OwnerUserId).FirstOrDefaultAsync(ct) ?? id;
        var provides = await db.Listings.Public(CategoryKind.Service).AnyAsync(l => l.OwnerUserId == owner && l.Owner!.Status == UserStatus.Active, ct);
        return provides ? owner : null;
    }
}

/// <summary>
/// The SMS a provider gets about a request (<see cref="OutboxTypes.SmsNotice"/>, template
/// <see cref="SmsNoticePayload.ServiceRequest"/>): queued with the request, sent by the outbox job.
/// </summary>
public sealed class ServiceRequestNotices(AppDbContext db, ISmsSender sms, TimeProvider clock)
{
    public static void Enqueue(AppDbContext db, Guid requestId, Guid providerUserId, DateTimeOffset now) =>
        db.Outbox.Add(new OutboxMessage
        {
            Type = OutboxTypes.SmsNotice,
            Payload = JsonSerializer.Serialize(new SmsNoticePayload(SmsNoticePayload.ServiceRequest, requestId, providerUserId), ColumnMapping.StorageJson),
            NextAttemptAt = now,
            CreatedAt = now,
        });

    /// <summary>
    /// Sends the notice in the provider's language and marks the recipient notified. False when there is nobody to
    /// send it to any more (the account was blocked or deleted, or the request was marked spam). Throws when the SMS
    /// provider refuses it, so the outbox tries again.
    /// </summary>
    public async Task<bool> SendAsync(SmsNoticePayload notice, CancellationToken ct)
    {
        if (notice.Template != SmsNoticePayload.ServiceRequest)
        {
            throw new InvalidOperationException($"Unknown SMS notice template '{notice.Template}'.");
        }

        var recipient = await db.ServiceRequestRecipients
            .Include(r => r.Request)
            .Include(r => r.Provider)
            .FirstOrDefaultAsync(r => r.RequestId == notice.SubjectId && r.ProviderUserId == notice.UserId, ct);
        if (recipient is not { Request: { } request, Provider: { Status: UserStatus.Active, Phone: { } phone } provider }
            || request.Status == ServiceRequestStatus.Spam)
        {
            return false;
        }

        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var language = provider.Locale;
        var text = SmsTexts.ServiceRequestNotice(
            request.Number,
            taxonomy.CategoryName(request.CategoryId, language),
            taxonomy.CityName(request.CityId, language),
            request.CustomerName,
            request.CustomerPhone,
            language);
        await sms.SendAsync(new SmsMessage(phone, text), ct);
        recipient.NotifiedAt = clock.GetUtcNow();
        return true;
    }
}
