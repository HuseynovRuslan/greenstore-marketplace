using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Tests.Common;

public sealed class LanguageTests
{
    [Theory]
    [InlineData(null, Language.Az)]
    [InlineData("", Language.Az)]
    [InlineData("   ", Language.Az)]
    [InlineData("az", Language.Az)]
    [InlineData("ru", Language.Ru)]
    [InlineData("en", Language.En)]
    [InlineData("RU", Language.Ru)]
    [InlineData("ru-RU", Language.Ru)]
    [InlineData("en_GB", Language.En)]
    [InlineData("az-Latn-AZ", Language.Az)]
    [InlineData("ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7", Language.Ru)]
    [InlineData("de-DE,de;q=0.9,en;q=0.5", Language.En)]
    [InlineData("en;q=0.5,ru;q=0.8", Language.Ru)]
    [InlineData("tr-TR,tr;q=0.9", Language.Az)]
    [InlineData("de, fr", Language.Az)]
    [InlineData("*", Language.Az)]
    [InlineData("ru;q=0", Language.Az)]
    [InlineData("ru;q=0, en", Language.En)]
    [InlineData("en, ru", Language.En)]
    [InlineData("ru;q=0.8, en;q=0.8", Language.Ru)]
    [InlineData("ru;q=abc, en;q=0.1", Language.En)]
    [InlineData("ru;q=2", Language.Az)]
    [InlineData(",,;", Language.Az)]
    public void Resolves_the_best_supported_language_and_falls_back_to_az(string? header, Language expected) =>
        Assert.Equal(expected, LanguageResolver.FromAcceptLanguage(header));

    [Fact]
    public void Codes_are_iso_639_1()
    {
        Assert.Equal(["az", "ru", "en"], Languages.All.Select(l => l.Code()));
        Assert.Equal(Language.Az, Languages.Default);
    }

    [Theory]
    [InlineData("tr")]
    [InlineData("azz")]
    [InlineData("")]
    [InlineData(null)]
    public void Unknown_codes_do_not_parse(string? code)
    {
        Assert.False(Languages.TryParse(code, out var language));
        Assert.Equal(Language.Az, language);
    }
}
