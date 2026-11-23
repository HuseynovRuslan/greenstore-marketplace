namespace GreenStore.Api.Common.Localization;

/// <summary>The languages of the platform. Serialised as "az", "ru", "en".</summary>
public enum Language
{
    Az,
    Ru,
    En,
}

public static class Languages
{
    /// <summary>The default and fallback language: every localised text has an Azerbaijani value.</summary>
    public const Language Default = Language.Az;

    public static IReadOnlyList<Language> All { get; } = [Language.Az, Language.Ru, Language.En];

    /// <summary>"az", "ru", "en" (ISO 639-1).</summary>
    public static string Code(this Language language) => language switch
    {
        Language.Ru => "ru",
        Language.En => "en",
        _ => "az",
    };

    /// <summary>Parses a language code or tag ("ru", "RU", "ru-RU", "az-Latn-AZ"); only az, ru and en are known.</summary>
    public static bool TryParse(string? value, out Language language)
    {
        language = Default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var tag = value.AsSpan().Trim();
        var end = tag.IndexOfAny('-', '_');
        var primary = end < 0 ? tag : tag[..end];

        if (primary.Equals("az", StringComparison.OrdinalIgnoreCase))
        {
            language = Language.Az;
            return true;
        }

        if (primary.Equals("ru", StringComparison.OrdinalIgnoreCase))
        {
            language = Language.Ru;
            return true;
        }

        if (primary.Equals("en", StringComparison.OrdinalIgnoreCase))
        {
            language = Language.En;
            return true;
        }

        return false;
    }
}
