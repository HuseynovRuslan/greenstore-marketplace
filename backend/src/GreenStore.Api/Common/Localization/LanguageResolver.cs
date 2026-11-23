using System.Globalization;

namespace GreenStore.Api.Common.Localization;

/// <summary>
/// Picks the response language from an <c>Accept-Language</c> header (ARCHITECTURE.md §8.2): the supported language
/// (az, ru, en) with the highest quality, the first one on a tie; Azerbaijani when nothing supported is asked for.
/// </summary>
public static class LanguageResolver
{
    public static Language FromAcceptLanguage(string? header)
    {
        if (string.IsNullOrWhiteSpace(header))
        {
            return Languages.Default;
        }

        Language? best = null;
        var bestQuality = 0.0;

        foreach (var part in header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var pieces = part.Split(';', StringSplitOptions.TrimEntries);
            if (!Languages.TryParse(pieces[0], out var language))
            {
                continue;
            }

            var quality = Quality(pieces);
            if (quality > bestQuality)
            {
                best = language;
                bestQuality = quality;
            }
        }

        return best ?? Languages.Default;
    }

    /// <summary>The "q" parameter (RFC 9110 §12.4.2): 1 when absent, 0 when malformed (not acceptable).</summary>
    private static double Quality(string[] pieces)
    {
        foreach (var parameter in pieces.Skip(1))
        {
            if (!parameter.StartsWith("q=", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            return double.TryParse(parameter.AsSpan(2), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var q)
                && q is >= 0 and <= 1
                ? q
                : 0;
        }

        return 1;
    }
}
