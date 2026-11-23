using System.Globalization;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// <c>GET /sitemap/{listing|seller|service}?cursor&amp;limit</c> (backend-contract.md 1.1): the public addresses for
/// sitemap.xml, a page at a time, in place of reading every listing. Each entry is a slug and its last change.
/// <c>nextCursor</c> is set while more entries follow; pass it back as <c>cursor</c>. The cursor is opaque to clients.
/// </summary>
public static class SitemapEndpoints
{
    public const int DefaultLimit = 1000;
    public const int MaxLimit = 5000;

    public static RouteGroupBuilder MapSitemap(this RouteGroupBuilder api)
    {
        api.MapGet("/sitemap/{kind}", Get).WithTags("Sitemap");
        return api;
    }

    private static async Task<Ok<SitemapPageDto>> Get(string kind, HttpContext http, AppDbContext db, CancellationToken ct)
    {
        if (!KebabCase.TryParse<SitemapKind>(kind, out var sitemap))
        {
            throw ApiProblemException.NotFound();
        }

        var query = new QueryReader(http.Request.Query);
        var cursor = query.String("cursor");
        var limit = query.Int("limit", min: 1, max: MaxLimit) ?? DefaultLimit;
        long? afterNumber = null;
        if (cursor is not null && sitemap != SitemapKind.Seller)
        {
            if (long.TryParse(cursor, NumberStyles.None, CultureInfo.InvariantCulture, out var number))
            {
                afterNumber = number;
            }
            else
            {
                query.Fail("cursor", QueryReader.Invalid);
            }
        }

        query.ThrowIfInvalid();

        var page = sitemap == SitemapKind.Seller
            ? await SellersAsync(db, cursor, limit, ct)
            : await ListingsAsync(db, sitemap == SitemapKind.Service ? CategoryKind.Service : CategoryKind.Product, afterNumber, limit, ct);
        return TypedResults.Ok(page);
    }

    /// <summary>Listings or services by number; a listing changes when it is published, edited or lifted.</summary>
    private static async Task<SitemapPageDto> ListingsAsync(AppDbContext db, CategoryKind kind, long? after, int limit, CancellationToken ct)
    {
        var listings = db.Listings.AsNoTracking().Public(kind);
        if (after is { } number)
        {
            listings = listings.Where(l => l.Number > number);
        }

        var rows = await listings.OrderBy(l => l.Number)
            .Select(l => new { l.Number, l.Slug, l.PublishedAt, l.EditedAt, l.BumpedAt, l.CreatedAt })
            .Take(limit + 1)
            .ToListAsync(ct);
        var items = rows.Take(limit)
            .Select(r => new SitemapEntryDto(r.Slug, Latest(r.PublishedAt ?? r.CreatedAt, r.EditedAt, r.BumpedAt)))
            .ToList();
        var next = rows.Count > limit ? rows[limit - 1].Number.ToString(CultureInfo.InvariantCulture) : null;
        return new SitemapPageDto(items, next);
    }

    /// <summary>Seller pages by slug.</summary>
    private static async Task<SitemapPageDto> SellersAsync(AppDbContext db, string? after, int limit, CancellationToken ct)
    {
        var sellers = db.Sellers.AsNoTracking();
        if (after is not null)
        {
            sellers = sellers.Where(s => string.Compare(s.Slug, after) > 0);
        }

        var rows = await sellers.OrderBy(s => s.Slug)
            .Select(s => new { s.Slug, s.UpdatedAt })
            .Take(limit + 1)
            .ToListAsync(ct);
        var items = rows.Take(limit).Select(r => new SitemapEntryDto(r.Slug, r.UpdatedAt)).ToList();
        var next = rows.Count > limit ? rows[limit - 1].Slug : null;
        return new SitemapPageDto(items, next);
    }

    private static DateTimeOffset Latest(DateTimeOffset first, params DateTimeOffset?[] others) =>
        others.Aggregate(first, (latest, other) => other is { } value && value > latest ? value : latest);
}

/// <summary><c>SitemapKind</c>: what a sitemap lists.</summary>
public enum SitemapKind
{
    Listing,
    Seller,
    Service,
}

public sealed record SitemapEntryDto(string Slug, DateTimeOffset UpdatedAt);

public sealed record SitemapPageDto(IReadOnlyList<SitemapEntryDto> Items, string? NextCursor = null);
