using System.Text.Json;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Sellers;

namespace GreenStore.Api.Tests.Sellers;

public sealed class SellerProfileRulesTests
{
    private static readonly IReadOnlySet<string> Cities = new HashSet<string>(StringComparer.Ordinal) { "baki", "abseron", "quba" };

    private static Seller NewSeller() => new()
    {
        Slug = "abseron-tingcilik",
        Name = "Abşeron Tingçilik",
        BusinessKinds = ["nursery"],
        CityId = "baki",
        About = "Köhnə mətn",
        Website = "https://absheronting.az",
        Offers = ["delivery"],
    };

    /// <summary>The body as the API reads it (the API's JSON options), so "sent" is what the JSON had.</summary>
    private static SellerPatch Patch(string json) => JsonSerializer.Deserialize<SellerPatch>(json, JsonDefaults.Create())!;

    private static Dictionary<string, string[]> ErrorsOf(Seller seller, string json)
    {
        var error = Record.Exception(() => SellerProfileRules.Apply(seller, Patch(json), Cities).ThrowIfAny());
        var problem = Assert.IsType<GreenStore.Api.Common.Errors.ApiProblemException>(error);
        return problem.Errors!.ToDictionary(e => e.Key, e => e.Value);
    }

    [Theory]
    [InlineData("Abşeron Tingçilik", "abseron-tingcilik")]
    [InlineData("  Yaşıl Bağ Mərkəzi  ", "yasil-bag-merkezi")]
    [InlineData("ООО «Сад и Огород»", "ooo-sad-i-ogorod")]
    [InlineData("🌳🌳", "satici")]
    public void A_slug_is_the_company_name_in_ascii(string name, string slug) => Assert.Equal(slug, SellerSlug.Base(name));

    [Fact]
    public void A_taken_slug_gets_the_next_free_number()
    {
        Assert.Equal("bag", SellerSlug.Choose("bag", new HashSet<string>()));
        Assert.Equal("bag-2", SellerSlug.Choose("bag", new HashSet<string> { "bag" }));
        Assert.Equal("bag-4", SellerSlug.Choose("bag", new HashSet<string> { "bag", "bag-2", "bag-3", "bag-5" }));
    }

    [Fact]
    public void Only_the_fields_sent_change()
    {
        var seller = NewSeller();

        SellerProfileRules.Apply(seller, Patch("""{ "address": " Məhəmmədi qəsəbəsi ", "contactPerson": "Elvin Əliyev" }"""), Cities).ThrowIfAny();

        Assert.Equal("Məhəmmədi qəsəbəsi", seller.Address);
        Assert.Equal("Elvin Əliyev", seller.ContactPerson);
        Assert.Equal("Abşeron Tingçilik", seller.Name);
        Assert.Equal("Köhnə mətn", seller.About);
        Assert.Equal("https://absheronting.az", seller.Website);
        Assert.Equal(["delivery"], seller.Offers);
    }

    [Fact]
    public void Every_field_of_the_profile_can_be_set()
    {
        var seller = NewSeller();

        SellerProfileRules.Apply(
            seller,
            Patch("""
            {
              "name": "Abşeron Bağ", "businessKinds": ["landscaping", "garden-centre", "landscaping"], "cityId": "quba", "about": "Yeni", "terms": "Çatdırılma 2 günə",
              "hours": [{ "day": 2, "open": "09:00", "close": "18:00" }, { "day": 1, "open": "09:00", "close": "18:00" }, { "day": 7, "closed": true }],
              "offers": ["planting", "delivery", "planting"], "phone": "012 440 50 60", "whatsapp": true, "email": "satis@bag.az",
              "instagram": "@abseronbag", "website": "https://bag.az/", "responseMinutes": 60, "location": { "lat": 40.5012347, "lng": 49.9 }
            }
            """),
            Cities).ThrowIfAny();

        Assert.Equal("Abşeron Bağ", seller.Name);
        Assert.Equal("abseron-tingcilik", seller.Slug);
        Assert.Equal(["garden-centre", "landscaping"], seller.BusinessKinds);
        Assert.Equal("quba", seller.CityId);
        Assert.Equal("Çatdırılma 2 günə", seller.Terms);
        Assert.Equal([1, 2, 7], seller.Hours!.Select(h => h.Day));
        Assert.Equal(["delivery", "planting"], seller.Offers);
        Assert.Equal("+994124405060", seller.Phone);
        Assert.True(seller.Whatsapp);
        Assert.Equal("satis@bag.az", seller.Email);
        Assert.Equal("@abseronbag", seller.Instagram);
        Assert.Equal(60, seller.ResponseMinutes);
        Assert.Equal(40.501235m, seller.Lat);
        Assert.Equal(49.9m, seller.Lng);
    }

    [Fact]
    public void Null_or_empty_removes_an_optional_value()
    {
        var seller = NewSeller();
        seller.Phone = "+994124405060";
        seller.Hours = [new OpeningHours(1, "09:00", "18:00")];
        seller.Lat = 40;
        seller.Lng = 49;

        SellerProfileRules.Apply(seller, Patch("""{ "about": "", "website": null, "offers": [], "hours": [], "phone": "", "location": null, "responseMinutes": null }"""), Cities).ThrowIfAny();

        Assert.Null(seller.About);
        Assert.Null(seller.Website);
        Assert.Empty(seller.Offers);
        Assert.Null(seller.Hours);
        Assert.Null(seller.Phone);
        Assert.Null(seller.Lat);
        Assert.Null(seller.Lng);
        Assert.Null(seller.ResponseMinutes);
    }

    [Fact]
    public void The_name_kind_and_city_cannot_be_removed()
    {
        var errors = ErrorsOf(NewSeller(), """{ "name": " ", "businessKinds": null, "cityId": "" }""");

        Assert.Equal(["required"], errors["name"]);
        Assert.Equal(["required"], errors["businessKinds"]);
        Assert.Equal(["required"], errors["cityId"]);
    }

    [Fact]
    public void An_empty_list_of_kinds_is_required_and_keeps_the_old_kinds()
    {
        var seller = NewSeller();

        var errors = ErrorsOf(seller, """{ "businessKinds": [] }""");

        Assert.Equal(["required"], errors["businessKinds"]);
        Assert.Equal(["nursery"], seller.BusinessKinds);
    }

    [Fact]
    public void An_unknown_kind_does_not_read()
    {
        Assert.Throws<JsonException>(() => Patch("""{ "businessKinds": ["nursery", "shop"] }"""));
    }

    [Fact]
    public void Wrong_values_are_named_field_by_field()
    {
        var errors = ErrorsOf(NewSeller(), $$"""
            {
              "name": "A", "cityId": "paris", "about": "{{new string('x', 2001)}}", "phone": "12345", "email": "satis@bag",
              "website": "bag.az", "instagram": "abseron bag", "responseMinutes": 0, "location": { "lat": 91, "lng": 49 },
              "hours": [{ "day": 1, "open": "18:00", "close": "09:00" }], "whatsapp": null
            }
            """);

        Assert.Equal(["too-short"], errors["name"]);
        Assert.Equal(["invalid"], errors["cityId"]);
        Assert.Equal(["too-long"], errors["about"]);
        Assert.Equal(["invalid"], errors["phone"]);
        Assert.Equal(["invalid"], errors["email"]);
        Assert.Equal(["invalid"], errors["website"]);
        Assert.Equal(["invalid"], errors["instagram"]);
        Assert.Equal(["invalid"], errors["responseMinutes"]);
        Assert.Equal(["invalid"], errors["location"]);
        Assert.Equal(["invalid"], errors["hours"]);
        Assert.Equal(["required"], errors["whatsapp"]);
    }

    [Theory]
    [InlineData("""[{ "day": 1, "open": "09:00", "close": "18:00" }, { "day": 6, "open": "10:00", "close": "14:30" }]""", true)]
    [InlineData("""[{ "day": 7, "closed": true }]""", true)]
    [InlineData("[]", true)]
    [InlineData("""[{ "day": 1, "open": "09:00", "close": "18:00" }, { "day": 1, "open": "10:00", "close": "11:00" }]""", false)]
    [InlineData("""[{ "day": 8, "open": "09:00", "close": "18:00" }]""", false)]
    [InlineData("""[{ "day": 1, "open": "9:00", "close": "18:00" }]""", false)]
    [InlineData("""[{ "day": 1, "open": "09:00" }]""", false)]
    [InlineData("""[{ "day": 1, "open": "09:00", "close": "09:00" }]""", false)]
    [InlineData("""[{ "day": 1, "closed": true, "open": "09:00" }]""", false)]
    [InlineData("""[{ "day": 1, "open": "09:00", "close": "25:00" }]""", false)]
    public void Opening_hours_name_each_day_once(string json, bool valid) =>
        Assert.Equal(valid, SellerProfileRules.HoursAreValid(JsonSerializer.Deserialize<List<OpeningHours>>(json, JsonDefaults.Create())!));

    [Theory]
    [InlineData("https://bag.az", true)]
    [InlineData("http://www.bag.az/haqqimizda", true)]
    [InlineData("bag.az", false)]
    [InlineData("ftp://bag.az", false)]
    [InlineData("https://localhost", false)]
    [InlineData("javascript:alert(1)", false)]
    public void A_website_is_an_http_address(string value, bool valid) => Assert.Equal(valid, SellerProfileRules.IsWebAddress(value));

    [Fact]
    public void A_patch_body_knows_what_was_sent()
    {
        var patch = JsonSerializer.Deserialize<MePatch>("""{ "email": null }""", JsonDefaults.Create())!;

        Assert.True(patch.Has(nameof(MePatch.Email)));
        Assert.False(patch.Has(nameof(MePatch.FullName)));
        Assert.False(patch.Has(nameof(MePatch.Locale)));
    }
}
