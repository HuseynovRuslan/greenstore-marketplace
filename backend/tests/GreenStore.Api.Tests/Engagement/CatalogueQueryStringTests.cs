using System.Text.Json;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Engagement;

public sealed class CatalogueQueryStringTests
{
    /// <summary>One instance, so records that hold it compare equal.</summary>
    private static readonly IReadOnlyList<string> NoCities = Array.Empty<string>();

    private static readonly TaxonomySnapshot Taxonomy = new(
        [
            new Category { Id = "agaclar", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Ağaclar") },
            new Category { Id = "agaclar-meyve", ParentId = "agaclar", Kind = CategoryKind.Product, Name = new LocalizedText("Meyvə ağacları") },
            new Category { Id = "gul-ve-bitkiler", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Güllər") },
            new Category { Id = "kohne", Kind = CategoryKind.Product, Form = CategoryForm.Goods, Name = new LocalizedText("Köhnə"), IsActive = false },
            new Category { Id = "landsaft-xidmetleri", Kind = CategoryKind.Service, Form = CategoryForm.Service, Name = new LocalizedText("Landşaft") },
        ],
        [
            new City { Id = "baki", Name = new LocalizedText("Bakı"), SortOrder = 10 },
            new City { Id = "abseron", Name = new LocalizedText("Abşeron"), SortOrder = 20 },
        ]);

    public static TheoryData<string, string> Vectors()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "contracts", "saved-search-query.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var data = new TheoryData<string, string>();
        foreach (var item in document.RootElement.GetProperty("items").EnumerateArray())
        {
            data.Add(item.GetProperty("input").GetString()!, item.GetProperty("normalized").GetString()!);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Vectors))]
    public void A_query_is_stored_as_the_sites_filterQuery_writes_it(string input, string normalized) =>
        Assert.Equal(normalized, CatalogueQueryString.Normalize(input));

    [Fact]
    public void Every_filter_of_the_catalogue_is_read()
    {
        var filter = CatalogueQueryString.ToFilter(
            "q=+zeytun+&kateqoriya=agaclar&alt=agaclar-meyve&seher=abseron,baki,paris&min=12.345&max=150.999&vip=1&catdirilma=1"
            + "&saticiNovu=biznes&hundurluk=100-200&yas=-5&kok=aciq-kok&nov=olea-europaea&siralama=ucuz",
            Taxonomy);

        Assert.Equal("zeytun", filter.Query);
        Assert.Equal("agaclar", filter.CategoryId);
        Assert.Equal("agaclar-meyve", filter.SubcategoryId);
        Assert.Equal(["baki", "abseron"], filter.CityIds);
        Assert.Equal(12.35m, filter.MinPrice);
        Assert.Equal(150.99m, filter.MaxPrice);
        Assert.True(filter.PromotedOnly);
        Assert.True(filter.DeliveryOnly);
        Assert.Equal(AccountType.Business, filter.SellerType);
        Assert.Equal(100, filter.HeightMin);
        Assert.Equal(200, filter.HeightMax);
        Assert.Null(filter.AgeMin);
        Assert.Equal(5, filter.AgeMax);
        Assert.Equal(RootSystem.BareRoot, filter.RootSystem);
    }

    [Theory]
    [InlineData("kateqoriya=otaq-bitkileri")]
    [InlineData("kateqoriya=agaclar-meyve")]
    [InlineData("kateqoriya=landsaft-xidmetleri")]
    [InlineData("kateqoriya=kohne")]
    public void Unknown_categories_are_left_out(string query) => Assert.Null(CatalogueQueryString.ToFilter(query, Taxonomy).CategoryId);

    [Fact]
    public void A_subcategory_counts_only_under_its_category()
    {
        Assert.Null(CatalogueQueryString.ToFilter("alt=agaclar-meyve", Taxonomy).SubcategoryId);
        Assert.Null(CatalogueQueryString.ToFilter("kateqoriya=gul-ve-bitkiler&alt=agaclar-meyve", Taxonomy).SubcategoryId);
    }

    [Theory]
    [InlineData("min=abc&max=", null, null)]
    [InlineData("min=-5&max=999999999999", "0", "99999999.99")]
    [InlineData("min=1e2", "100", null)]
    public void Prices_are_any_finite_number_within_the_apis_range(string query, string? min, string? max)
    {
        var filter = CatalogueQueryString.ToFilter(query, Taxonomy);

        Assert.Equal(min is null ? null : decimal.Parse(min, System.Globalization.CultureInfo.InvariantCulture), filter.MinPrice);
        Assert.Equal(max is null ? null : decimal.Parse(max, System.Globalization.CultureInfo.InvariantCulture), filter.MaxPrice);
    }

    [Theory]
    [InlineData("hundurluk=-", null, null)]
    [InlineData("hundurluk=abc", null, null)]
    [InlineData("hundurluk=300-", 300, null)]
    [InlineData("hundurluk=99999999999-", int.MaxValue, null)]
    public void Ranges_are_read_like_the_sites_parseRange(string query, int? min, int? max)
    {
        var filter = CatalogueQueryString.ToFilter(query, Taxonomy);

        Assert.Equal(min, filter.HeightMin);
        Assert.Equal(max, filter.HeightMax);
    }

    [Fact]
    public void An_empty_query_is_the_whole_catalogue()
    {
        var filter = CatalogueQueryString.ToFilter("vip=0&catdirilma=true&saticiNovu=hamisi&kok=x", Taxonomy);

        Assert.Equal(new ListingFilter { CityIds = NoCities }, filter with { CityIds = NoCities });
        Assert.Empty(filter.CityIds);
    }

    [Fact]
    public void The_filter_is_stored_as_json_and_read_back()
    {
        var filter = CatalogueQueryString.ToFilter("kateqoriya=agaclar&seher=baki&kok=dibcek&saticiNovu=ferdi&min=5", Taxonomy);

        var json = JsonSerializer.Serialize(filter, ColumnMapping.StorageJson);
        var back = JsonSerializer.Deserialize<ListingFilter>(json, ColumnMapping.StorageJson)!;

        Assert.DoesNotContain("hasPriceRange", json, StringComparison.Ordinal);
        Assert.Contains("\"rootSystem\":\"container\"", json, StringComparison.Ordinal);
        Assert.Contains("\"sellerType\":\"individual\"", json, StringComparison.Ordinal);
        Assert.Equal(filter.CityIds, back.CityIds);
        Assert.Equal(filter with { CityIds = NoCities }, back with { CityIds = NoCities });
    }

    [Theory]
    [InlineData("listing:019a8b4e-0000-7000-8000-000000000001", true, CategoryKind.Product)]
    [InlineData("service:019a8b4e-0000-7000-8000-000000000001", true, CategoryKind.Service)]
    [InlineData("listing:l-12", false, CategoryKind.Product)]
    [InlineData("seller:019a8b4e-0000-7000-8000-000000000001", false, CategoryKind.Product)]
    [InlineData("019a8b4e-0000-7000-8000-000000000001", false, CategoryKind.Product)]
    [InlineData("listing:{019a8b4e-0000-7000-8000-000000000001}", false, CategoryKind.Product)]
    [InlineData("", false, CategoryKind.Product)]
    [InlineData(null, false, CategoryKind.Product)]
    public void Favourite_keys_are_kind_and_id(string? key, bool valid, CategoryKind kind)
    {
        Assert.Equal(valid, FavoriteKeys.TryParse(key, out var parsedKind, out var id));
        if (valid)
        {
            Assert.Equal(kind, parsedKind);
            Assert.Equal(key, FavoriteKeys.Format(parsedKind, id));
        }
    }
}
