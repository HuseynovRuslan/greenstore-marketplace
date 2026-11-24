using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules;

/// <summary>
/// The public HTTP API. Every endpoint lives under <see cref="Prefix"/> (ARCHITECTURE.md §7); a breaking change goes
/// to /api/v2, never into v1, once the mobile app uses it.
/// </summary>
public static class ApiRoutes
{
    public const string Prefix = "/api/v1";

    /// <summary>
    /// Maps the modules' endpoints. Each module folder (Modules/&lt;Module&gt;/) has a static <c>Map…</c> extension
    /// that adds its routes to this group.
    /// </summary>
    public static RouteGroupBuilder MapApiV1(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup(Prefix);
        api.MapTaxonomy();
        api.MapListings();
        api.MapServices();
        api.MapSellers();
        api.MapSitemap();
        api.MapAccounts();
        api.MapSellerProfile();
        api.MapFavorites();
        api.MapSavedSearches();
        api.MapPhotos();
        api.MapOwnListings();
        api.MapListingCounters();
        api.MapModeration();
        api.MapReports();
        api.MapSupport();
        api.MapAdminOverview();
        api.MapAdminReports();
        api.MapAdminCategories();
        api.MapAdminAccounts();
        api.MapPromotion();

        foreach (var extra in app.ServiceProvider.GetServices<IExtraApiEndpoints>())
        {
            extra.Map(api);
        }

        return api;
    }
}

/// <summary>
/// Endpoints added to the v1 group from the service container. The API registers none: only the integration tests do,
/// for their test-only endpoints, so those pass through exactly the pipeline and group that module endpoints get
/// (exception handler, status code pages, routing, rate limiter, group conventions).
/// </summary>
public interface IExtraApiEndpoints
{
    void Map(RouteGroupBuilder api);
}
