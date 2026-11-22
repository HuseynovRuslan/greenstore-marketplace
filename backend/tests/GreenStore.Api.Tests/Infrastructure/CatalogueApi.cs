using System.Net;
using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// The read API over the seeded sample marketplace: a database of its own (migrated, then seeded with the reference
/// and demo files of backend/seed, exactly as Development does) and the real API on it. Shared by the test classes
/// of the <see cref="CatalogueCollection"/>; they only read, so the data stays as seeded. Besides the seed, the
/// database has <see cref="DeletedListingNumber"/>: an active product listing that was deleted.
/// </summary>
public sealed class CatalogueApi(PostgresDatabase database) : IAsyncLifetime
{
    /// <summary>The seeding clock: demo listings that would have expired by then get a new 30-day term from it.</summary>
    public static readonly DateTimeOffset SeededAt = new(2026, 11, 22, 8, 0, 0, TimeSpan.Zero);

    /// <summary>An active product listing with <c>deleted_at</c> set: public endpoints never show it.</summary>
    public const long DeletedListingNumber = 19001;

    public const string DeletedListingSlug = "silinmis-elan-19001";

    private ScratchDatabase? scratch;
    private ApiFactory? root;
    private WebApplicationFactory<Program>? api;

    public string ConnectionString => scratch!.ConnectionString;

    public async ValueTask InitializeAsync()
    {
        scratch = await database.CreateScratchDatabaseAsync("catalogue");
        await using (var db = CreateDbContext())
        {
            await db.Database.MigrateAsync();
            await Seeder.SeedAsync(db, new SeedOptions { Reference = true, Demo = true }, new ManualTimeProvider(SeededAt), NullLogger.Instance);
            await AddDeletedListingAsync(db);
        }

        root = new ApiFactory(database);
        api = root.With(settings: new Dictionary<string, string?> { ["ConnectionStrings:Default"] = scratch.ConnectionString });
    }

    public async ValueTask DisposeAsync()
    {
        if (root is not null)
        {
            await root.DisposeAsync();
        }

        if (scratch is not null)
        {
            await scratch.DisposeAsync();
        }
    }

    public AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch!.ConnectionString);
        options.AddInterceptors(new UpdatedAtInterceptor(new ManualTimeProvider(SeededAt)));
        return new AppDbContext(options.Options);
    }

    /// <summary>A client; <paramref name="language"/> is sent as <c>Accept-Language</c>.</summary>
    public HttpClient Client(string? language = null)
    {
        var client = api!.CreateClient();
        if (language is not null)
        {
            client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(language);
        }

        return client;
    }

    /// <summary>GETs <paramref name="path"/>, asserts 200 and JSON, and returns the body.</summary>
    public async Task<JsonElement> GetAsync(string path, string? language = null)
    {
        var response = await Client(language).GetAsync(path, Ct);
        var body = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"GET {path}: {(int)response.StatusCode} {body}");
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(body);
        return document.RootElement.Clone();
    }

    private static async Task AddDeletedListingAsync(AppDbContext db)
    {
        var owner = await db.Users.OrderBy(u => u.CreatedAt).ThenBy(u => u.Id).FirstAsync();
        var listing = TestListings.Product(owner.Id, DeletedListingNumber, "Silinmiş elan", "agaclar", "baki", SeededAt);
        listing.DeletedAt = SeededAt;
        db.Listings.Add(listing);
        await db.SaveChangesAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class CatalogueCollection : ICollectionFixture<CatalogueApi>
{
    public const string Name = "catalogue";
}

/// <summary>Minimal valid listings for tests that need rows of their own.</summary>
public static class TestListings
{
    /// <summary>An active product listing with a fixed price, published at <paramref name="publishedAt"/>.</summary>
    public static Listing Product(Guid ownerId, long number, string title, string categoryId, string cityId, DateTimeOffset publishedAt) => new()
    {
        Id = Guid.CreateVersion7(publishedAt),
        Number = number,
        Slug = ListingSlug.Create(title, number),
        Kind = CategoryKind.Product,
        OwnerUserId = ownerId,
        CategoryId = categoryId,
        CityId = cityId,
        Status = ListingStatus.Active,
        Title = title,
        PriceType = PriceType.Fixed,
        Price = 10,
        ContactName = "Test",
        ContactPhone = "+994500000999",
        SearchText = ListingSearchText.Build(new ListingSearchInput { Title = title }),
        CreatedAt = publishedAt,
        SubmittedAt = publishedAt,
        PublishedAt = publishedAt,
        SortAt = publishedAt,
        ExpiresAt = publishedAt.AddDays(30),
    };
}

/// <summary>JSON helpers for API responses.</summary>
public static class Json
{
    public static IReadOnlyList<JsonElement> Items(JsonElement page) => page.GetProperty("items").EnumerateArray().ToList();

    public static IReadOnlyList<string> Strings(JsonElement array) => array.EnumerateArray().Select(e => e.GetString()!).ToList();

    public static IReadOnlyList<string> Slugs(JsonElement array) => array.EnumerateArray().Select(e => e.GetProperty("slug").GetString()!).ToList();

    public static IReadOnlyList<long> Numbers(IEnumerable<JsonElement> items) => items.Select(e => e.GetProperty("number").GetInt64()).ToList();

    public static string? String(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    /// <summary>The page size the tests ask for to get every seeded listing on one page.</summary>
    public const int AllOnOnePage = PageRequest.MaxPageSize;
}
