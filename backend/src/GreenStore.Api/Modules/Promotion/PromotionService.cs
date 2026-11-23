using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Promotion.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// Buying a promotion (ARCHITECTURE.md §7, DATABASE.md §3.9): an order for the owner's active listing at the option's
/// price, the provider's payment page, the provider's callback, and what a paid order starts on the listing. The rules
/// are <see cref="PromotionRules"/>'; this class reads and writes the rows.
/// </summary>
public sealed class PromotionService(
    AppDbContext db,
    TimeProvider clock,
    PaymentGateways gateways,
    IOptions<PaymentOptions> options,
    IOptions<FrontendOptions> frontend,
    ILogger<PromotionService> logger)
{
    /// <summary>
    /// A new order, pending until the provider confirms it, and where to pay it. 400 <c>validation</c>, 404
    /// <c>listing.not-found</c> (not the caller's), 409 <c>listing.wrong-status</c> (not active), 429
    /// <c>promotion-order.too-many</c>, 503 <c>payment.unavailable</c>. Runs in the caller's transaction
    /// (<see cref="IdempotentRequests"/>).
    /// </summary>
    public async Task<PromotionCheckoutDto> CreateOrderAsync(CurrentUser me, PromotionOrderInputDto input, string apiBaseUrl, CancellationToken ct)
    {
        var catalogue = await PromotionCatalogue.LoadAsync(db, ct);
        var (request, errors) = PromotionRules.ValidateOrder(input, catalogue);
        errors.ThrowIfAny();
        var gateway = gateways.Current ?? throw new ApiProblemException(StatusCodes.Status503ServiceUnavailable, PromotionErrors.Unavailable);

        var listing = await db.Listings.AsNoTracking()
            .Where(l => l.Id == request!.ListingId && l.DeletedAt == null)
            .Select(l => new { l.OwnerUserId, l.Status, l.Title })
            .FirstOrDefaultAsync(ct);
        Access.EnsureCanManage(me, listing?.OwnerUserId, ListingErrors.NotFound);
        if (listing!.Status != ListingStatus.Active)
        {
            // Only a listing on the site can be promoted: a pending choice is paid once the moderator approved it.
            throw new ApiProblemException(
                StatusCodes.Status409Conflict,
                ListingErrors.WrongStatus,
                extensions: new Dictionary<string, object> { ["listingStatus"] = KebabCase.Value(listing.Status) });
        }

        var now = clock.GetUtcNow();
        var since = now.AddDays(-1);
        var open = await db.PromotionOrders.CountAsync(o => o.UserId == me.UserId && o.Status == PromotionOrderStatus.Pending && o.CreatedAt > since, ct);
        if (open >= options.Value.MaxPendingOrdersPerDay)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, PromotionErrors.TooManyOrders, retryAfter: TimeSpan.FromHours(1));
        }

        var option = request!.Option;
        var number = await db.Database.SqlQuery<long>($"SELECT nextval('promotion_order_number_seq') AS \"Value\"").SingleAsync(ct);
        var order = new PromotionOrder
        {
            Id = Ids.New(clock),
            Number = number,
            ListingId = request.ListingId,
            UserId = me.UserId,
            OptionId = option.Id,
            Amount = option.Price,
            Status = PromotionOrderStatus.Pending,
            Provider = gateway.Name,
            CreatedAt = now,
        };
        var returnPath = PromotionRules.WithQuery(request.ReturnPath, $"order={order.Id}");
        var site = frontend.Value.BaseUrl.TrimEnd('/');
        var start = await gateway.StartAsync(
            new PaymentStartRequest(
                order.Id,
                order.Number,
                order.Amount,
                $"GreenStore № {order.Number}: {option.Label.Az} ({listing.Title})",
                apiBaseUrl.TrimEnd('/'),
                returnPath,
                string.IsNullOrEmpty(site) ? null : site + returnPath),
            ct);
        order.ProviderRef = start.ProviderRef;
        db.PromotionOrders.Add(order);
        await db.SaveChangesAsync(ct);
        return new PromotionCheckoutDto(order.ToDto(option.PackageId), start.PaymentUrl);
    }

    /// <summary>
    /// The most of a callback with a wrong signature that is stored: anyone can post one, so junk cannot fill the table
    /// (the daily clean-up deletes them after <see cref="Jobs.Retention.UnsignedPaymentEvents"/>).
    /// </summary>
    public const int MaxUnsignedPayloadChars = 2048;

    /// <summary>
    /// A provider's callback: stored first (<c>payment_events</c>, whatever it says; only the first
    /// <see cref="MaxUnsignedPayloadChars"/> characters of one with a wrong signature), then applied to its order once.
    /// The order row is locked while it is applied, so two callbacks of one payment at the same moment start the
    /// promotion once; a repeated «paid» answers the order as it is. 401 <c>payment.bad-signature</c>, 400
    /// <c>payment.missing-reference</c>, 404 <c>promotion-order.not-found</c>, 409 <c>payment.amount-mismatch</c>.
    /// </summary>
    public async Task<PaymentCallbackResultDto> HandleCallbackAsync(IPaymentGateway gateway, PaymentCallbackRequest request, CancellationToken ct)
    {
        var callback = gateway.Read(request);
        var now = clock.GetUtcNow();
        var stored = new PaymentEvent
        {
            Provider = gateway.Name,
            ProviderRef = Trim(callback.ProviderRef, 200),
            EventType = Trim(callback.EventType, 100),
            Payload = callback.SignatureOk ? AsJson(request.Body) : AsJson(request.Body, MaxUnsignedPayloadChars),
            SignatureOk = callback.SignatureOk,
            ReceivedAt = now,
        };
        db.PaymentEvents.Add(stored);
        await db.SaveChangesAsync(ct);

        if (!callback.SignatureOk)
        {
            logger.LogWarning("Payment callback {Event} of {Provider} has a wrong signature; stored, not applied", stored.Id, gateway.Name);
            throw new ApiProblemException(StatusCodes.Status401Unauthorized, PromotionErrors.BadSignature);
        }

        if (string.IsNullOrEmpty(callback.ProviderRef))
        {
            throw ApiProblemException.BadRequest(PromotionErrors.MissingReference);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var order = await db.PromotionOrders
            .FromSql($"SELECT * FROM promotion_orders WHERE provider = {gateway.Name} AND provider_ref = {callback.ProviderRef} FOR UPDATE")
            .FirstOrDefaultAsync(ct)
            ?? throw ApiProblemException.NotFound(PromotionErrors.OrderNotFound);

        if (callback.Amount is { } amount && amount != order.Amount)
        {
            logger.LogError(
                "Payment callback {Event} for order {Order} says {Amount} AZN was paid, the order is {OrderAmount} AZN; not applied",
                stored.Id,
                order.Number,
                amount,
                order.Amount);
            throw ApiProblemException.Conflict(PromotionErrors.AmountMismatch);
        }

        var change = PromotionRules.Next(order.Status, callback.Outcome);
        if (change.Apply)
        {
            order.Status = PromotionOrderStatus.Paid;
            order.PaidAt = now;
            await StartPromotionAsync(order, now, ct);
        }
        else
        {
            order.Status = change.Status;
        }

        stored.ProcessedAt = now;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new PaymentCallbackResultDto(order.Id.ToString(), order.Status);
    }

    /// <summary>The caller's order; 404 <c>promotion-order.not-found</c> otherwise.</summary>
    public async Task<PromotionOrderDto> OwnOrderAsync(CurrentUser me, Guid id, CancellationToken ct)
    {
        var order = await db.PromotionOrders.AsNoTracking().Include(o => o.Option).FirstOrDefaultAsync(o => o.Id == id, ct);
        Access.EnsureCanManage(me, order?.UserId, PromotionErrors.OrderNotFound);
        return order!.ToDto(order!.Option!.PackageId);
    }

    /// <summary>
    /// Starts what a paid order bought (<see cref="PromotionRules.Plan"/>): its rows, the listing's «Önə çıxan» (its end
    /// and its place in the group) and term, the first «İrəli çək» lift, and the site's cache notice. The listing's row
    /// is locked meanwhile, so an owner's or a moderator's change waits instead of being overwritten. The listing's
    /// pending choice from posting is cleared. The order was made for a listing on the site; one that went off it on the
    /// payment page (paused, edited) gets its «Önə çıxar» days from the payment all the same, as a running «Önə çıxar»
    /// does, and its lifts wait until it is back.
    /// </summary>
    private async Task StartPromotionAsync(PromotionOrder order, DateTimeOffset now, CancellationToken ct)
    {
        var option = await db.PromotionOptions.AsNoTracking().FirstAsync(o => o.Id == order.OptionId, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM listings WHERE id = {order.ListingId} FOR UPDATE", ct);
        var listing = await db.Listings.Include(l => l.Seller).FirstAsync(l => l.Id == order.ListingId, ct);
        var onSite = listing.Status == ListingStatus.Active && listing.DeletedAt is null;
        var state = PromotedListing.Of(listing.IsPromoted, listing.PromotedUntil, listing.PromotedAt, listing.ExpiresAt, onSite, now);
        var plan = PromotionRules.Plan(PromotionTerms.Of(option), state, now);

        if (plan.Feature is { } feature)
        {
            db.ListingPromotions.Add(new ListingPromotion
            {
                Id = Ids.New(clock),
                ListingId = listing.Id,
                OrderId = order.Id,
                Kind = PromotionKind.Feature,
                StartsAt = feature.StartsAt,
                EndsAt = feature.EndsAt,
            });
            listing.IsPromoted = true;
            listing.PromotedUntil = plan.PromotedUntil;
            listing.PromotedAt = plan.PromotedAt;
        }

        if (plan.Bump is { } bump)
        {
            db.ListingPromotions.Add(new ListingPromotion
            {
                Id = Ids.New(clock),
                ListingId = listing.Id,
                OrderId = order.Id,
                Kind = PromotionKind.Bump,
                StartsAt = bump.StartsAt,
                EndsAt = bump.EndsAt,
                BumpsLeft = bump.BumpsLeft,
                NextBumpAt = bump.NextBumpAt,
            });
            if (bump.BumpedNow)
            {
                listing.BumpedAt = now;
                listing.SortAt = now;
            }
        }

        listing.ExpiresAt = plan.ExpiresAt;
        listing.PendingPromotionOptionId = null;
        if (onSite)
        {
            Revalidation.Enqueue(db, Revalidation.TagsFor(listing, listing.Seller?.Slug), now);
        }
    }

    /// <summary>
    /// The body as jsonb: itself when it is a JSON value, <c>{"raw": "…"}</c> otherwise. Longer than
    /// <paramref name="maxChars"/>: <c>{"raw": "&lt;the first maxChars&gt;", "truncated": true}</c>.
    /// </summary>
    public static string AsJson(string body, int? maxChars = null)
    {
        if (maxChars is { } max && body.Length > max)
        {
            // Never half of a surrogate pair: jsonb refuses a lone one.
            var cut = char.IsHighSurrogate(body[max - 1]) ? max - 1 : max;
            return JsonSerializer.Serialize(new { raw = body[..cut], truncated = true }, ColumnMapping.StorageJson);
        }

        try
        {
            using var document = JsonDocument.Parse(body);
            return body;
        }
        catch (JsonException)
        {
            return JsonSerializer.Serialize(new { raw = body }, ColumnMapping.StorageJson);
        }
    }

    private static string? Trim(string? text, int max) => text is null ? null : text.Length <= max ? text : text[..max];
}
