using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Axtarışı yadda saxla» (backend-contract.md 2.3): saved catalogue searches and their new matches.</summary>
[Collection(AccountsCollection.Name)]
public sealed class SavedSearchesTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static Task<HttpResponseMessage> Save(HttpClient client, string name, string query, bool alerts = false) =>
        client.PostAsJsonAsync("/api/v1/me/saved-searches", new { name, query, alerts }, Ct);

    private static async Task<JsonElement> CreatedAsync(HttpResponseMessage response)
    {
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"{(int)response.StatusCode} {body}");
        return body;
    }

    /// <summary>A new active «Ağaclar» listing in Bakı, published now.</summary>
    private async Task<long> PublishAsync(string title, string categoryId = "agaclar", string cityId = "baki")
    {
        await using var db = api.CreateDbContext();
        var owner = await db.Users.OrderBy(u => u.CreatedAt).Select(u => u.Id).FirstAsync(Ct);
        var number = await db.Listings.MaxAsync(l => l.Number, Ct) + 1;
        db.Listings.Add(TestListings.Product(owner, number, title, categoryId, cityId, api.Clock.GetUtcNow()));
        await db.SaveChangesAsync(Ct);
        return number;
    }

    [Fact]
    public async Task A_search_is_saved_without_page_sort_and_view()
    {
        var account = await api.RegisterAsync();

        var saved = await CreatedAsync(await Save(api.Client(account.Token), " Bakıda ağaclar ", "seher=baki&kateqoriya=agaclar&sehife=2&siralama=ucuz", alerts: true));

        Assert.Empty(Contract.Check(saved, "SavedSearch"));
        Assert.Equal("Bakıda ağaclar", saved.GetProperty("name").GetString());
        Assert.Equal("kateqoriya=agaclar&seher=baki", saved.GetProperty("query").GetString());
        Assert.True(saved.GetProperty("alerts").GetBoolean());
        Assert.Equal(0, saved.GetProperty("newCount").GetInt32());
        Assert.Empty(Contract.Check(await api.GetAsync("/api/v1/me/saved-searches", account.Token), "SavedSearch[]"));
    }

    [Fact]
    public async Task Saving_the_same_search_again_updates_it()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var first = await CreatedAsync(await Save(client, "Tuya", "q=tuya&max=50"));

        var again = await Save(client, "Ucuz tuya", "max=50&q=tuya&gorunus=siyahi", alerts: true);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        var body = await JsonAsync(again);
        Assert.Equal(first.GetProperty("id").GetString(), body.GetProperty("id").GetString());
        Assert.Equal("Ucuz tuya", body.GetProperty("name").GetString());
        Assert.True(body.GetProperty("alerts").GetBoolean());
        Assert.Single((await api.GetAsync("/api/v1/me/saved-searches", account.Token)).EnumerateArray());
    }

    [Fact]
    public async Task New_matches_are_counted_until_the_search_is_opened()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var word = $"sınaq{Guid.NewGuid():N}"[..14];
        var saved = await CreatedAsync(await Save(client, "Sınaq", $"q={Uri.EscapeDataString(word)}&kateqoriya=agaclar&seher=baki"));
        var id = saved.GetProperty("id").GetString();

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        await PublishAsync($"Ağac {word} bir");
        await PublishAsync($"Ağac {word} iki");
        await PublishAsync($"Ağac {word} Qubada", cityId: "quba");
        await PublishAsync("Başqa ağac");

        var list = await api.GetAsync("/api/v1/me/saved-searches", account.Token);
        Assert.Equal(2, list.EnumerateArray().Single(s => s.GetProperty("id").GetString() == id).GetProperty("newCount").GetInt32());

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var opened = await client.PostAsync($"/api/v1/me/saved-searches/{id}/opened", null, Ct);
        Assert.Equal(HttpStatusCode.OK, opened.StatusCode);
        Assert.Equal(0, (await JsonAsync(opened)).GetProperty("newCount").GetInt32());

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        await PublishAsync($"Ağac {word} üç");
        var after = await api.GetAsync("/api/v1/me/saved-searches", account.Token);
        Assert.Equal(1, after.EnumerateArray().Single(s => s.GetProperty("id").GetString() == id).GetProperty("newCount").GetInt32());
    }

    [Fact]
    public async Task The_name_and_alerts_can_be_changed_and_the_search_deleted()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var id = (await CreatedAsync(await Save(client, "Güllər", "kateqoriya=gul-ve-bitkiler"))).GetProperty("id").GetString();

        var renamed = await client.PatchAsync($"/api/v1/me/saved-searches/{id}", new StringContent("""{ "name": "Qızılgüllər" }""", Encoding.UTF8, "application/json"), Ct);
        Assert.Equal("Qızılgüllər", (await JsonAsync(renamed)).GetProperty("name").GetString());
        var alerts = await client.PatchAsync($"/api/v1/me/saved-searches/{id}", new StringContent("""{ "alerts": true }""", Encoding.UTF8, "application/json"), Ct);
        var body = await JsonAsync(alerts);
        Assert.True(body.GetProperty("alerts").GetBoolean());
        Assert.Equal("Qızılgüllər", body.GetProperty("name").GetString());
        var empty = await client.PatchAsync($"/api/v1/me/saved-searches/{id}", new StringContent("""{ "name": " " }""", Encoding.UTF8, "application/json"), Ct);
        await ProblemAsync(empty, HttpStatusCode.BadRequest, "validation");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/me/saved-searches/{id}", Ct)).StatusCode);
        Assert.Empty((await api.GetAsync("/api/v1/me/saved-searches", account.Token)).EnumerateArray());
        await ProblemAsync(await client.DeleteAsync($"/api/v1/me/saved-searches/{id}", Ct), HttpStatusCode.NotFound, "saved-search.not-found");
    }

    [Fact]
    public async Task Another_users_search_is_not_found()
    {
        var mine = await api.RegisterAsync();
        var theirs = await api.RegisterAsync();
        var id = (await CreatedAsync(await Save(api.Client(theirs.Token), "Onların", "q=tuya"))).GetProperty("id").GetString();
        var client = api.Client(mine.Token);

        await ProblemAsync(await client.DeleteAsync($"/api/v1/me/saved-searches/{id}", Ct), HttpStatusCode.NotFound, "saved-search.not-found");
        await ProblemAsync(await client.PostAsync($"/api/v1/me/saved-searches/{id}/opened", null, Ct), HttpStatusCode.NotFound, "saved-search.not-found");
        await ProblemAsync(
            await client.PatchAsync($"/api/v1/me/saved-searches/{id}", new StringContent("""{ "name": "Mənim" }""", Encoding.UTF8, "application/json"), Ct),
            HttpStatusCode.NotFound,
            "saved-search.not-found");
        Assert.Single((await api.GetAsync("/api/v1/me/saved-searches", theirs.Token)).EnumerateArray());
        Assert.Empty((await api.GetAsync("/api/v1/me/saved-searches", mine.Token)).EnumerateArray());
    }

    [Fact]
    public async Task An_account_keeps_its_20_newest_searches()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        for (var i = 1; i <= 21; i++)
        {
            await CreatedAsync(await Save(client, $"Axtarış {i}", $"q=soz{i}"));
            api.Clock.Advance(TimeSpan.FromSeconds(1));
        }

        var list = await api.GetAsync("/api/v1/me/saved-searches", account.Token);

        Assert.Equal(20, list.GetArrayLength());
        Assert.Equal("Axtarış 21", list[0].GetProperty("name").GetString());
        Assert.Equal("Axtarış 2", list[19].GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_name_and_a_short_query_are_needed()
    {
        var account = await api.RegisterAsync();

        var problem = await ProblemAsync(await Save(api.Client(account.Token), "", "q=" + new string('a', 600)), HttpStatusCode.BadRequest, "validation");

        Assert.Equal("required", problem.GetProperty("errors").GetProperty("name")[0].GetString());
        Assert.Equal("too-long", problem.GetProperty("errors").GetProperty("query")[0].GetString());
    }

    [Fact]
    public async Task The_stored_filter_is_the_apis_search_model()
    {
        var account = await api.RegisterAsync();
        var id = (await CreatedAsync(await Save(api.Client(account.Token), "Ağaclar", "kateqoriya=agaclar&kok=dibcek&nov=olea"))).GetProperty("id").GetString();

        await using var db = api.CreateDbContext();
        var row = await db.SavedSearches.SingleAsync(s => s.Id == Guid.Parse(id!), Ct);
        Assert.Equal("agaclar", row.Filter.CategoryId);
        Assert.Equal(RootSystem.Container, row.Filter.RootSystem);
        Assert.Equal("kateqoriya=agaclar&kok=dibcek&nov=olea", row.Query);
    }
}
