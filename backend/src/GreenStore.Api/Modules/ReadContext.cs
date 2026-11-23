using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules;

/// <summary>
/// What turning rows into public DTOs needs: the request's language (names and the few texts), the taxonomy to name
/// categories and cities, and the photo address rule.
/// </summary>
public sealed record ReadContext(Language Language, TaxonomySnapshot Taxonomy, string MediaBaseUrl)
{
    public string? PhotoUrl(Photo? photo) => PhotoUrls.Of(photo, MediaBaseUrl);

    public static async Task<ReadContext> CreateAsync(HttpContext http, AppDbContext db, CancellationToken cancellationToken)
    {
        var media = http.RequestServices.GetRequiredService<IOptions<MediaOptions>>().Value;
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, cancellationToken);
        return new ReadContext(http.GetLanguage(), taxonomy, media.BaseUrl);
    }
}
