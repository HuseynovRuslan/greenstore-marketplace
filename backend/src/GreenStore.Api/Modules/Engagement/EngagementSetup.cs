namespace GreenStore.Api.Modules.Engagement;

public static class EngagementSetup
{
    /// <summary>«Seçilmişlər» and saved searches (the endpoints use the context directly, favourites a small service).</summary>
    public static IServiceCollection AddEngagement(this IServiceCollection services) => services.AddScoped<FavoritesService>();
}
