using System.Net;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

/// <summary>Services, providers and sellers over the seeded sample marketplace.</summary>
[Collection(CatalogueCollection.Name)]
public sealed class ServicesEndpointsTests(CatalogueApi api)
{
    private const string LandscapeDesign = "landsaft-dizayni-ve-yasillasdirma-20316";

    [Fact]
    public async Task The_services_catalogue_is_paged_six_at_a_time()
    {
        var first = await api.GetAsync("/api/v1/services");
        var second = await api.GetAsync("/api/v1/services?page=2&pageSize=4");

        Assert.Equal(6, Json.Items(first).Count);
        Assert.Equal((6, 6, 1), (first.GetProperty("total").GetInt32(), first.GetProperty("displayTotal").GetInt32(), first.GetProperty("pageCount").GetInt32()));
        Assert.Equal([20320, 20321], Json.Numbers(Json.Items(second)));
        Assert.Equal(2, second.GetProperty("pageCount").GetInt32());
    }

    [Fact]
    public async Task Services_filter_by_provider_kind_area_and_type()
    {
        var individuals = Json.Items(await api.GetAsync("/api/v1/services?providerKind=individual"));
        var companies = Json.Items(await api.GetAsync("/api/v1/services?providerKind=company"));
        var seki = Json.Items(await api.GetAsync("/api/v1/services?cityId=seki"));
        var planting = Json.Items(await api.GetAsync("/api/v1/services?categoryId=agac-ekilmesi"));

        Assert.Equal([20317, 20319, 20321], Json.Numbers(individuals));
        Assert.All(individuals, s => Assert.False(s.GetProperty("verified").GetBoolean()));
        Assert.Equal([20316, 20318, 20320], Json.Numbers(companies));
        Assert.All(companies, s => Assert.True(s.GetProperty("verified").GetBoolean()));
        Assert.Equal([20321], Json.Numbers(seki));
        Assert.Equal("agac-ekilmesi", Assert.Single(planting).GetProperty("categoryId").GetString());
        Assert.Equal(0, (await api.GetAsync("/api/v1/services?q=kaktus")).GetProperty("displayTotal").GetInt32());
    }

    [Fact]
    public async Task A_bad_parameter_is_a_validation_problem()
    {
        var problem = await ProblemAsync(await api.Client().GetAsync("/api/v1/services?providerKind=sirketler&maxPrice=x", Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(["providerKind", "maxPrice"], problem.GetProperty("errors").EnumerateObject().Select(e => e.Name));
    }

    [Theory]
    [InlineData("az", "25 ₼/m²-dən", "Bakı,Abşeron,Sumqayıt")]
    [InlineData("ru", "от 25 ₼/м²", "Баку,Апшерон,Сумгайыт")]
    [InlineData("en", "from 25 ₼/m²", "Baku,Absheron,Sumgayit")]
    public async Task A_service_page_speaks_the_requested_language(string language, string priceLabel, string areas)
    {
        var service = await api.GetAsync($"/api/v1/services/{LandscapeDesign}", language);

        Assert.Equal(priceLabel, service.GetProperty("priceLabel").GetString());
        Assert.Equal(areas.Split(','), Json.Strings(service.GetProperty("areas")));
        Assert.Equal((25, "fixed", "sqm"), (service.GetProperty("priceFrom").GetInt32(), service.GetProperty("priceType").GetString(), service.GetProperty("priceUnit").GetString()));
        Assert.Equal("landsaft-dizayni", service.GetProperty("categoryId").GetString());
        Assert.Equal(6, service.GetProperty("includes").GetArrayLength());
    }

    [Fact]
    public async Task A_service_priced_by_agreement_has_no_lower_bound()
    {
        var service = await api.GetAsync("/api/v1/services/agac-ekilmesi-20320");

        Assert.Equal("agreement", service.GetProperty("priceType").GetString());
        Assert.Equal("Razılaşma yolu ilə", service.GetProperty("priceLabel").GetString());
        Assert.False(service.TryGetProperty("priceFrom", out _));
    }

    [Fact]
    public async Task An_old_slug_finds_the_service_and_a_listing_slug_does_not()
    {
        Assert.Equal(LandscapeDesign, (await api.GetAsync("/api/v1/services/kohne-ad-20316")).GetProperty("slug").GetString());
        await ProblemAsync(await api.Client().GetAsync("/api/v1/services/zeytun-agaci-olea-europaea-10482", Ct), HttpStatusCode.NotFound, "service.not-found");
        await ProblemAsync(await api.Client().GetAsync("/api/v1/services/yoxdur", Ct), HttpStatusCode.NotFound, "service.not-found");
    }

    [Fact]
    public async Task Related_services_are_the_providers_others_then_the_same_type_then_the_rest()
    {
        var service = await api.GetAsync($"/api/v1/services/{LandscapeDesign}");
        var related = await api.GetAsync($"/api/v1/services/{service.GetProperty("id").GetString()}/related");

        Assert.Equal([20318], Json.Numbers(related.GetProperty("fromProvider").EnumerateArray()));
        var similar = Json.Numbers(related.GetProperty("similar").EnumerateArray());
        Assert.Equal(4, similar.Count);
        Assert.DoesNotContain(20316L, similar);
        Assert.DoesNotContain(20318L, similar);
        await ProblemAsync(await api.Client().GetAsync($"/api/v1/services/{Guid.CreateVersion7()}/related", Ct), HttpStatusCode.NotFound, "service.not-found");
    }

    [Fact]
    public async Task A_company_provider_has_a_seller_page_and_an_individual_has_none()
    {
        var company = await api.GetAsync($"/api/v1/services/{LandscapeDesign}");
        var individual = await api.GetAsync("/api/v1/services/avtomatik-suvarma-qurasdirilmasi-20317");

        var landscaper = await api.GetAsync($"/api/v1/providers/{company.GetProperty("providerId").GetString()}");
        Assert.Equal(("Yaşıl Məkan Landşaft", "company", true), (landscaper.GetProperty("name").GetString(), landscaper.GetProperty("kind").GetString(), landscaper.GetProperty("verified").GetBoolean()));
        Assert.StartsWith("Landşaft şirkəti · ", landscaper.GetProperty("summary").GetString());
        var seller = await api.GetAsync($"/api/v1/sellers/by-id/{landscaper.GetProperty("sellerId").GetString()}");
        Assert.Equal("yasil-mekan-landsaft", seller.GetProperty("slug").GetString());

        var aquabag = await api.GetAsync($"/api/v1/providers/{individual.GetProperty("providerId").GetString()}", "ru");
        Assert.Equal(("AquaBağ", "individual", false), (aquabag.GetProperty("name").GetString(), aquabag.GetProperty("kind").GetString(), aquabag.GetProperty("verified").GetBoolean()));
        Assert.False(aquabag.TryGetProperty("sellerId", out _));
        Assert.Equal("+994 50 *** ** 01", aquabag.GetProperty("phoneMasked").GetString());

        var services = await api.GetAsync($"/api/v1/providers/{company.GetProperty("providerId").GetString()}/services");
        Assert.Equal([20316, 20318], Json.Numbers(services.EnumerateArray()));

        // The seller page asks by the business's seller id (listProviderServices(seller.id)) and gets the same list.
        var bySeller = await api.GetAsync($"/api/v1/providers/{landscaper.GetProperty("sellerId").GetString()}/services");
        Assert.Equal([20316, 20318], Json.Numbers(bySeller.EnumerateArray()));
        var nursery = await api.GetAsync("/api/v1/sellers/abseron-tingcilik");
        var nurseryServices = await api.GetAsync($"/api/v1/providers/{nursery.GetProperty("id").GetString()}/services");
        Assert.Equal([20320], Json.Numbers(nurseryServices.EnumerateArray()));
    }

    [Fact]
    public async Task Only_accounts_with_services_are_providers()
    {
        // The nursery «Quba Fidan» sells plants but offers no service.
        var quba = await api.GetAsync("/api/v1/listings?sellerType=business&q=quba&pageSize=1");
        var sellerId = Json.Items(quba)[0].GetProperty("sellerId").GetString();
        var seller = await api.GetAsync($"/api/v1/sellers/by-id/{sellerId}");
        Assert.Equal("quba-fidan", seller.GetProperty("slug").GetString());
        Assert.False(seller.TryGetProperty("serviceIds", out _));

        await ProblemAsync(await api.Client().GetAsync($"/api/v1/providers/{Guid.CreateVersion7()}", Ct), HttpStatusCode.NotFound, "provider.not-found");
        Assert.Equal(0, (await api.GetAsync($"/api/v1/providers/{Guid.CreateVersion7()}/services")).GetArrayLength());
    }
}

[Collection(CatalogueCollection.Name)]
public sealed class SellersEndpointsTests(CatalogueApi api)
{
    [Fact]
    public async Task The_directory_lists_verified_businesses_in_alphabetical_order()
    {
        var page = await api.GetAsync("/api/v1/sellers");

        Assert.Equal(["abseron-tingcilik", "quba-fidan", "yasil-bag-merkezi", "yasil-mekan-landsaft"], Json.Slugs(page.GetProperty("items")));
        Assert.Equal((4, 1, 1), (page.GetProperty("total").GetInt32(), page.GetProperty("page").GetInt32(), page.GetProperty("pageCount").GetInt32()));
        Assert.All(Json.Items(page), s => Assert.Equal("business", s.GetProperty("type").GetString()));
    }

    [Theory]
    [InlineData("businessKind=nursery", "abseron-tingcilik,quba-fidan")]
    [InlineData("businessKind=landscaping", "yasil-mekan-landsaft")]
    [InlineData("cityId=baki", "yasil-bag-merkezi,yasil-mekan-landsaft")]
    [InlineData("businessKind=nursery&cityId=quba", "quba-fidan")]
    [InlineData("pageSize=1&page=2", "quba-fidan")]
    [InlineData("cityId=lenkeran", "")]
    public async Task The_directory_filters_by_kind_and_city_and_is_paged(string query, string slugs) =>
        Assert.Equal(
            slugs.Split(',', StringSplitOptions.RemoveEmptyEntries),
            Json.Slugs((await api.GetAsync($"/api/v1/sellers?{query}")).GetProperty("items")));

    [Fact]
    public async Task A_bad_business_kind_is_a_validation_problem() =>
        await ProblemAsync(await api.Client().GetAsync("/api/v1/sellers?businessKind=garden_centre", Ct), HttpStatusCode.BadRequest, "validation");

    [Fact]
    public async Task A_seller_page_counts_its_listings_and_lists_its_services()
    {
        var seller = await api.GetAsync("/api/v1/sellers/yasil-bag-merkezi");
        var listings = await api.GetAsync($"/api/v1/listings?sellerId={seller.GetProperty("id").GetString()}&pageSize=1");
        var landscaper = await api.GetAsync("/api/v1/sellers/yasil-mekan-landsaft");

        Assert.Equal(listings.GetProperty("total").GetInt32(), seller.GetProperty("activeListings").GetInt32());
        Assert.Equal(11, seller.GetProperty("activeListings").GetInt32());
        Assert.Equal(("garden-centre", "Bağ mərkəzi", "baki"), (seller.GetProperty("businessKind").GetString(), seller.GetProperty("kind").GetString(), seller.GetProperty("cityId").GetString()));
        Assert.Equal(2, landscaper.GetProperty("serviceIds").GetArrayLength());
        Assert.Equal(0, landscaper.GetProperty("activeListings").GetInt32());
        Assert.False(seller.TryGetProperty("phone", out _));
        Assert.StartsWith("+994 12 *** **", seller.GetProperty("phoneMasked").GetString());
    }

    [Fact]
    public async Task A_seller_is_found_by_slug_or_id_and_named_in_the_language()
    {
        var bySlug = await api.GetAsync("/api/v1/sellers/abseron-tingcilik", "ru");
        var byId = await api.GetAsync($"/api/v1/sellers/by-id/{bySlug.GetProperty("id").GetString()}", "en");

        Assert.Equal("Питомник растений", bySlug.GetProperty("kind").GetString());
        Assert.Equal("Plant nursery", byId.GetProperty("kind").GetString());
        Assert.Equal("Abşeron Tingçilik", byId.GetProperty("name").GetString());
        Assert.Equal(2021, byId.GetProperty("memberSince").GetInt32());
        Assert.Equal(7, byId.GetProperty("hours").GetArrayLength());
        Assert.Equal(["delivery", "planting", "wholesale", "care"], Json.Strings(byId.GetProperty("offers")));
    }

    [Fact]
    public async Task An_unknown_seller_is_not_found()
    {
        await ProblemAsync(await api.Client().GetAsync("/api/v1/sellers/yoxdur", Ct), HttpStatusCode.NotFound, "seller.not-found");
        await ProblemAsync(await api.Client().GetAsync($"/api/v1/sellers/by-id/{Guid.CreateVersion7()}", Ct), HttpStatusCode.NotFound, "seller.not-found");
    }
}

[Collection(CatalogueCollection.Name)]
public sealed class SitemapEndpointsTests(CatalogueApi api)
{
    private async Task<List<string>> AllAsync(string kind, int limit)
    {
        var slugs = new List<string>();
        string? cursor = null;
        for (var pages = 0; pages < 100; pages++)
        {
            var page = await api.GetAsync($"/api/v1/sitemap/{kind}?limit={limit}{(cursor is null ? string.Empty : $"&cursor={Uri.EscapeDataString(cursor)}")}");
            slugs.AddRange(Json.Slugs(page.GetProperty("items")));
            cursor = Json.String(page, "nextCursor");
            if (cursor is null)
            {
                return slugs;
            }

            Assert.Equal(limit, page.GetProperty("items").GetArrayLength());
        }

        throw new InvalidOperationException("The sitemap never ended");
    }

    [Fact]
    public async Task The_listing_sitemap_pages_through_every_public_listing_once()
    {
        var sitemap = await AllAsync("listing", limit: 10);
        var catalogue = Json.Slugs((await api.GetAsync($"/api/v1/listings?pageSize={Json.AllOnOnePage}")).GetProperty("items"));

        Assert.Equal(49, sitemap.Count);
        Assert.Equal(catalogue.Order(), sitemap.Order());
        Assert.DoesNotContain(CatalogueApi.DeletedListingSlug, sitemap);
    }

    [Fact]
    public async Task Services_and_sellers_have_sitemaps_too()
    {
        Assert.Equal(6, (await AllAsync("service", limit: 4)).Count);
        Assert.Equal(["abseron-tingcilik", "quba-fidan", "yasil-bag-merkezi", "yasil-mekan-landsaft"], await AllAsync("seller", limit: 3));
    }

    [Fact]
    public async Task A_listing_changes_when_it_is_edited()
    {
        var page = await api.GetAsync("/api/v1/sitemap/listing?limit=1");
        var entry = page.GetProperty("items")[0];

        Assert.Equal("tuya-smaragd-10362", entry.GetProperty("slug").GetString());
        Assert.Equal("2026-11-02T04:30:00Z", entry.GetProperty("updatedAt").GetString());
    }

    [Theory]
    [InlineData("/api/v1/sitemap/listing?cursor=abc", HttpStatusCode.BadRequest, "validation")]
    [InlineData("/api/v1/sitemap/listing?limit=0", HttpStatusCode.BadRequest, "validation")]
    [InlineData("/api/v1/sitemap/listing?limit=5001", HttpStatusCode.BadRequest, "validation")]
    [InlineData("/api/v1/sitemap/category", HttpStatusCode.NotFound, "not-found")]
    public async Task Bad_requests_are_problems(string path, HttpStatusCode status, string code) =>
        await ProblemAsync(await api.Client().GetAsync(path, Ct), status, code);
}
