using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Modules.Promotion;

/// <summary><c>PromotionPackage</c> of src/types, in the request's language.</summary>
public sealed record PromotionPackageDto(string Id, string Name, string Summary, IReadOnlyList<string> Benefits, IReadOnlyList<PromotionOptionDto> Options);

/// <summary><c>PromotionOption</c> of src/types: «7 gün» for 9 ₼.</summary>
public sealed record PromotionOptionDto(string Id, string Label, decimal Price, int? Days = null, int? Bumps = null);

/// <summary>
/// <c>PromotionOrder</c> of src/types, plus ★ <c>number</c> («Sifariş № 1001») and ★ <c>paidAt</c>.
/// <c>status</c> is <c>pending</c> until the provider confirms the payment.
/// </summary>
public sealed record PromotionOrderDto
{
    public required string Id { get; init; }

    public required string ListingId { get; init; }

    public required string PackageId { get; init; }

    public required string OptionId { get; init; }

    public decimal Amount { get; init; }

    public PromotionOrderStatus Status { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public long Number { get; init; }

    public DateTimeOffset? PaidAt { get; init; }
}

/// <summary>
/// ★ What <c>POST /promotion-orders</c> answers: the order and the provider's page to send the visitor to
/// (backend-contract.md 5.1).
/// </summary>
public sealed record PromotionCheckoutDto(PromotionOrderDto Order, string PaymentUrl);

/// <summary>
/// <c>POST /promotion-orders</c>: <c>createPromotionOrder</c>'s input, plus ★ <c>returnPath</c>, the page of the site to
/// come back to after paying (standard <c>/kabinet</c>).
/// </summary>
public sealed record PromotionOrderInputDto(string? ListingId = null, string? PackageId = null, string? OptionId = null, string? ReturnPath = null);

/// <summary>The answer to a provider's callback: the order and its status after it.</summary>
public sealed record PaymentCallbackResultDto(string OrderId, PromotionOrderStatus Status);

/// <summary>The promotion fields of the owner's listing (<c>OwnListing</c>).</summary>
/// <param name="Promotion">What runs now: <c>ListingPromotion</c> (<c>{ packageId, until }</c>) of src/types.</param>
/// <param name="Pending">★ <c>pendingPromotion</c>: chosen in «Elan yerləşdir», not paid yet.</param>
public sealed record OwnerPromotion(ListingPromotionDto? Promotion, PendingPromotionDto? Pending);

/// <summary><c>ListingPromotion</c> of src/types.</summary>
public sealed record ListingPromotionDto(string PackageId, DateTimeOffset Until);

/// <summary>★ <c>OwnListing.pendingPromotion</c>: the package and option chosen while posting.</summary>
public sealed record PendingPromotionDto(string PackageId, string OptionId);

public static class PromotionMapping
{
    public static PromotionPackageDto ToDto(this PromotionPackage package, IEnumerable<PromotionOption> options, Language language) => new(
        package.Id,
        package.Name.Get(language),
        package.Summary.Get(language),
        package.Benefits.Select(b => b.Get(language)).ToList(),
        options.Select(o => new PromotionOptionDto(o.Id, o.Label.Get(language), Money.Trim(o.Price), o.Days, o.Bumps)).ToList());

    public static PromotionOrderDto ToDto(this PromotionOrder order, string packageId) => new()
    {
        Id = order.Id.ToString(),
        ListingId = order.ListingId.ToString(),
        PackageId = packageId,
        OptionId = order.OptionId,
        Amount = Money.Trim(order.Amount),
        Status = order.Status,
        CreatedAt = order.CreatedAt,
        Number = order.Number,
        PaidAt = order.PaidAt,
    };
}
