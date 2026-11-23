using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Seçilmişlər» of an account (backend-contract.md 2.3), and the listing's favourites counter.</summary>
[Collection(AccountsCollection.Name)]
public sealed class FavoritesTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private async Task<(Guid Id, CategoryKind Kind)[]> ActiveAsync(CategoryKind kind, int count)
    {
        await using var db = api.CreateDbContext();
        var ids = await db.Listings
            .Where(l => l.Kind == kind && l.Status == ListingStatus.Active && l.DeletedAt == null)
            .OrderBy(l => l.Number)
            .Select(l => l.Id)
            .Take(count)
            .ToListAsync(Ct);
        return ids.Select(id => (id, kind)).ToArray();
    }

    private async Task<int> FavouritesOfAsync(Guid listingId)
    {
        await using var db = api.CreateDbContext();
        return await db.ListingCounters.Where(c => c.ListingId == listingId).Select(c => c.Favourites).SingleAsync(Ct);
    }

    private static string Key(string kind, Guid id) => $"{kind}:{id}";

    [Fact]
    public async Task A_favourite_is_added_once_and_counted_once()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var (listing, _) = (await ActiveAsync(CategoryKind.Product, 1))[0];
        var before = await FavouritesOfAsync(listing);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/v1/me/favorites/listing/{listing}", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/v1/me/favorites/listing/{listing}", null, Ct)).StatusCode);

        Assert.Equal([Key("listing", listing)], Json.Strings(await api.GetAsync("/api/v1/me/favorites", account.Token)));
        Assert.Equal(before + 1, await FavouritesOfAsync(listing));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/me/favorites/listing/{listing}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/me/favorites/listing/{listing}", Ct)).StatusCode);

        Assert.Empty((await api.GetAsync("/api/v1/me/favorites", account.Token)).EnumerateArray());
        Assert.Equal(before, await FavouritesOfAsync(listing));
    }

    [Fact]
    public async Task Services_are_favourites_of_their_own_kind()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var (service, _) = (await ActiveAsync(CategoryKind.Service, 1))[0];
        var (listing, _) = (await ActiveAsync(CategoryKind.Product, 1))[0];

        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/v1/me/favorites/service/{service}", null, Ct)).StatusCode);
        await ProblemAsync(await client.PutAsync($"/api/v1/me/favorites/listing/{service}", null, Ct), HttpStatusCode.NotFound, "listing.not-found");
        await ProblemAsync(await client.PutAsync($"/api/v1/me/favorites/service/{listing}", null, Ct), HttpStatusCode.NotFound, "service.not-found");
        await ProblemAsync(await client.PutAsync($"/api/v1/me/favorites/seller/{listing}", null, Ct), HttpStatusCode.NotFound, "not-found");

        Assert.Equal([Key("service", service)], Json.Strings(await api.GetAsync("/api/v1/me/favorites", account.Token)));
    }

    [Fact]
    public async Task Only_a_public_listing_can_become_a_favourite()
    {
        var account = await api.RegisterAsync();
        Guid pending;
        await using (var db = api.CreateDbContext())
        {
            pending = await db.Listings.Where(l => l.Kind == CategoryKind.Product && l.Status == ListingStatus.Pending).Select(l => l.Id).FirstAsync(Ct);
        }

        await ProblemAsync(await api.Client(account.Token).PutAsync($"/api/v1/me/favorites/listing/{pending}", null, Ct), HttpStatusCode.NotFound, "listing.not-found");
        await ProblemAsync(await api.Client(account.Token).PutAsync($"/api/v1/me/favorites/listing/{Guid.CreateVersion7()}", null, Ct), HttpStatusCode.NotFound, "listing.not-found");
    }

    [Fact]
    public async Task A_guests_favourites_merge_into_the_account_in_their_order()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var products = await ActiveAsync(CategoryKind.Product, 3);
        var (service, _) = (await ActiveAsync(CategoryKind.Service, 1))[0];
        await client.PutAsync($"/api/v1/me/favorites/listing/{products[0].Id}", null, Ct);
        var before = await FavouritesOfAsync(products[2].Id);
        api.Clock.Advance(TimeSpan.FromSeconds(1));

        var response = await client.PostAsJsonAsync(
            "/api/v1/me/favorites/merge",
            new
            {
                keys = new[]
                {
                    Key("listing", products[2].Id),
                    "listing:l-12",
                    Key("service", service),
                    Key("listing", products[0].Id),
                    Key("service", products[1].Id),
                    Key("listing", products[2].Id),
                    "garbage",
                    Key("listing", products[1].Id),
                },
            },
            Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // Already saved first; then the new ones in the guest's order. The key of the wrong kind is skipped, the
        // right key of the same listing later in the list is not.
        var expected = new[] { Key("listing", products[0].Id), Key("listing", products[2].Id), Key("service", service), Key("listing", products[1].Id) };
        Assert.Equal(expected, Json.Strings(await JsonAsync(response)));
        Assert.Equal(expected, Json.Strings(await api.GetAsync("/api/v1/me/favorites", account.Token)));
        Assert.Equal(before + 1, await FavouritesOfAsync(products[2].Id));

        // Merging the same list again changes nothing.
        await client.PostAsJsonAsync("/api/v1/me/favorites/merge", new { keys = expected }, Ct);
        Assert.Equal(before + 1, await FavouritesOfAsync(products[2].Id));
    }

    [Fact]
    public async Task A_merge_takes_at_most_500_keys()
    {
        var account = await api.RegisterAsync();
        var keys = Enumerable.Range(0, 501).Select(_ => Key("listing", Guid.CreateVersion7())).ToArray();

        var response = await api.Client(account.Token).PostAsJsonAsync("/api/v1/me/favorites/merge", new { keys }, Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.BadRequest, "validation");
        Assert.Equal("too-many", problem.GetProperty("errors").GetProperty("keys")[0].GetString());
    }

    [Fact]
    public async Task The_favourites_page_gets_the_cards()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var products = await ActiveAsync(CategoryKind.Product, 2);
        var (service, _) = (await ActiveAsync(CategoryKind.Service, 1))[0];
        await client.PostAsJsonAsync("/api/v1/me/favorites/merge", new { keys = new[] { Key("listing", products[1].Id), Key("service", service), Key("listing", products[0].Id) } }, Ct);

        var items = await api.GetAsync("/api/v1/me/favorites/items", account.Token);

        Assert.Empty(Contract.Check(items, "FavoriteItems"));
        Assert.Equal([products[1].Id.ToString(), products[0].Id.ToString()], items.GetProperty("listings").EnumerateArray().Select(l => l.GetProperty("id").GetString()));
        Assert.Equal(service.ToString(), items.GetProperty("services")[0].GetProperty("id").GetString());

        // A listing that is no longer public keeps its key but has no card.
        await using (var db = api.CreateDbContext())
        {
            await db.Listings.Where(l => l.Id == products[1].Id).ExecuteUpdateAsync(l => l.SetProperty(x => x.Status, ListingStatus.Inactive), Ct);
        }

        try
        {
            var after = await api.GetAsync("/api/v1/me/favorites/items", account.Token);
            Assert.Single(after.GetProperty("listings").EnumerateArray());
            Assert.Equal(3, (await api.GetAsync("/api/v1/me/favorites", account.Token)).GetArrayLength());
        }
        finally
        {
            await using var db = api.CreateDbContext();
            await db.Listings.Where(l => l.Id == products[1].Id).ExecuteUpdateAsync(l => l.SetProperty(x => x.Status, ListingStatus.Active), Ct);
        }
    }

    [Fact]
    public async Task Each_account_has_its_own_favourites()
    {
        var mine = await api.RegisterAsync();
        var theirs = await api.RegisterAsync();
        var (listing, _) = (await ActiveAsync(CategoryKind.Product, 1))[0];
        await api.Client(theirs.Token).PutAsync($"/api/v1/me/favorites/listing/{listing}", null, Ct);

        Assert.Empty((await api.GetAsync("/api/v1/me/favorites", mine.Token)).EnumerateArray());
        await api.Client(mine.Token).DeleteAsync($"/api/v1/me/favorites/listing/{listing}", Ct);
        Assert.Single((await api.GetAsync("/api/v1/me/favorites", theirs.Token)).EnumerateArray());
    }

    [Fact]
    public async Task Favourites_need_a_session() =>
        await ProblemAsync(await api.Client().GetAsync("/api/v1/me/favorites", Ct), HttpStatusCode.Unauthorized, "unauthorized");
}
