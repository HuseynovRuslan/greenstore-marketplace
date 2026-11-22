using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// The paid packages (DATABASE.md §3.9): «İrəli çək», «Önə çıxar» and the bundle of both. The id is a fixed text key
/// (<see cref="PromotionPackages"/>, <c>PromotionPackageId</c> of src/types); names, summaries and benefits are in the
/// three languages. Seeded from seed/reference/promotions.json; the admin owns them from then on.
/// </summary>
public sealed class PromotionPackage
{
    public required string Id { get; set; }

    public required LocalizedText Name { get; set; }

    public required LocalizedText Summary { get; set; }

    public List<LocalizedText> Benefits { get; set; } = [];

    public int SortOrder { get; set; }

    /// <summary>False: not offered any more (its old orders keep it).</summary>
    public bool IsActive { get; set; } = true;

    public List<PromotionOption> Options { get; set; } = [];
}

/// <summary>One priced choice of a package: «7 gün» for 9 ₼, «1 dəfə» for 1 ₼.</summary>
public sealed class PromotionOption
{
    /// <summary>«one-cixar-7».</summary>
    public required string Id { get; set; }

    public required string PackageId { get; set; }

    public PromotionPackage? Package { get; set; }

    public required LocalizedText Label { get; set; }

    /// <summary>AZN. An order copies it (<see cref="PromotionOrder.Amount"/>), so a later price change does not touch it.</summary>
    public decimal Price { get; set; }

    /// <summary>How long it runs: the «Önə çıxar» days, or the days the «İrəli çək» lifts are spread over.</summary>
    public short? Days { get; set; }

    /// <summary>«İrəli çək»: how many times the listing is lifted to the top of «Ən yenilər».</summary>
    public short? Bumps { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>
/// A purchase of an option for a listing (DATABASE.md §3.9), numbered «Sifariş № 1001». It waits (<c>pending</c>)
/// until the payment provider confirms it in a callback; <see cref="ProviderRef"/> is the provider's id of the
/// payment, unique per provider, so the same payment is never counted twice.
/// </summary>
public sealed class PromotionOrder
{
    public Guid Id { get; set; }

    public long Number { get; set; }

    public Guid ListingId { get; set; }

    public Listing? Listing { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    public required string OptionId { get; set; }

    public PromotionOption? Option { get; set; }

    /// <summary>The option's price when it was bought.</summary>
    public decimal Amount { get; set; }

    public PromotionOrderStatus Status { get; set; }

    /// <summary>The gateway's name (<see cref="Payments.IPaymentGateway.Name"/>): <c>fake</c> in Development and Staging.</summary>
    public required string Provider { get; set; }

    public string? ProviderRef { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? PaidAt { get; set; }
}

/// <summary><c>promotion_orders.status</c>. The API sends <c>pending</c>, <c>paid</c> or <c>failed</c> today; the other two wait for a real provider.</summary>
public enum PromotionOrderStatus
{
    Pending,
    Paid,
    Failed,
    Cancelled,
    Refunded,
}

/// <summary>
/// A payment provider's callback, stored as it came (DATABASE.md §3.9), whether or not its signature was right: for
/// disputes and checks, «what did the provider send, and when».
/// </summary>
public sealed class PaymentEvent
{
    public long Id { get; set; }

    public required string Provider { get; set; }

    public string? ProviderRef { get; set; }

    public string? EventType { get; set; }

    /// <summary>The body as JSON (a body that is not JSON is kept as <c>{"raw": "…"}</c>).</summary>
    public required string Payload { get; set; }

    public bool SignatureOk { get; set; }

    public DateTimeOffset ReceivedAt { get; set; }

    /// <summary>When it was applied to its order; null when it was refused or could not be matched.</summary>
    public DateTimeOffset? ProcessedAt { get; set; }
}

/// <summary>
/// What a paid order runs on its listing (DATABASE.md §3.9): a <see cref="PromotionKind.Feature"/> («Önə çıxar»:
/// «Önə çıxan» from <see cref="StartsAt"/> to <see cref="EndsAt"/>) or a <see cref="PromotionKind.Bump"/> («İrəli
/// çək»: <see cref="BumpsLeft"/> more lifts, the next at <see cref="NextBumpAt"/>). The bundle makes one of each.
/// </summary>
public sealed class ListingPromotion
{
    public Guid Id { get; set; }

    public Guid ListingId { get; set; }

    public Guid OrderId { get; set; }

    public PromotionOrder? Order { get; set; }

    public PromotionKind Kind { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    public short BumpsLeft { get; set; }

    public DateTimeOffset? NextBumpAt { get; set; }
}

/// <summary><c>listing_promotions.kind</c>.</summary>
public enum PromotionKind
{
    /// <summary>«Önə çıxar»: the «Önə çıxan» badge, the home page and the top of the catalogue.</summary>
    Feature,

    /// <summary>«İrəli çək»: back to the top of «Ən yenilər», as if just posted.</summary>
    Bump,
}

/// <summary>The package ids (<c>PromotionPackageId</c> of src/types).</summary>
public static class PromotionPackages
{
    /// <summary>«İrəli çək».</summary>
    public const string IreliCek = "ireli-cek";

    /// <summary>«Önə çıxar».</summary>
    public const string OneCixar = "one-cixar";

    /// <summary>«Önə çıxar + İrəli çək».</summary>
    public const string Paket = "paket";

    public static readonly IReadOnlyList<string> All = [OneCixar, IreliCek, Paket];
}
