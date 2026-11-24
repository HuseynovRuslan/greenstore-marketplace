using System.Text.Json;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Platform;

/// <summary>The kinds of <see cref="OutboxMessage"/>.</summary>
public static class OutboxTypes
{
    /// <summary>Tell the site to refresh cached pages: <c>{"tags": ["listing:…", "listings", …]}</c>.</summary>
    public const string Revalidate = "revalidate";
}

/// <summary>The body of a <see cref="OutboxTypes.Revalidate"/> message, and what the site's <c>POST /api/revalidate</c> receives.</summary>
public sealed record RevalidatePayload(IReadOnlyList<string> Tags);

/// <summary>
/// Cache refresh notices (ARCHITECTURE.md §10). The site's public reads are cached with tags (src/services/apiRepository.ts
/// <c>TAG</c>); after a change the API names the tags the change touches, in the same transaction as the change, and
/// the outbox job sends them to the site.
/// </summary>
public static class Revalidation
{
    public const string Home = "home";

    /// <summary>Categories and cities (<c>TAG.taxonomy</c> of the site).</summary>
    public const string Taxonomy = "taxonomy";

    /// <summary>
    /// What a listing's change touches: its page (by id and by slug, the old slug too), the catalogue, the home page,
    /// the sitemap and, for a business, its seller page; a service also its provider's pages.
    /// </summary>
    public static IReadOnlyList<string> TagsFor(Listing listing, string? sellerSlug = null, string? previousSlug = null)
    {
        var service = listing.Kind == CategoryKind.Service;
        var page = service ? "service" : "listing";
        var tags = new List<string>
        {
            $"{page}:{listing.Id}",
            $"{page}:{listing.Slug}",
            service ? "services" : "listings",
            Home,
            $"sitemap:{page}",
        };
        if (previousSlug is not null && previousSlug != listing.Slug)
        {
            tags.Add($"{page}:{previousSlug}");
        }

        if (service)
        {
            tags.Add($"provider:{listing.OwnerUserId}");
        }

        if (listing.SellerId is { } sellerId)
        {
            tags.Add($"seller:{sellerId}");
            if (sellerSlug is not null)
            {
                tags.Add($"seller:{sellerSlug}");
            }

            tags.Add("sellers");
        }

        return tags;
    }

    /// <summary>
    /// What a business profile's change touches (its name, logo and cover, its «Təsdiqlənmiş» badge): its page by id and
    /// by slug, the directory, the home page and its services' provider pages.
    /// </summary>
    public static IReadOnlyList<string> TagsFor(Seller seller) =>
        [$"seller:{seller.Id}", $"seller:{seller.Slug}", "sellers", Home, "services", $"provider:{seller.OwnerUserId}"];

    /// <summary>
    /// The most tags one notice may name: the site's <c>/api/revalidate</c> refuses more with 400
    /// (<c>MAX_TAGS</c> in src/services/revalidation.ts; src/test/listingCycleApi.test.ts keeps the two equal).
    /// </summary>
    public const int MaxTagsPerNotice = 64;

    /// <summary>
    /// Adds the notice to the context; it is saved with the change. More tags than one notice may name (the expiry job
    /// ends hundreds of listings at once) become several notices of at most <see cref="MaxTagsPerNotice"/> tags.
    /// </summary>
    public static void Enqueue(AppDbContext db, IEnumerable<string> tags, DateTimeOffset now)
    {
        foreach (var notice in Notices(tags))
        {
            db.Outbox.Add(new OutboxMessage
            {
                Type = OutboxTypes.Revalidate,
                Payload = JsonSerializer.Serialize(new RevalidatePayload(notice), ColumnMapping.StorageJson),
                NextAttemptAt = now,
                CreatedAt = now,
            });
        }
    }

    /// <summary>The tags, each once and in their order, in notices of at most <see cref="MaxTagsPerNotice"/>.</summary>
    public static IReadOnlyList<string[]> Notices(IEnumerable<string> tags) =>
        tags.Distinct(StringComparer.Ordinal).Chunk(MaxTagsPerNotice).ToList();
}

/// <summary>Staff actions in <c>audit_log</c> (ARCHITECTURE.md §14).</summary>
public static class Audit
{
    public static void Add(AppDbContext db, Guid actor, string action, string targetType, string targetId, object? data, DateTimeOffset now) =>
        db.AuditLog.Add(new AuditEntry
        {
            ActorUserId = actor,
            Action = action,
            TargetType = targetType,
            TargetId = targetId,
            Data = data is null ? null : JsonSerializer.Serialize(data, ColumnMapping.StorageJson),
            CreatedAt = now,
        });
}
