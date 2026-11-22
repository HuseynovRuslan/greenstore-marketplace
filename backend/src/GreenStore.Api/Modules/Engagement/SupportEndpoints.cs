using GreenStore.Api.Common;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>What <c>POST /support</c> answers: the ticket number the visitor can quote.</summary>
public sealed record SupportTicketDto(long Ticket);

/// <summary>«Bizimlə əlaqə» (ARCHITECTURE.md §7): a message to support, signed in or not, limited per IP.</summary>
public static class SupportEndpoints
{
    public static RouteGroupBuilder MapSupport(this RouteGroupBuilder api)
    {
        api.MapPost("/support", Submit).WithTags("Engagement").RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        return api;
    }

    /// <summary>
    /// <c>POST /support</c> <c>SupportMessageInput</c> → 201 <c>{ ticket }</c>. 400 <c>validation</c> (<c>topic</c>,
    /// <c>name</c>, <c>contact</c>: a phone or an e-mail, <c>message</c>, <c>listingNumber</c>); 429
    /// <c>rate-limited</c> per IP.
    /// </summary>
    private static async Task<Created<SupportTicketDto>> Submit(
        SupportMessageInputDto body,
        HttpContext http,
        AppDbContext db,
        ServerHash hash,
        TimeProvider clock,
        CancellationToken ct)
    {
        var (submission, errors) = SupportRules.Validate(body);
        errors.ThrowIfAny();
        var message = new SupportMessage
        {
            Id = Ids.New(clock),
            Topic = submission!.Topic,
            Name = submission.Name,
            Contact = submission.Contact,
            Message = submission.Message,
            ListingNumber = submission.ListingNumber,
            UserId = CurrentUser.Of(http)?.UserId,
            Status = SupportStatus.New,
            IpHash = hash.Ip(http.GetClientIp().Address),
            CreatedAt = clock.GetUtcNow(),
        };
        db.SupportMessages.Add(message);
        await db.SaveChangesAsync(ct);
        return TypedResults.Created((string?)null, new SupportTicketDto(message.Ticket));
    }
}
