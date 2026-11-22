namespace GreenStore.Api.Modules.Engagement;

public static class EngagementSetup
{
    /// <summary>
    /// «Seçilmişlər», saved searches (phase 2), reports, «Usta çağır» and support (phase 4). Most endpoints use the
    /// context directly; favourites and service requests have a small service each.
    /// </summary>
    public static IServiceCollection AddEngagement(this IServiceCollection services)
    {
        services.AddOptions<ServiceRequestOptions>()
            .BindConfiguration(ServiceRequestOptions.Section)
            .Validate(
                o => o.MaxRecipients > 0 && o.MaxPerPhonePerDay > 0 && o.MaxPerIpPerDay > 0 && o.DailyNoticeCap >= 0,
                "ServiceRequests: the limits must be positive (DailyNoticeCap may be 0: no SMS notices).")
            .ValidateOnStart();
        services.AddScoped<FavoritesService>();
        services.AddScoped<ServiceRequestService>();
        services.AddScoped<ServiceRequestNotices>();
        return services;
    }
}
