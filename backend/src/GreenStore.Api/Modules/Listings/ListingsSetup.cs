using GreenStore.Api.Modules.Platform;

namespace GreenStore.Api.Modules.Listings;

public static class ListingsSetup
{
    /// <summary>The listing lifecycle (phase 3): writes, idempotent POSTs and their settings.</summary>
    public static IServiceCollection AddListingLifecycle(this IServiceCollection services)
    {
        services.AddOptions<ListingsOptions>()
            .BindConfiguration(ListingsOptions.Section)
            .Validate(o => o.MaxSubmissionsPerDay > 0 && o.MaxDraftsPerUser > 0 && o.MaxDraftBytes > 0, "Listings: the limits must be positive.")
            .ValidateOnStart();
        services.AddScoped<ListingWriteService>();
        services.AddScoped<IdempotentRequests>();
        return services;
    }
}
