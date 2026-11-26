using System.Globalization;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Listings;

public sealed class ListingSlugTests
{
    [Theory]
    [InlineData("Zeytun ağacı — Olea europaea", 10482, "zeytun-agaci-olea-europaea-10482")]
    [InlineData("Şam ağacı, Çinar və Gül", 10001, "sam-agaci-cinar-ve-gul-10001")]
    [InlineData("İTALYAN ŞAMI", 7, "italyan-sami-7")]
    [InlineData("Ilıq iqlim üçün ölmez çiçək", 12, "iliq-iqlim-ucun-olmez-cicek-12")]
    [InlineData("Ёлка «Голубая» 2 м", 10500, "elka-golubaya-2-m-10500")]
    [InlineData("Щавель и жимолость", 3, "shchavel-i-zhimolost-3")]
    [InlineData("🌳🌳🌳", 10600, "elan-10600")]
    [InlineData("  --Tuya   Smaragd--  ", 10362, "tuya-smaragd-10362")]
    public void The_title_is_transliterated_to_ascii_and_the_number_follows(string title, long number, string expected) =>
        Assert.Equal(expected, ListingSlug.Create(title, number));

    [Fact]
    public void A_long_title_is_cut_at_a_word_boundary()
    {
        var slug = ListingSlug.Create("Dekorativ həmişəyaşıl iynəyarpaqlı tuya ağacları topdan və pərakəndə satışı Abşeronda", 10482);

        Assert.Equal("dekorativ-hemiseyasil-iyneyarpaqli-tuya-agaclari-topdan-ve-10482", slug);
        Assert.True(slug.Length <= ListingSlug.MaxTitleLength + "-10482".Length);
        Assert.Matches("^[a-z0-9-]+$", slug);
    }

    [Fact]
    public void One_very_long_word_is_cut_to_the_limit() =>
        Assert.Equal(new string('a', ListingSlug.MaxTitleLength) + "-5", ListingSlug.Create(new string('a', 100), 5));

    [Theory]
    [InlineData("zeytun-agaci-10482", 10482)]
    [InlineData("kohne-ad-10482", 10482)]
    [InlineData("10482", 10482)]
    [InlineData("a-b-c-1", 1)]
    public void The_number_is_read_from_the_end(string slug, long number)
    {
        Assert.True(ListingSlug.TryGetNumber(slug, out var found));
        Assert.Equal(number, found);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("zeytun-agaci")]
    [InlineData("zeytun-agaci-")]
    [InlineData("zeytun-10482x")]
    [InlineData("zeytun-١٢٣")]
    [InlineData("zeytun-1234567890123456789")]
    public void A_slug_without_a_number_has_none(string? slug) => Assert.False(ListingSlug.TryGetNumber(slug, out _));
}

public sealed class ListingTextsTests
{
    private static readonly Dictionary<string, string> NoAttributes = [];

    [Theory]
    [InlineData(Language.Az, new[] { "180–200 sm", "5 yaş", "dibçəkdə" })]
    [InlineData(Language.Ru, new[] { "180–200 см", "5 лет", "в контейнере" })]
    [InlineData(Language.En, new[] { "180–200 cm", "5 years", "in a container" })]
    public void A_plant_card_line_comes_from_its_facts(Language language, string[] expected) =>
        Assert.Equal(expected, ListingTexts.AttributeLine(CategoryForm.Plant, NoAttributes, 180, 200, 5, RootSystem.Container, language));

    [Fact]
    public void A_plant_without_facts_has_an_empty_line_and_one_height_has_no_range()
    {
        Assert.Empty(ListingTexts.AttributeLine(CategoryForm.Plant, NoAttributes, null, null, null, null, Language.Az));
        Assert.Equal(["140 sm", "açıq kök"], ListingTexts.AttributeLine(CategoryForm.Plant, NoAttributes, 140, 140, null, RootSystem.BareRoot, Language.Az));
    }

    [Fact]
    public void Other_forms_show_the_sellers_words()
    {
        var attributes = new Dictionary<string, string> { ["pack"] = " 20 litrlik kisə ", ["condition"] = "new", ["brand"] = "Gardena", ["heightMin"] = "120" };

        Assert.Equal(["20 litrlik kisə", "Yeni", "Gardena"], ListingTexts.AttributeLine(CategoryForm.Goods, attributes, 120, null, null, null, Language.Az));
        Assert.Equal(["20 litrlik kisə", "Новый", "Gardena"], ListingTexts.AttributeLine(CategoryForm.Goods, attributes, 120, null, null, null, Language.Ru));
        Assert.Empty(ListingTexts.AttributeLine(CategoryForm.Service, attributes, null, null, null, null, Language.Az));
        Assert.Equal(["20 litrlik kisə", "Gardena"], ListingTexts.AttributeLine(
            CategoryForm.Pack, new Dictionary<string, string>(attributes) { ["condition"] = "broken" }, null, null, null, null, Language.Az));
    }

    [Theory]
    [InlineData(1, "1 год")]
    [InlineData(2, "2 года")]
    [InlineData(5, "5 лет")]
    [InlineData(11, "11 лет")]
    [InlineData(14, "14 лет")]
    [InlineData(21, "21 год")]
    [InlineData(22, "22 года")]
    [InlineData(112, "112 лет")]
    public void Russian_ages_take_the_right_plural(int years, string expected) => Assert.Equal(expected, ListingTexts.Age(years, Language.Ru));

    [Fact]
    public void English_ages_are_singular_for_one() =>
        Assert.Equal(["1 year", "3 years"], [ListingTexts.Age(1, Language.En), ListingTexts.Age(3, Language.En)]);

    [Theory]
    [InlineData(PriceType.Fixed, "25", PriceUnit.Sqm, Language.Az, "25 ₼/m²-dən")]
    [InlineData(PriceType.Fixed, "350", null, Language.Az, "350 ₼-dən")]
    [InlineData(PriceType.Fixed, "20", PriceUnit.Hour, Language.Az, "20 ₼/saatdan")]
    [InlineData(PriceType.Negotiable, "1500", PriceUnit.Job, Language.Az, "1 500 ₼/işdən")]
    [InlineData(PriceType.Agreement, null, null, Language.Az, "Razılaşma yolu ilə")]
    [InlineData(PriceType.Fixed, "25", PriceUnit.Sqm, Language.Ru, "от 25 ₼/м²")]
    [InlineData(PriceType.Fixed, "350", null, Language.Ru, "от 350 ₼")]
    [InlineData(PriceType.Agreement, null, null, Language.Ru, "По договорённости")]
    [InlineData(PriceType.Fixed, "2.5", PriceUnit.Kg, Language.En, "from 2.5 ₼/kg")]
    [InlineData(PriceType.Agreement, null, null, Language.En, "By agreement")]
    public void A_service_price_label_is_worded_in_the_language(PriceType type, string? price, PriceUnit? unit, Language language, string expected) =>
        Assert.Equal(expected, ListingTexts.ServicePriceLabel(type, price is null ? null : decimal.Parse(price, CultureInfo.InvariantCulture), unit, language));
}

public sealed class ListingSearchTextTests
{
    private static readonly LocalizedText Trees = new("Ağaclar", "Деревья", "Trees");
    private static readonly LocalizedText FruitTrees = new("Meyvə ağacları", "Плодовые деревья", "Fruit trees");
    private static readonly LocalizedText Baku = new("Bakı", "Баку", "Baku");

    [Fact]
    public void Names_are_searchable_in_all_three_languages()
    {
        var text = ListingSearchText.Build(new ListingSearchInput
        {
            Title = "Zeytun ağacı — Olea europaea",
            Species = "Olea europaea",
            AttributeLine = ["180–200 sm", "180–200 см", "5 yaş"],
            Category = Trees,
            Subcategories = [FruitTrees],
            City = Baku,
            Area = "Məhəmmədi qəsəbəsi",
        });

        foreach (var query in new[] { "zeytun", "AĞAC", "agac", "деревья", "trees", "fruit trees", "плодовые", "Баку", "baku", "məhəmmədi", "olea", "180–200", "yaş" })
        {
            Assert.True(ListingSearchText.Matches(text, query), $"«{query}» should match «{text}»");
        }
    }

    [Fact]
    public void Every_query_word_must_occur()
    {
        var text = ListingSearchText.Build(new ListingSearchInput { Title = "Tuya Smaragd", City = Baku });

        Assert.True(ListingSearchText.Matches(text, "tuya smaragd"));
        Assert.True(ListingSearchText.Matches(text, "  TUYA   baki "));
        Assert.False(ListingSearchText.Matches(text, "tuya kaktus"));
        Assert.True(ListingSearchText.Matches(text, ""));
        Assert.True(ListingSearchText.Matches(text, null));
    }

    [Fact]
    public void The_text_is_normalised_and_each_word_appears_once()
    {
        var text = ListingSearchText.Build(new ListingSearchInput { Title = "Ağac AĞAC ağac", Category = new LocalizedText("Ağaclar", "Ёлки") });

        Assert.Equal("agac agaclar елки", text);
    }

    [Fact]
    public void A_listing_is_indexed_with_its_taxonomy_and_a_service_with_its_provider_and_areas()
    {
        var categories = new List<Category>
        {
            new() { Id = "agaclar", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = Trees },
            new() { Id = "agaclar-meyve", ParentId = "agaclar", Kind = CategoryKind.Product, Name = FruitTrees },
            new() { Id = "landsaft-xidmetleri", Kind = CategoryKind.Service, Form = CategoryForm.Service, Name = new LocalizedText("Bağ xidmətləri", "Садовые услуги", "Garden services") },
            new() { Id = "landsaft-dizayni", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Landşaft dizaynı", "Ландшафтный дизайн", "Landscape design") },
        };
        var cities = new List<City> { new() { Id = "baki", Name = Baku }, new() { Id = "quba", Name = new LocalizedText("Quba", "Губа", "Guba") } };
        var taxonomy = new TaxonomySnapshot(categories, cities);

        var product = new Listing
        {
            Slug = "x-1",
            Kind = CategoryKind.Product,
            CategoryId = "agaclar",
            SubcategoryId = "agaclar-meyve",
            CityId = "baki",
            Title = "Limon ağacı",
            ContactName = "A",
            ContactPhone = "+994500000000",
            HeightMinCm = 120,
            AgeYears = 3,
            RootSystem = RootSystem.Rootball,
        };
        var productText = ListingSearchText.For(product, taxonomy, providerName: "Abşeron Tingçilik");
        foreach (var word in new[] { "limon", "agaclar", "trees", "плодовые", "баку", "120 sm", "120 см", "3 года", "torpaq kuresi", "root-balled" })
        {
            Assert.True(ListingSearchText.Matches(productText, word), $"«{word}» should match «{productText}»");
        }

        Assert.False(ListingSearchText.Matches(productText, "abseron"));

        var service = new Listing
        {
            Slug = "y-2",
            Kind = CategoryKind.Service,
            CategoryId = "landsaft-xidmetleri",
            SubcategoryId = "landsaft-dizayni",
            CityId = "baki",
            Title = "Bağ dizaynı",
            ContactName = "B",
            ContactPhone = "+994500000001",
            ServiceCityIds = ["baki", "quba"],
            Description = "Layihə və əkin",
            Includes = ["3D konsepsiya"],
        };
        var serviceText = ListingSearchText.For(service, taxonomy, providerName: "Yaşıl Məkan");
        foreach (var word in new[] { "yasil mekan", "landscape design", "губа", "3d", "layihe" })
        {
            Assert.True(ListingSearchText.Matches(serviceText, word), $"«{word}» should match «{serviceText}»");
        }

        // The one service category names every service: it is left out, so it does not make every service match.
        Assert.False(ListingSearchText.Matches(serviceText, "garden services"));
    }

    [Fact]
    public void A_service_is_found_by_every_one_of_its_types()
    {
        var categories = new List<Category>
        {
            new() { Id = "landsaft-xidmetleri", Kind = CategoryKind.Service, Form = CategoryForm.Service, Name = new LocalizedText("Bağ xidmətləri", "Садовые услуги", "Garden services") },
            new() { Id = "landsaft-dizayni", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Landşaft dizaynı", "Ландшафтный дизайн", "Landscape design") },
            new() { Id = "bag-baximi", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Bağ baxımı", "Уход за садом", "Garden care") },
        };
        var taxonomy = new TaxonomySnapshot(categories, [new City { Id = "baki", Name = Baku }]);
        var service = new Listing
        {
            Slug = "z-3",
            Kind = CategoryKind.Service,
            CategoryId = "landsaft-xidmetleri",
            SubcategoryId = "landsaft-dizayni",
            SubcategoryIds = ["landsaft-dizayni", "bag-baximi"],
            CityId = "baki",
            Title = "Həyət",
            ContactName = "C",
            ContactPhone = "+994500000002",
        };

        var text = ListingSearchText.For(service, taxonomy, providerName: null);

        foreach (var word in new[] { "landsaft dizayni", "ландшафтный", "bag baximi", "уход за садом", "garden care" })
        {
            Assert.True(ListingSearchText.Matches(text, word), $"«{word}» should match «{text}»");
        }
    }
}
