using System.Net;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

[Collection(CatalogueCollection.Name)]
public sealed class TaxonomyEndpointsTests(CatalogueApi api)
{
    [Fact]
    public async Task Product_categories_come_in_the_sites_order_with_their_active_listings_counted()
    {
        var categories = await api.GetAsync("/api/v1/categories?kind=product");

        Assert.Equal(
            ["agaclar:16:trees", "kollar:7:shrub", "guller:7:flower", "sarmasiqlar:7:grape", "yer-ortucu-bitkiler:12:clover"],
            categories.EnumerateArray().Select(c => $"{c.GetProperty("id").GetString()}:{c.GetProperty("listingCount").GetInt32()}:{c.GetProperty("icon").GetString()}"));
        Assert.All(categories.EnumerateArray(), c =>
        {
            Assert.Equal(c.GetProperty("id").GetString(), c.GetProperty("slug").GetString());
            Assert.Equal("product", c.GetProperty("kind").GetString());
        });
        // 49 active product listings; the pending, rejected, expired, inactive and deleted ones are not counted.
        Assert.Equal(49, categories.EnumerateArray().Sum(c => c.GetProperty("listingCount").GetInt32()));
    }

    [Fact]
    public async Task Without_a_kind_the_service_category_is_listed_too()
    {
        var all = await api.GetAsync("/api/v1/categories");
        var services = await api.GetAsync("/api/v1/categories?kind=service");

        Assert.Equal(6, all.GetArrayLength());
        var service = Assert.Single(services.EnumerateArray());
        Assert.Equal("landsaft-xidmetleri", service.GetProperty("id").GetString());
        Assert.Equal("service", service.GetProperty("kind").GetString());
        Assert.Equal(6, service.GetProperty("listingCount").GetInt32());
    }

    [Theory]
    [InlineData("az", "Ağaclar", "Dekorativ və meyvə ağacları, iynəyarpaqlılar")]
    [InlineData("ru", "Деревья", "Декоративные и плодовые деревья, хвойные")]
    [InlineData("en-GB", "Trees", "Ornamental and fruit trees, conifers")]
    [InlineData("de", "Ağaclar", "Dekorativ və meyvə ağacları, iynəyarpaqlılar")]
    public async Task A_category_is_named_in_the_requested_language(string language, string name, string description)
    {
        var response = await api.Client(language).GetAsync("/api/v1/categories/agaclar", Ct);
        var category = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(name, category.GetProperty("name").GetString());
        Assert.Equal(description, category.GetProperty("description").GetString());
        Assert.Equal(16, category.GetProperty("listingCount").GetInt32());
        Assert.Equal(language is "ru" ? "ru" : language.StartsWith("en", StringComparison.Ordinal) ? "en" : "az", response.Content.Headers.ContentLanguage.Single());
    }

    [Theory]
    [InlineData("agaclar-meyve")]
    [InlineData("otaq-bitkileri")]
    [InlineData("AGACLAR")]
    public async Task A_sub_category_or_an_unknown_id_is_not_a_category(string id) =>
        await ProblemAsync(await api.Client().GetAsync($"/api/v1/categories/{id}", Ct), HttpStatusCode.NotFound, "category.not-found");

    [Fact]
    public async Task An_unknown_kind_is_a_validation_problem()
    {
        var problem = await ProblemAsync(await api.Client().GetAsync("/api/v1/categories?kind=products", Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("invalid", problem.GetProperty("errors").GetProperty("kind")[0].GetString());
    }

    [Theory]
    [InlineData("az", "Bakı,Abşeron,Sumqayıt,Gəncə,Şəki,Quba,Lənkəran")]
    [InlineData("ru", "Баку,Апшерон,Сумгайыт,Гянджа,Шеки,Губа,Ленкорань")]
    [InlineData("en", "Baku,Absheron,Sumgayit,Ganja,Shaki,Guba,Lankaran")]
    public async Task Cities_come_in_order_in_the_requested_language(string language, string names)
    {
        var cities = await api.GetAsync("/api/v1/cities", language);

        Assert.Equal(["baki", "abseron", "sumqayit", "gence", "seki", "quba", "lenkeran"], cities.EnumerateArray().Select(c => c.GetProperty("id").GetString()));
        Assert.Equal(names.Split(','), cities.EnumerateArray().Select(c => c.GetProperty("name").GetString()));
    }
}
