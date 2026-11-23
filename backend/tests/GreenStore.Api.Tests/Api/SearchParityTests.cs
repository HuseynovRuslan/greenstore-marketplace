using System.Text.Json;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Api;

/// <summary>
/// The API answers catalogue queries with the same listings as the mock (src/services/marketplace.ts, src/features/
/// services/query.ts). backend/contracts/*-search-parity.json hold queries run against the mock with their results
/// (written by backend/seed/export.mjs from src/); here the same queries run against the seeded database.
/// </summary>
[Collection(CatalogueCollection.Name)]
public sealed class SearchParityTests(CatalogueApi api)
{
    public static TheoryData<string> ListingQueries() => Names("listing-search-parity.json");

    public static TheoryData<string> ServiceQueries() => Names("service-search-parity.json");

    [Theory]
    [MemberData(nameof(ListingQueries))]
    public async Task Listing_search_finds_what_the_mock_finds(string name)
    {
        var vector = Vector("listing-search-parity.json", name);
        var expectedGroups = vector.GetProperty("groups").EnumerateArray()
            .Select(g => g.EnumerateArray().Select(n => n.GetInt64()).Order().ToList())
            .ToList();

        var page = await api.GetAsync($"/api/v1/listings?{vector.GetProperty("query").GetString()}&pageSize={Json.AllOnOnePage}");

        Assert.Equal(vector.GetProperty("total").GetInt32(), page.GetProperty("total").GetInt32());
        // Results with the same sort key (same price, or same promotion and date) form a group whose inner order the
        // mock does not define: compare the groups in order, each as a set.
        var numbers = Json.Numbers(Json.Items(page));
        var actualGroups = new List<List<long>>();
        var offset = 0;
        foreach (var group in expectedGroups)
        {
            actualGroups.Add(numbers.Skip(offset).Take(group.Count).Order().ToList());
            offset += group.Count;
        }

        Assert.Equal(expectedGroups, actualGroups);
        Assert.Equal(offset, numbers.Count);
    }

    [Theory]
    [MemberData(nameof(ServiceQueries))]
    public async Task Service_search_finds_what_the_mock_finds(string name)
    {
        var vector = Vector("service-search-parity.json", name);

        var page = await api.GetAsync($"/api/v1/services?{vector.GetProperty("query").GetString()}");

        Assert.Equal(vector.GetProperty("total").GetInt32(), page.GetProperty("total").GetInt32());
        Assert.Equal(vector.GetProperty("items").EnumerateArray().Select(n => n.GetInt64()).ToList(), Json.Numbers(Json.Items(page)));
    }

    [Fact]
    public void Both_files_have_queries()
    {
        Assert.True(ListingQueries().Count >= 15);
        Assert.True(ServiceQueries().Count >= 8);
    }

    private static JsonElement Load(string file)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "contracts", file)));
        return document.RootElement.Clone();
    }

    private static TheoryData<string> Names(string file)
    {
        var data = new TheoryData<string>();
        foreach (var query in Load(file).GetProperty("queries").EnumerateArray())
        {
            data.Add(query.GetProperty("name").GetString()!);
        }

        return data;
    }

    private static JsonElement Vector(string file, string name) =>
        Load(file).GetProperty("queries").EnumerateArray().Single(q => q.GetProperty("name").GetString() == name);
}
