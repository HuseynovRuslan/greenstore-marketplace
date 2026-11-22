using System.Text.Json;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Infrastructure.Samples;

namespace GreenStore.Api.Tests.Common;

public sealed class JsonDefaultsTests
{
    private static readonly JsonSerializerOptions Api = JsonDefaults.Create();

    private static string Write<T>(T value) => JsonSerializer.Serialize(value, Api);

    [Theory]
    [InlineData(RootSystem.Container, "container")]
    [InlineData(RootSystem.Rootball, "rootball")]
    [InlineData(RootSystem.BareRoot, "bare-root")]
    [InlineData(SunNeed.FullSun, "full-sun")]
    [InlineData(SunNeed.PartShade, "part-shade")]
    [InlineData(BusinessKind.GardenCentre, "garden-centre")]
    [InlineData(PromotionPackageId.OneCixar, "one-cixar")]
    [InlineData(PromotionPackageId.IreliCek, "ireli-cek")]
    [InlineData(ListingStatus.Draft, "draft")]
    [InlineData(PriceUnit.Sqm, "sqm")]
    [InlineData(PriceUnit.Kg, "kg")]
    public void Enums_are_the_kebab_case_strings_of_the_TypeScript_unions(object value, string expected)
    {
        Assert.Equal($"\"{expected}\"", JsonSerializer.Serialize(value, value.GetType(), Api));
        Assert.Equal(value, JsonSerializer.Deserialize($"\"{expected}\"", value.GetType(), Api));
    }

    [Fact]
    public void A_union_string_the_naming_policy_cannot_produce_comes_from_the_member_attribute()
    {
        // IconName in src/types has 'flower-2'; the kebab-case policy alone would write "flower2".
        Assert.Equal("\"flower-2\"", Write(IconName.Flower2));
        Assert.Equal(IconName.Flower2, JsonSerializer.Deserialize<IconName>("\"flower-2\"", Api));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<IconName>("\"flower2\"", Api));
        Assert.Equal("\"flower\"", Write(IconName.Flower));
    }

    [Fact]
    public void Enums_are_not_accepted_as_numbers() =>
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<RootSystem>("2", Api));

    [Fact]
    public void Unknown_enum_strings_are_rejected() =>
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<RootSystem>("\"tree\"", Api));

    [Fact]
    public void Dates_are_written_as_utc_with_a_Z()
    {
        Assert.Equal("\"2026-10-28T06:15:00Z\"", Write(new DateTimeOffset(2026, 10, 28, 10, 15, 0, TimeSpan.FromHours(4))));
        Assert.Equal("\"2026-10-28T06:15:00.25Z\"", Write(new DateTimeOffset(2026, 10, 28, 6, 15, 0, 250, TimeSpan.Zero)));
        Assert.Equal("\"2026-10-28T06:15:00Z\"", Write(new DateTime(2026, 10, 28, 6, 15, 0, DateTimeKind.Utc)));
        Assert.Equal("\"2026-10-28T06:15:00Z\"", Write(new DateTime(2026, 10, 28, 6, 15, 0, DateTimeKind.Unspecified)));
    }

    [Fact]
    public void Dates_are_read_as_utc()
    {
        var expected = new DateTimeOffset(2026, 10, 28, 6, 15, 0, TimeSpan.Zero);
        Assert.Equal(expected, JsonSerializer.Deserialize<DateTimeOffset>("\"2026-10-28T06:15:00Z\"", Api));
        Assert.Equal(expected, JsonSerializer.Deserialize<DateTimeOffset>("\"2026-10-28T10:15:00+04:00\"", Api));
        Assert.Equal(expected, JsonSerializer.Deserialize<DateTimeOffset>("\"2026-10-28T06:15:00\"", Api));
        Assert.Equal(TimeSpan.Zero, JsonSerializer.Deserialize<DateTimeOffset>("\"2026-10-28T10:15:00+04:00\"", Api).Offset);
        Assert.Equal(DateTimeKind.Utc, JsonSerializer.Deserialize<DateTime>("\"2026-10-28T10:15:00+04:00\"", Api).Kind);
    }

    [Theory]
    [InlineData("\"28.10.2026\"")]
    [InlineData("\"yesterday\"")]
    [InlineData("1761632100")]
    public void Malformed_dates_are_rejected(string json) =>
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<DateTimeOffset>(json, Api));

    [Fact]
    public void Properties_are_camel_case_and_nulls_are_left_out()
    {
        var json = Write(TestEndpoints.Sample);
        Assert.Equal(
            """{"id":"019a8b4e-0000-7000-8000-000000000001","title":"Zeytun ağacı","rootSystem":"bare-root","businessKind":"garden-centre","packageId":"one-cixar","status":"active","priceUnit":"sqm","publishedAt":"2026-10-28T06:15:00Z","stock":12,"name":{"az":"Güllər","ru":"Розы"}}""",
            json);
    }

    [Fact]
    public void Dictionary_keys_are_sent_as_they_are()
    {
        Assert.Equal("""{"agaclar-meyve":3,"Baki":1}""", Write(new Dictionary<string, int> { ["agaclar-meyve"] = 3, ["Baki"] = 1 }));
    }

    [Fact]
    public void Html_sensitive_characters_stay_escaped() =>
        Assert.Equal("\"\\u003Cb\\u003E \\u0026 \\u0027ə\\u0027\"", Write("<b> & 'ə'"));

    [Fact]
    public void Numbers_in_strings_are_rejected() =>
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<int>("\"12\"", Api));
}
