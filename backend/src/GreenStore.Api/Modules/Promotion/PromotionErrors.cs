namespace GreenStore.Api.Modules.Promotion;

/// <summary>The stable codes of the promotion and payment endpoints (ProblemDetails <c>code</c>).</summary>
public static class PromotionErrors
{
    /// <summary>404: no such order, or not the caller's; a callback naming a payment the API never started.</summary>
    public const string OrderNotFound = "promotion-order.not-found";

    /// <summary>429: the account opened <c>Payments:MaxPendingOrdersPerDay</c> unpaid orders in the last 24 hours.</summary>
    public const string TooManyOrders = "promotion-order.too-many";

    /// <summary>503: no payment provider may be used here (the fake one outside Development and Staging).</summary>
    public const string Unavailable = "payment.unavailable";

    /// <summary>404: a callback for a provider this API does not have.</summary>
    public const string UnknownProvider = "payment.unknown-provider";

    /// <summary>401: the callback's signature is wrong (it is stored all the same, <c>signature_ok = false</c>).</summary>
    public const string BadSignature = "payment.bad-signature";

    /// <summary>409: the provider says another amount was paid than the order's; nothing is applied, an error is logged.</summary>
    public const string AmountMismatch = "payment.amount-mismatch";

    /// <summary>400: the callback does not name the payment (<c>providerRef</c>).</summary>
    public const string MissingReference = "payment.missing-reference";
}
