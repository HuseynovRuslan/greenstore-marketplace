using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// The keys of «Seçilmişlər» as the site stores them (src/state/store.tsx <c>favKey</c>): <c>listing:&lt;id&gt;</c>
/// for a product listing, <c>service:&lt;id&gt;</c> for a service.
/// </summary>
public static class FavoriteKeys
{
    public const string Listing = "listing";
    public const string Service = "service";

    public static string Format(CategoryKind kind, Guid id) => $"{KindName(kind)}:{id}";

    /// <summary><c>listing</c> → product, <c>service</c> → service (the URL segment of PUT/DELETE too).</summary>
    public static bool TryParseKind(string? value, out CategoryKind kind)
    {
        kind = value == Service ? CategoryKind.Service : CategoryKind.Product;
        return value is Listing or Service;
    }

    /// <summary>
    /// A well-formed key. Anything else is not ours (the demo's ids such as <c>listing:l-12</c> in a guest's browser),
    /// and merging skips it.
    /// </summary>
    public static bool TryParse(string? key, out CategoryKind kind, out Guid id)
    {
        id = Guid.Empty;
        kind = CategoryKind.Product;
        var colon = key?.IndexOf(':') ?? -1;
        return colon > 0
            && TryParseKind(key![..colon], out kind)
            && Guid.TryParseExact(key[(colon + 1)..], "D", out id);
    }

    public static string KindName(CategoryKind kind) => kind == CategoryKind.Service ? Service : Listing;
}
