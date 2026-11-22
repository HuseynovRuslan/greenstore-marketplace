using System.Text.Json;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Tests.Common;

public sealed class LocalizedTextTests
{
    private static readonly JsonSerializerOptions Api = JsonDefaults.Create();

    [Fact]
    public void Get_returns_the_requested_language()
    {
        var text = new LocalizedText("Güllər", "Розы", "Roses");
        Assert.Equal("Güllər", text.Get(Language.Az));
        Assert.Equal("Розы", text.Get(Language.Ru));
        Assert.Equal("Roses", text.Get(Language.En));
    }

    [Fact]
    public void Get_falls_back_to_az_when_a_language_is_missing_or_blank()
    {
        var text = new LocalizedText("Güllər", Ru: "  ");
        Assert.Equal("Güllər", text.Get(Language.Ru));
        Assert.Equal("Güllər", text.Get(Language.En));
    }

    [Fact]
    public void Values_lists_every_language_that_has_a_text()
    {
        Assert.Equal(["Güllər", "Розы", "Roses"], new LocalizedText("Güllər", "Розы", "Roses").Values());
        Assert.Equal(["Güllər", "Roses"], new LocalizedText("Güllər", "", "Roses").Values());
    }

    [Fact]
    public void Az_is_required()
    {
        Assert.True(new LocalizedText("Güllər").IsValid);
        Assert.False(new LocalizedText(" ").IsValid);
    }

    [Fact]
    public void Serialises_as_the_TypeScript_LocalizedText_shape()
    {
        Assert.Equal("""{"az":"Güllər","ru":"Розы"}""", JsonSerializer.Serialize(new LocalizedText("Güllər", "Розы"), Api));
    }

    [Fact]
    public void Deserialises_with_optional_ru_and_en()
    {
        Assert.Equal(new LocalizedText("Güllər"), JsonSerializer.Deserialize<LocalizedText>("""{"az":"Güllər"}""", Api));
        Assert.Equal(new LocalizedText("Güllər", "Розы", "Roses"), JsonSerializer.Deserialize<LocalizedText>("""{"az":"Güllər","ru":"Розы","en":"Roses"}""", Api));
    }

    [Theory]
    [InlineData("""{"ru":"Розы"}""")]
    [InlineData("""{"az":null}""")]
    public void A_missing_or_null_az_is_rejected(string json) =>
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<LocalizedText>(json, Api));
}
