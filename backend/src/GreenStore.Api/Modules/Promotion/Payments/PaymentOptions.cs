namespace GreenStore.Api.Modules.Promotion.Payments;

/// <summary>Payments for promotions (section "Payments", ARCHITECTURE.md §16).</summary>
public sealed class PaymentOptions
{
    public const string Section = "Payments";

    /// <summary>
    /// The provider new orders go to (<see cref="IPaymentGateway.Name"/>). <c>fake</c> works in Development and
    /// Staging only: in Production no order can be paid with it (503 <c>payment.unavailable</c>) until a real provider
    /// is added (backend/README.md, «Ödəniş provayderi»).
    /// </summary>
    public string Provider { get; set; } = FakePaymentGateway.ProviderName;

    /// <summary>
    /// The API's public origin (e.g. https://api.greenstore.az), for the fake checkout page the visitor is sent to and
    /// for a real provider's callback address. Empty: the origin the request came to.
    /// </summary>
    public string PublicBaseUrl { get; set; } = string.Empty;

    /// <summary>Unpaid orders one account may open in 24 hours (each one is a payment started at the provider).</summary>
    public int MaxPendingOrdersPerDay { get; set; } = 20;

    public FakePaymentOptions Fake { get; set; } = new();
}

/// <summary>The fake provider (section "Payments:Fake").</summary>
public sealed class FakePaymentOptions
{
    /// <summary>
    /// The HMAC key its callbacks are signed with. Empty: a random key per process (fine for one instance; set
    /// <c>Payments__Fake__Secret</c> on a Staging with several). Never a real provider's key.
    /// </summary>
    public string Secret { get; set; } = string.Empty;
}
