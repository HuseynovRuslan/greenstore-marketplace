using System.Text;

namespace GreenStore.Api.Common.Localization;

/// <summary>
/// Search normalisation, a port of <c>normalizeSearch</c> and <c>lowerAz</c> from src/lib/format.ts
/// (DATABASE.md §4, ARCHITECTURE.md §8.4). Both sides are tested with the same vectors:
/// backend/contracts/search-normalization.json.
/// <list type="number">
/// <item>Azerbaijani lower case: «I» → «ı», «İ» → «i», then the invariant lower case (Cyrillic included).</item>
/// <item>Azerbaijani letters to Latin: ə→e, ı→i, ö→o, ü→u, ş→s, ç→c, ğ→g; Russian ё→е.</item>
/// <item>Other diacritics removed: Unicode decomposition (NFD), then combining marks U+0300–U+036F dropped.
/// As in the frontend this also turns «й» into «и»; both sides do it, so queries and texts still match.</item>
/// <item>Whitespace trimmed at both ends with JavaScript's <c>String.prototype.trim</c> rules. Inner spaces stay.</item>
/// </list>
/// Known difference, not covered by the vectors: JavaScript lower-cases a word-final Greek «Σ» to «ς» («ΟΔΟΣ» →
/// «οδος»), .NET's invariant lower case to «σ» («οδοσ»). It does not matter for Azerbaijani, Russian or English text.
/// </summary>
public static class SearchText
{
    /// <summary>Azerbaijani-aware lower case: «İTALYAN IŞIQ» → «italyan ışıq».</summary>
    public static string LowerAz(string value) => value.Replace('I', 'ı').Replace('İ', 'i').ToLowerInvariant();

    /// <summary>«Zeytun AĞACI» → «zeytun agaci», «ЁЛКА» → «елка», «Crème» → «creme».</summary>
    public static string Normalize(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var lowered = LowerAz(ReplaceLoneSurrogates(value));
        var letters = new StringBuilder(lowered.Length);
        foreach (var ch in lowered)
        {
            letters.Append(ch switch
            {
                'ə' => 'e',
                'ı' => 'i',
                'ö' => 'o',
                'ü' => 'u',
                'ş' => 's',
                'ç' => 'c',
                'ğ' => 'g',
                // NFD below would do this too (ё = е + U+0308); kept explicit because it is a documented rule.
                'ё' => 'е',
                _ => ch,
            });
        }

        var decomposed = letters.ToString().Normalize(NormalizationForm.FormD);
        var result = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (ch is < '\u0300' or > '\u036F')
            {
                result.Append(ch);
            }
        }

        return TrimLikeJavaScript(result.ToString());
    }

    /// <summary>The normalised words of a query: «  Tuya   SMARAGD » → ["tuya", "smaragd"].</summary>
    public static IReadOnlyList<string> Words(string? value)
    {
        var normalized = Normalize(value);
        var words = new List<string>();
        var start = -1;
        for (var i = 0; i <= normalized.Length; i++)
        {
            var boundary = i == normalized.Length || IsJavaScriptWhiteSpace(normalized[i]);
            if (boundary && start >= 0)
            {
                words.Add(normalized[start..i]);
                start = -1;
            }
            else if (!boundary && start < 0)
            {
                start = i;
            }
        }

        return words;
    }

    /// <summary>
    /// JavaScript's WhiteSpace and LineTerminator set (ECMA-262 §12.2–12.3). It differs from .NET's
    /// <see cref="char.IsWhiteSpace(char)"/> in two characters: U+FEFF is white space in JavaScript, U+0085 is not.
    /// </summary>
    internal static bool IsJavaScriptWhiteSpace(char ch) => ch == '\uFEFF' || (ch != '\u0085' && char.IsWhiteSpace(ch));

    private static string TrimLikeJavaScript(string value)
    {
        var start = 0;
        var end = value.Length;
        while (start < end && IsJavaScriptWhiteSpace(value[start]))
        {
            start++;
        }

        while (end > start && IsJavaScriptWhiteSpace(value[end - 1]))
        {
            end--;
        }

        return value[start..end];
    }

    /// <summary>
    /// <see cref="string.Normalize()"/> throws on an unpaired surrogate (JavaScript keeps it). Such input is never
    /// meaningful text, so it becomes U+FFFD instead of a 500.
    /// </summary>
    private static string ReplaceLoneSurrogates(string value)
    {
        StringBuilder? fixedValue = null;
        for (var i = 0; i < value.Length; i++)
        {
            var ch = value[i];
            var paired = char.IsHighSurrogate(ch)
                ? i + 1 < value.Length && char.IsLowSurrogate(value[i + 1])
                : !char.IsLowSurrogate(ch) || (i > 0 && char.IsHighSurrogate(value[i - 1]));

            if (!paired)
            {
                fixedValue ??= new StringBuilder(value, 0, i, value.Length);
                fixedValue.Append('\uFFFD');
            }
            else
            {
                fixedValue?.Append(ch);
            }
        }

        return fixedValue?.ToString() ?? value;
    }
}
