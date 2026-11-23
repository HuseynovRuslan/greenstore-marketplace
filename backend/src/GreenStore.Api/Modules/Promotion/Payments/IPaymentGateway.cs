namespace GreenStore.Api.Modules.Promotion.Payments;

/// <summary>
/// A payment provider (ARCHITECTURE.md §2: behind an interface; a fake one in Development and Staging). An order asks
/// it for a payment page (<see cref="StartAsync"/>); the provider later posts the outcome to
/// <c>POST /api/v1/payments/{Name}/callback</c>, which <see cref="Read"/> checks and parses. A real provider (a bank
/// or a payment service, once the contract is signed) is one more implementation of this interface: backend/README.md,
/// «Ödəniş provayderi».
/// </summary>
public interface IPaymentGateway
{
    /// <summary>The provider's name in URLs and in <c>promotion_orders.provider</c>: lower-case letters and digits.</summary>
    string Name { get; }

    /// <summary>
    /// Registers the payment with the provider and returns its id and the page to send the buyer to. Runs inside the
    /// order's transaction: when it throws, no order is saved.
    /// </summary>
    Task<PaymentStart> StartAsync(PaymentStartRequest request, CancellationToken ct);

    /// <summary>Checks the callback's signature and reads what it says. Never throws for a bad body: it is stored all the same.</summary>
    PaymentCallback Read(PaymentCallbackRequest callback);
}

/// <param name="ApiBaseUrl">The API's public origin (no trailing slash), for pages and callbacks the API itself serves.</param>
/// <param name="ReturnPath">The site's page to come back to, checked (<see cref="PromotionRules.TryCleanReturnPath"/>), with <c>?order=</c>.</param>
/// <param name="ReturnUrl">The same page as an absolute URL on the site; null when <c>Frontend:BaseUrl</c> is not set.</param>
public sealed record PaymentStartRequest(
    Guid OrderId,
    long OrderNumber,
    decimal Amount,
    string Description,
    string ApiBaseUrl,
    string ReturnPath,
    string? ReturnUrl);

/// <param name="ProviderRef">The provider's id of the payment: callbacks name it (<c>promotion_orders.provider_ref</c>).</param>
/// <param name="PaymentUrl">Where the buyer pays.</param>
public sealed record PaymentStart(string ProviderRef, string PaymentUrl);

/// <param name="Body">The request body exactly as it came (signatures are over these bytes).</param>
/// <param name="Headers">The request headers, names in lower case.</param>
public sealed record PaymentCallbackRequest(string Body, IReadOnlyDictionary<string, string> Headers);

/// <summary>What a callback says.</summary>
/// <param name="EventType">The provider's own name of the event (stored in <c>payment_events.event_type</c>).</param>
/// <param name="Amount">The amount paid, when the provider sends it: it must be the order's.</param>
public sealed record PaymentCallback(bool SignatureOk, string? ProviderRef, string? EventType, PaymentOutcome Outcome, decimal? Amount);
