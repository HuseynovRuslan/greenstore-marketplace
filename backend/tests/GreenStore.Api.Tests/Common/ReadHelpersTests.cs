using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Sellers;
using Microsoft.AspNetCore.Http;

namespace GreenStore.Api.Tests.Common;

public sealed class PhoneNumbersTests
{
    [Theory]
    [InlineData("+994505551234", "+994 50 *** ** 34")]
    [InlineData("+994125104420", "+994 12 *** ** 20")]
    public void A_number_is_masked_but_for_the_operator_code_and_the_last_two_digits(string phone, string masked) =>
        Assert.Equal(masked, PhoneNumbers.Mask(phone));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("+99450555123")]
    [InlineData("+9945055512345")]
    [InlineData("+7 9161234567")]
    [InlineData("+99450555123x")]
    [InlineData("0505551234")]
    public void Anything_else_has_no_mask(string? phone) => Assert.Null(PhoneNumbers.Mask(phone));
}

public sealed class MoneyTests
{
    [Theory]
    [InlineData("145.00", "145")]
    [InlineData("2.50", "2.5")]
    [InlineData("0.00", "0")]
    [InlineData("99999999.99", "99999999.99")]
    public void Trailing_zeros_are_dropped(string stored, string json) =>
        Assert.Equal(json, Money.Trim(decimal.Parse(stored, System.Globalization.CultureInfo.InvariantCulture)).ToString(System.Globalization.CultureInfo.InvariantCulture));

    [Theory]
    [InlineData(1500, Language.Az, "1 500")]
    [InlineData(2.5, Language.Az, "2,5")]
    [InlineData(2.5, Language.Ru, "2,5")]
    [InlineData(1234567.5, Language.En, "1 234 567.5")]
    [InlineData(25, Language.En, "25")]
    public void Amounts_are_grouped_like_the_site(double value, Language language, string expected) =>
        Assert.Equal(expected, Money.Format((decimal)value, language));
}

public sealed class QueryReaderTests
{
    private static QueryReader Read(string query) => new(new QueryCollection(Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(query)));

    [Fact]
    public void Values_are_read_with_the_api_rules()
    {
        var query = Read("?q=+zeytun+&cityIds=baki,abseron&cityIds=baki&promoted=1&delivery=false&minPrice=12.5&heightMin=100&rootSystem=bare-root&sellerId=019a8b4e-0000-7000-8000-000000000001&empty=");

        Assert.Equal("zeytun", query.String("q"));
        Assert.Equal(["baki", "abseron"], query.List("cityIds"));
        Assert.True(query.Bool("promoted"));
        Assert.False(query.Bool("delivery"));
        Assert.Equal(12.5m, query.Amount("minPrice"));
        Assert.Equal(100, query.Int("heightMin"));
        Assert.Equal(RootSystem.BareRoot, query.Enum<RootSystem>("rootSystem"));
        Assert.Equal(Guid.Parse("019a8b4e-0000-7000-8000-000000000001"), query.Guid("sellerId"));
        Assert.Null(query.String("empty"));
        Assert.Null(query.Int("missing"));
        Assert.Empty(query.List("missing"));
        query.ThrowIfInvalid();
    }

    [Fact]
    public void Every_bad_parameter_is_named_in_one_validation_problem()
    {
        var query = Read("?promoted=yes&minPrice=1,5&maxPrice=-1&heightMin=abc&ageMax=-2&rootSystem=BareRoot&sellerType=biznes&sellerId=42&page=0&pageSize=61");
        query.Bool("promoted");
        query.Amount("minPrice");
        query.Amount("maxPrice");
        query.Int("heightMin");
        query.Int("ageMax");
        query.Enum<RootSystem>("rootSystem");
        query.Enum<GreenStore.Api.Modules.Accounts.AccountType>("sellerType");
        query.Guid("sellerId");
        query.Page(24);

        var problem = Assert.Throws<ApiProblemException>(query.ThrowIfInvalid);
        Assert.Equal(ErrorCodes.Validation, problem.Code);
        Assert.Equal(
            new Dictionary<string, string[]>
            {
                ["promoted"] = [QueryReader.Invalid],
                ["minPrice"] = [QueryReader.Invalid],
                ["maxPrice"] = [QueryReader.OutOfRange],
                ["heightMin"] = [QueryReader.Invalid],
                ["ageMax"] = [QueryReader.OutOfRange],
                ["rootSystem"] = [QueryReader.Invalid],
                ["sellerType"] = [QueryReader.Invalid],
                ["sellerId"] = [QueryReader.Invalid],
                ["page"] = [QueryReader.OutOfRange],
                ["pageSize"] = [QueryReader.OutOfRange],
            },
            problem.Errors);
    }

    [Fact]
    public void Paging_defaults_and_clamps_to_the_last_page()
    {
        var request = Read("").Page(24);
        Assert.Equal(new PageRequest(1, 24), request);

        var late = new PageRequest(9, 10);
        Assert.Equal(5, late.PageCount(49));
        Assert.Equal(5, late.Clamp(49));
        Assert.Equal(1, late.PageCount(0));
        Assert.Equal(1, late.Clamp(0));
        Assert.Equal(3, new PageRequest(3, 10).Clamp(49));
    }

    [Fact]
    public void Sort_defaults_to_newest()
    {
        Assert.Equal(ListingSort.Newest, ListingSortQuery.Read(Read("")));
        Assert.Equal(ListingSort.PriceAsc, ListingSortQuery.Read(Read("?sort=price-asc")));
        Assert.Equal(ListingSort.PriceDesc, ListingSortQuery.Read(Read("?sort=price-desc")));
    }
}

public sealed class PhotoUrlsTests
{
    private static Photo Ready(string? key) => new() { Status = PhotoStatus.Ready, StorageKey = key };

    [Fact]
    public void Site_photos_keep_their_path_and_stored_photos_get_the_media_address()
    {
        Assert.Equal("/images/listings/zeytun-agaci-1.webp", PhotoUrls.Of(Ready("/images/listings/zeytun-agaci-1.webp"), "https://cdn.example"));
        Assert.Equal("https://cdn.example/p/2026/11/abc", PhotoUrls.Of(Ready("p/2026/11/abc"), "https://cdn.example/"));
        Assert.Equal("/media/p/2026/11/abc", PhotoUrls.Of(Ready("p/2026/11/abc"), "/media"));
    }

    [Fact]
    public void A_photo_that_is_not_ready_has_no_address()
    {
        Assert.Null(PhotoUrls.Of(null, "/media"));
        Assert.Null(PhotoUrls.Of(Ready(null), "/media"));
        Assert.Null(PhotoUrls.Of(new Photo { Status = PhotoStatus.Processing, StorageKey = "p/1" }, "/media"));
    }
}

public sealed class SmallReadRulesTests
{
    [Fact]
    public void Enums_map_to_and_from_their_kebab_case_strings()
    {
        Assert.Equal("garden-centre", KebabCase.Value(BusinessKind.GardenCentre));
        Assert.Equal(["delivery", "planting", "design", "wholesale", "care"], KebabCase.Values<SellerOffer>());
        Assert.True(KebabCase.TryParse<RootSystem>("bare-root", out var root));
        Assert.Equal(RootSystem.BareRoot, root);
        Assert.False(KebabCase.TryParse<RootSystem>("BareRoot", out _));
        Assert.False(KebabCase.TryParse<RootSystem>("2", out _));
        Assert.Throws<FormatException>(() => KebabCase.Parse<RootSystem>("Bare-Root"));
    }

    [Fact]
    public void Business_kinds_are_named_in_each_language()
    {
        Assert.Equal("Tingçilik təsərrüfatı", SellerTexts.BusinessKindName(BusinessKind.Nursery, Language.Az));
        Assert.Equal("Bağ mərkəzi", SellerTexts.BusinessKindName(BusinessKind.GardenCentre, Language.Az));
        Assert.Equal("Landşaft şirkəti", SellerTexts.BusinessKindName(BusinessKind.Landscaping, Language.Az));
        Assert.Equal("Садовый центр", SellerTexts.BusinessKindName(BusinessKind.GardenCentre, Language.Ru));
        Assert.Equal("Landscaping company", SellerTexts.BusinessKindName(BusinessKind.Landscaping, Language.En));
    }

    [Fact]
    public void Paragraphs_split_at_blank_lines()
    {
        Assert.Equal(["Bir.", "İki."], ListingMapping.Paragraphs("Bir.\r\n\r\n  İki.  \n\n\n"));
        Assert.Null(ListingMapping.Paragraphs("  \n\n "));
    }
}
