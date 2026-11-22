using System.Text.Json.Serialization;

namespace GreenStore.Api.Common.Localization;

/// <summary>
/// A system text in the three languages: category, city and promotion package names (ARCHITECTURE.md §8.1).
/// Stored as <c>jsonb</c> <c>{ "az": "Güllər", "ru": "Розы", "en": "Roses" }</c>; Azerbaijani is required, the others
/// fall back to it. Matches the TypeScript <c>LocalizedText = { az: string; ru?: string; en?: string }</c>.
/// Public responses send <see cref="Get"/> as a plain string; admin responses send the whole object.
/// </summary>
public sealed record LocalizedText(string Az, string? Ru = null, string? En = null)
{
    /// <summary>The text in <paramref name="language"/>, or the Azerbaijani text when that one is missing or blank.</summary>
    public string Get(Language language)
    {
        var value = language switch
        {
            Language.Ru => Ru,
            Language.En => En,
            _ => Az,
        };
        return string.IsNullOrWhiteSpace(value) ? Az : value;
    }

    /// <summary>Every non-blank value, Azerbaijani first: what search text indexes, so «розы» and «roses» find «güllər».</summary>
    public IEnumerable<string> Values()
    {
        yield return Az;
        if (!string.IsNullOrWhiteSpace(Ru))
        {
            yield return Ru;
        }

        if (!string.IsNullOrWhiteSpace(En))
        {
            yield return En;
        }
    }

    /// <summary>False when the required Azerbaijani text is missing; inputs are checked with this before saving.</summary>
    [JsonIgnore]
    public bool IsValid => !string.IsNullOrWhiteSpace(Az);
}
