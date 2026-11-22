using System.Text.Json;
using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Tests.Common;

public sealed class SearchTextTests
{
    /// <summary>
    /// Every vector of backend/contracts/search-normalization.json; the frontend runs the same file and skips the
    /// "backendOnly" ones, the backend runs them all.
    /// </summary>
    public static IReadOnlyList<(string Input, string Expected)> LoadVectors()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "contracts", "search-normalization.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return document.RootElement.GetProperty("vectors").EnumerateArray()
            .Select(v => (v.GetProperty("input").GetString()!, v.GetProperty("expected").GetString()!))
            .ToList();
    }

    public static TheoryData<string, string> ContractVectors()
    {
        var data = new TheoryData<string, string>();
        foreach (var (input, expected) in LoadVectors())
        {
            data.Add(input, expected);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(ContractVectors))]
    public void Normalize_matches_the_shared_contract_vectors(string input, string expected) =>
        Assert.Equal(expected, SearchText.Normalize(input));

    [Fact]
    public void Contract_file_has_vectors_for_every_required_case()
    {
        var inputs = LoadVectors().Select(v => v.Input).ToList();
        Assert.True(inputs.Count >= 30);
        foreach (var required in new[] { "İ", "I", "ı", "ЁЛКА", "ёлка" })
        {
            Assert.Contains(required, inputs);
        }

        foreach (var letter in "əğöüşçƏĞÖÜŞÇ")
        {
            Assert.Contains(inputs, input => input.Contains(letter, StringComparison.Ordinal));
        }
    }

    [Theory]
    [InlineData("İTALYAN IŞIQ", "italyan ışıq")]
    [InlineData("DİBÇƏKDƏ", "dibçəkdə")]
    [InlineData("Ilıq", "ılıq")]
    [InlineData("РОЗЫ", "розы")]
    public void LowerAz_uses_Azerbaijani_dotted_and_dotless_i(string input, string expected) =>
        Assert.Equal(expected, SearchText.LowerAz(input));

    [Fact]
    public void Normalize_of_null_is_empty() => Assert.Equal(string.Empty, SearchText.Normalize(null));

    [Fact]
    public void Normalize_makes_the_same_key_for_spellings_users_type()
    {
        Assert.Equal(SearchText.Normalize("zeytun agaci"), SearchText.Normalize("Zeytun AĞACI"));
        Assert.Equal(SearchText.Normalize("елка"), SearchText.Normalize("Ёлка"));
    }

    [Fact]
    public void Normalize_does_not_throw_on_unpaired_surrogates()
    {
        Assert.Equal("\uFFFDab", SearchText.Normalize("\uD800ab"));
        Assert.Equal("a\uFFFD", SearchText.Normalize("a\uDC00"));
        Assert.Equal("😀 gul", SearchText.Normalize("😀 Gül"));
    }

    [Fact]
    public void Normalize_keeps_U0085_like_JavaScript_trim()
    {
        Assert.Equal("\u0085gul", SearchText.Normalize("\u0085Gül"));
    }

    [Fact]
    public void Words_splits_on_white_space_and_drops_empty_parts()
    {
        Assert.Equal(["tuya", "smaragd"], SearchText.Words("  Tuya \t  SMARAGD\n"));
        Assert.Equal(["gul", "agaci"], SearchText.Words("Gül\u00A0ağacı"));
        Assert.Empty(SearchText.Words("   "));
        Assert.Empty(SearchText.Words(null));
    }
}
