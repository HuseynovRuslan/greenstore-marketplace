using System.Net;
using System.Text.Json;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

/// <summary>Home, catalogue, filter counts and listing pages over the seeded sample marketplace.</summary>
[Collection(CatalogueCollection.Name)]
public sealed class ListingsEndpointsTests(CatalogueApi api)
{
    private const int ActiveProducts = 49;

    private async Task<int> TotalAsync(string query) => (await api.GetAsync($"/api/v1/listings?{query}&pageSize=1")).GetProperty("total").GetInt32();

    private async Task<string> SlugAsync(long number)
    {
        await using var db = api.CreateDbContext();
        return await db.Listings.Where(l => l.Number == number).Select(l => l.Slug).SingleAsync(Ct);
    }

    /* ---------- Home ---------- */

    [Fact]
    public async Task Home_shows_promoted_and_latest_listings_featured_businesses_and_services()
    {
        var home = await api.GetAsync("/api/v1/home");

        var vip = home.GetProperty("vip").EnumerateArray().ToList();
        var latest = home.GetProperty("latest").EnumerateArray().ToList();
        Assert.Equal([10603, 10482, 10601, 10602], Json.Numbers(vip));
        Assert.All(vip, l => Assert.True(l.GetProperty("vip").GetBoolean()));
        // The photographed listings, newest first: the mock's latestListingIds.
        Assert.Equal([10604, 10605, 10606, 10610, 10362, 10609, 10607, 10608], Json.Numbers(latest));
        Assert.All(latest, l => Assert.False(l.GetProperty("vip").GetBoolean()));

        var sellers = home.GetProperty("sellers").EnumerateArray().ToList();
        Assert.Equal(["yasil-bag-merkezi", "quba-fidan", "abseron-tingcilik"], sellers.Select(s => s.GetProperty("slug").GetString()));
        Assert.All(sellers, s => Assert.True(s.GetProperty("verified").GetBoolean()));

        var services = home.GetProperty("services").EnumerateArray().ToList();
        Assert.Equal([20316, 20317, 20318], services.Select(s => s.GetProperty("service").GetProperty("number").GetInt64()));
        Assert.All(services, s => Assert.Equal(s.GetProperty("service").GetProperty("cover").GetString(), s.GetProperty("image").GetString()));
    }

    /* ---------- Catalogue ---------- */

    [Fact]
    public async Task The_catalogue_is_paged()
    {
        var all = Json.Numbers(Json.Items(await api.GetAsync($"/api/v1/listings?pageSize={Json.AllOnOnePage}")));
        var second = await api.GetAsync("/api/v1/listings?page=2&pageSize=10");
        var pastTheEnd = await api.GetAsync("/api/v1/listings?page=99&pageSize=10");
        var byDefault = await api.GetAsync("/api/v1/listings");

        Assert.Equal(ActiveProducts, all.Count);
        Assert.Equal(all.Skip(10).Take(10), Json.Numbers(Json.Items(second)));
        Assert.Equal((ActiveProducts, 2, 5), (second.GetProperty("total").GetInt32(), second.GetProperty("page").GetInt32(), second.GetProperty("pageCount").GetInt32()));
        // A page past the end answers the last page and says so, like the mock repository.
        Assert.Equal(5, pastTheEnd.GetProperty("page").GetInt32());
        Assert.Equal(all.Skip(40), Json.Numbers(Json.Items(pastTheEnd)));
        Assert.Equal(24, Json.Items(byDefault).Count);
        Assert.Equal(3, byDefault.GetProperty("pageCount").GetInt32());
    }

    [Fact]
    public async Task Nothing_found_is_one_empty_page()
    {
        var page = await api.GetAsync("/api/v1/listings?q=kaktus");

        Assert.Empty(Json.Items(page));
        Assert.Equal((0, 1, 1), (page.GetProperty("total").GetInt32(), page.GetProperty("page").GetInt32(), page.GetProperty("pageCount").GetInt32()));
    }

    [Fact]
    public async Task Sorting_by_price_and_by_date()
    {
        var cheap = Json.Items(await api.GetAsync($"/api/v1/listings?sort=price-asc&pageSize={Json.AllOnOnePage}")).Select(Price).ToList();
        var dear = Json.Items(await api.GetAsync($"/api/v1/listings?sort=price-desc&pageSize={Json.AllOnOnePage}")).Select(Price).ToList();
        var newest = Json.Items(await api.GetAsync($"/api/v1/listings?sort=newest&pageSize={Json.AllOnOnePage}"));

        Assert.Equal(cheap.Order(), cheap);
        Assert.Equal(dear.OrderDescending(), dear);
        // «Önə çıxan» first, then the newest.
        var promoted = newest.TakeWhile(l => l.GetProperty("vip").GetBoolean()).Count();
        Assert.Equal(4, promoted);
        Assert.DoesNotContain(newest.Skip(promoted), l => l.GetProperty("vip").GetBoolean());
        var dates = newest.Skip(promoted).Select(l => l.GetProperty("publishedAt").GetDateTimeOffset()).ToList();
        Assert.Equal(dates.OrderDescending(), dates);
    }

    [Fact]
    public async Task Each_filter_narrows_the_catalogue()
    {
        var bySeller = Json.Items(await api.GetAsync($"/api/v1/listings?sellerType=business&pageSize={Json.AllOnOnePage}"));
        var sellerId = bySeller[0].GetProperty("sellerId").GetString();
        var oneSeller = Json.Items(await api.GetAsync($"/api/v1/listings?sellerId={sellerId}&pageSize={Json.AllOnOnePage}"));
        var individuals = Json.Items(await api.GetAsync($"/api/v1/listings?sellerType=individual&pageSize={Json.AllOnOnePage}"));

        Assert.NotEmpty(oneSeller);
        Assert.All(oneSeller, l => Assert.Equal(sellerId, l.GetProperty("sellerId").GetString()));
        Assert.Equal(ActiveProducts, bySeller.Count + individuals.Count);
        Assert.All(individuals, l => Assert.False(l.TryGetProperty("sellerId", out _)));

        var young = Json.Items(await api.GetAsync($"/api/v1/listings?ageMin=2&ageMax=4&pageSize={Json.AllOnOnePage}"));
        Assert.Equal(SeededActive().Count(l => l.Plant?.AgeYears is >= 2 and <= 4), young.Count);
        Assert.All(young, l => Assert.InRange(l.GetProperty("plant").GetProperty("ageYears").GetInt32(), 2, 4));

        var tall = Json.Items(await api.GetAsync($"/api/v1/listings?heightMin=250&pageSize={Json.AllOnOnePage}"));
        Assert.All(tall, l =>
        {
            var height = l.GetProperty("plant").GetProperty("heightCm");
            Assert.True((height.TryGetProperty("max", out var max) ? max : height.GetProperty("min")).GetInt32() >= 250);
        });

        Assert.All(Json.Items(await api.GetAsync($"/api/v1/listings?rootSystem=container&pageSize={Json.AllOnOnePage}")), l =>
            Assert.Equal("container", l.GetProperty("plant").GetProperty("rootSystem").GetString()));
        Assert.All(Json.Items(await api.GetAsync($"/api/v1/listings?delivery=1&pageSize={Json.AllOnOnePage}")), l =>
            Assert.True(l.GetProperty("deliveryAvailable").GetBoolean()));
        Assert.All(Json.Items(await api.GetAsync($"/api/v1/listings?cityIds=quba&cityIds=seki&pageSize={Json.AllOnOnePage}")), l =>
            Assert.Contains(l.GetProperty("cityId").GetString(), new[] { "quba", "seki" }));
        Assert.Equal(await TotalAsync("cityIds=quba,seki"), await TotalAsync("cityIds=quba") + await TotalAsync("cityIds=seki"));
    }

    [Theory]
    [InlineData("деревья", 16)]
    [InlineData("trees", 16)]
    [InlineData("Плодовые деревья", 4)]
    [InlineData("olea", 1)]
    [InlineData("Məhəmmədi", 4)]
    [InlineData("MƏHƏMMƏDİ", 4)]
    [InlineData("100%", 0)]
    [InlineData("a_c", 0)]
    public async Task The_search_understands_russian_english_latin_names_and_areas(string q, int expected) =>
        Assert.Equal(expected, await TotalAsync($"q={Uri.EscapeDataString(q)}"));

    [Theory]
    [InlineData("page=0", "page", "out-of-range")]
    [InlineData("pageSize=61", "pageSize", "out-of-range")]
    [InlineData("minPrice=abc", "minPrice", "invalid")]
    [InlineData("heightMin=-1", "heightMin", "out-of-range")]
    [InlineData("sort=cheapest", "sort", "invalid")]
    [InlineData("rootSystem=BareRoot", "rootSystem", "invalid")]
    [InlineData("sellerType=biznes", "sellerType", "invalid")]
    [InlineData("sellerId=42", "sellerId", "invalid")]
    [InlineData("promoted=yes", "promoted", "invalid")]
    public async Task A_bad_parameter_is_a_validation_problem(string query, string parameter, string code)
    {
        var problem = await ProblemAsync(await api.Client().GetAsync($"/api/v1/listings?{query}", Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(code, problem.GetProperty("errors").GetProperty(parameter)[0].GetString());
    }

    // Every whole number up to int32 is a valid bound, also past the smallint age column (32 767).
    [Theory]
    [InlineData("ageMax=2147483647", "ageMin=0")]
    [InlineData("ageMin=2&ageMax=32768", "ageMin=2")]
    [InlineData("heightMin=100&heightMax=2147483647", "heightMin=100")]
    public async Task A_maximum_past_every_value_is_no_maximum(string query, string same)
    {
        Assert.Equal(await TotalAsync(same), await TotalAsync(query));
        Assert.True(await TotalAsync(query) > 0);
    }

    [Theory]
    [InlineData("ageMin=32768")]
    [InlineData("ageMin=2147483647")]
    [InlineData("heightMin=2147483647")]
    public async Task A_minimum_past_every_value_finds_nothing(string query) => Assert.Equal(0, await TotalAsync(query));

    [Fact]
    public async Task The_largest_page_and_age_bounds_answer_like_any_other()
    {
        var lastPage = await api.GetAsync("/api/v1/listings?page=2147483647&pageSize=10");
        var facets = await api.GetAsync("/api/v1/listings/facets?ageMin=2147483647");

        Assert.Equal(5, lastPage.GetProperty("page").GetInt32());
        Assert.Equal(0, facets.GetProperty("categories").GetProperty("all").GetInt32());
    }

    /* ---------- Facets and count ---------- */

    [Fact]
    public async Task Facets_count_what_choosing_each_option_would_find()
    {
        var facets = await api.GetAsync("/api/v1/listings/facets?categoryId=agaclar&cityIds=baki");
        var categories = facets.GetProperty("categories");
        var cities = facets.GetProperty("cities");

        // Category counts keep the city and replace the category; city counts keep the category and replace the city.
        Assert.Equal(await TotalAsync("cityIds=baki"), categories.GetProperty("all").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=kollar&cityIds=baki"), categories.GetProperty("byId").GetProperty("kollar").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=agaclar"), cities.GetProperty("all").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=agaclar&cityIds=quba"), cities.GetProperty("byCity").GetProperty("quba").GetInt32());
        Assert.Equal(
            await TotalAsync("categoryId=agaclar&subcategoryId=agaclar-meyve&cityIds=baki"),
            facets.GetProperty("subcategories").GetProperty("agaclar-meyve").GetInt32());
        Assert.Equal(5, categories.GetProperty("byId").EnumerateObject().Count());
        Assert.Equal(7, cities.GetProperty("byCity").EnumerateObject().Count());
        Assert.Equal(17, facets.GetProperty("subcategories").EnumerateObject().Count());
    }

    [Fact]
    public async Task The_root_system_filter_counts_only_where_the_category_has_it()
    {
        var facets = await api.GetAsync("/api/v1/listings/facets?rootSystem=bare-root");
        var byId = facets.GetProperty("categories").GetProperty("byId");

        // «Kök sistemi» is a filter of trees and shrubs only (selectCategory in searchUrl.ts drops it elsewhere).
        Assert.Equal(await TotalAsync("categoryId=agaclar&rootSystem=bare-root"), byId.GetProperty("agaclar").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=guller"), byId.GetProperty("guller").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=agaclar&subcategoryId=agaclar-meyve&rootSystem=bare-root"), facets.GetProperty("subcategories").GetProperty("agaclar-meyve").GetInt32());
        Assert.Equal(ActiveProducts, facets.GetProperty("categories").GetProperty("all").GetInt32());
    }

    [Fact]
    public async Task Count_counts_a_category_in_a_city()
    {
        Assert.Equal(16, (await api.GetAsync("/api/v1/listings/count?categoryId=agaclar")).GetProperty("count").GetInt32());
        Assert.Equal(await TotalAsync("categoryId=agaclar&cityIds=baki"), (await api.GetAsync("/api/v1/listings/count?categoryId=agaclar&cityId=baki")).GetProperty("count").GetInt32());
        Assert.Equal(0, (await api.GetAsync("/api/v1/listings/count?categoryId=landsaft-xidmetleri")).GetProperty("count").GetInt32());
    }

    /* ---------- Listing page ---------- */

    [Fact]
    public async Task A_listing_is_found_by_its_slug_and_an_old_slug_answers_the_current_one()
    {
        var listing = await api.GetAsync("/api/v1/listings/zeytun-agaci-olea-europaea-10482");
        var renamed = await api.GetAsync("/api/v1/listings/zeytun-agaci-satilir-10482");
        var bare = await api.GetAsync("/api/v1/listings/10482");

        Assert.Equal(10482, listing.GetProperty("number").GetInt64());
        Assert.Equal("zeytun-agaci-olea-europaea-10482", renamed.GetProperty("slug").GetString());
        Assert.Equal(listing.GetProperty("id").GetString(), renamed.GetProperty("id").GetString());
        Assert.Equal(listing.GetProperty("id").GetString(), bare.GetProperty("id").GetString());
        Assert.Equal("+994 50 *** ** 34", listing.GetProperty("phoneMasked").GetString());
        Assert.Equal("Elvin Əliyev", listing.GetProperty("contactName").GetString());
        Assert.False(listing.TryGetProperty("contactPhone", out _));
    }

    [Theory]
    [InlineData(10524)] // pending
    [InlineData(10531)] // rejected
    [InlineData(10118)] // expired
    [InlineData(10377)] // inactive
    [InlineData(CatalogueApi.DeletedListingNumber)]
    [InlineData(20316)] // a service
    public async Task Only_active_product_listings_have_a_public_page(long number)
    {
        var slug = await SlugAsync(number);

        await ProblemAsync(await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct), HttpStatusCode.NotFound, "listing.not-found");
        Assert.DoesNotContain(number, Json.Numbers(Json.Items(await api.GetAsync($"/api/v1/listings?pageSize={Json.AllOnOnePage}"))));
    }

    [Theory]
    [InlineData("hec-bele-elan-yoxdur")]
    [InlineData("zeytun-agaci-99999")]
    public async Task An_unknown_slug_is_not_found(string slug) =>
        await ProblemAsync(await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct), HttpStatusCode.NotFound, "listing.not-found");

    [Fact]
    public async Task A_listing_page_speaks_the_requested_language()
    {
        var ru = await api.GetAsync("/api/v1/listings/zeytun-agaci-olea-europaea-10482", "ru");
        var en = await api.GetAsync("/api/v1/listings/zeytun-agaci-olea-europaea-10482", "en");

        Assert.Equal("Плодовые деревья", ru.GetProperty("subcategory").GetString());
        Assert.Equal(["180–200 см", "5 лет", "в контейнере"], Json.Strings(ru.GetProperty("attributes")));
        Assert.Equal("Fruit trees", en.GetProperty("subcategory").GetString());
        Assert.Equal("agaclar-meyve", en.GetProperty("subcategoryId").GetString());
        // What the seller wrote stays as written.
        Assert.Equal("Zeytun ağacı — Olea europaea", en.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Related_listings_are_the_sellers_others_and_similar_ones()
    {
        var listing = await api.GetAsync("/api/v1/listings/zeytun-agaci-olea-europaea-10482");
        var id = listing.GetProperty("id").GetString();
        var related = await api.GetAsync($"/api/v1/listings/{id}/related");

        var fromSeller = related.GetProperty("fromSeller").EnumerateArray().ToList();
        var similar = related.GetProperty("similar").EnumerateArray().ToList();
        Assert.Equal(3, fromSeller.Count);
        Assert.All(fromSeller, l => Assert.Equal(listing.GetProperty("sellerId").GetString(), l.GetProperty("sellerId").GetString()));
        Assert.Equal(4, similar.Count);
        Assert.All(similar, l => Assert.Equal("agaclar", l.GetProperty("categoryId").GetString()));
        var shown = fromSeller.Concat(similar).Select(l => l.GetProperty("id").GetString()).ToList();
        Assert.Equal(shown.Count, shown.Distinct().Count());
        Assert.DoesNotContain(id, shown);
    }

    [Fact]
    public async Task Related_needs_an_active_listing_id()
    {
        await ProblemAsync(await api.Client().GetAsync($"/api/v1/listings/{Guid.CreateVersion7()}/related", Ct), HttpStatusCode.NotFound, "listing.not-found");
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync("/api/v1/listings/not-a-guid/related", Ct)).StatusCode);
    }

    private static decimal Price(JsonElement listing) => listing.GetProperty("price").GetDecimal();

    private static IEnumerable<GreenStore.Api.Data.Seed.ListingSeed> SeededActive() =>
        GreenStore.Api.Data.Seed.SeedFiles.Read<GreenStore.Api.Data.Seed.ListingSeed>(GreenStore.Api.Data.Seed.SeedFiles.DefaultDirectory, "demo/listings.json")
            .Where(l => l.Status == GreenStore.Api.Modules.Listings.ListingStatus.Active);
}
