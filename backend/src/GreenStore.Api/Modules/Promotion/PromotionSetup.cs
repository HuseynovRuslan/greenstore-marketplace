using GreenStore.Api.Modules.Promotion.Payments;

namespace GreenStore.Api.Modules.Promotion;

public static class PromotionSetup
{
    /// <summary>Promotions and payments (phase 5): the payment providers, the orders and their settings.</summary>
    public static IServiceCollection AddPromotion(this IServiceCollection services)
    {
        services.AddOptions<PaymentOptions>()
            .BindConfiguration(PaymentOptions.Section)
            .Validate(o => !string.IsNullOrWhiteSpace(o.Provider), "Payments:Provider is not set.")
            .Validate(o => o.MaxPendingOrdersPerDay > 0, "Payments:MaxPendingOrdersPerDay must be positive.")
            .Validate(
                o => string.IsNullOrWhiteSpace(o.PublicBaseUrl) || (Uri.TryCreate(o.PublicBaseUrl, UriKind.Absolute, out var url) && url.Scheme is "http" or "https"),
                "Payments:PublicBaseUrl must be an absolute http(s) URL (the API's public origin) or empty.")
            .ValidateOnStart();
        services.AddSingleton<IPaymentGateway, FakePaymentGateway>();
        services.AddSingleton<PaymentGateways>();
        services.AddScoped<PromotionService>();
        return services;
    }
}
