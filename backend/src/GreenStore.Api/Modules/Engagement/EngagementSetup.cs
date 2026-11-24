namespace GreenStore.Api.Modules.Engagement;

public static class EngagementSetup
{
    /// <summary>
    /// «Seçilmişlər», saved searches (phase 2), reports and support (phase 4). Most endpoints use the context directly;
    /// favourites have a small service.
    /// </summary>
    public static IServiceCollection AddEngagement(this IServiceCollection services)
    {
        services.AddScoped<FavoritesService>();
        return services;
    }
}
