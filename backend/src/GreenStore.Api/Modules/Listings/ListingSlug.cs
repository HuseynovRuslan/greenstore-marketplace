using System.Globalization;
using System.Text;
using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// Listing addresses (decision 3, backend-contract.md 1.2): the title in ASCII, then the listing number,
/// «Zeytun ağacı — Olea europaea» № 10482 → <c>zeytun-agaci-olea-europaea-10482</c>. The same in every language.
/// The number makes the slug unique and is what a lookup uses, so an old slug (the title changed since) still finds
/// the listing and the API answers with the current one.
/// </summary>
public static class ListingSlug
{
    /// <summary>Longest title part; the number follows it.</summary>
    public const int MaxTitleLength = 60;

    /// <summary>Used when nothing of the title is left in ASCII (a title in emoji, say).</summary>
    public const string Fallback = "elan";

    public static string Create(string title, long number)
    {
        var text = Transliterate(title);
        return $"{(text.Length == 0 ? Fallback : text)}-{number.ToString(CultureInfo.InvariantCulture)}";
    }

    /// <summary>
    /// The ASCII words of a text, joined by hyphens: Azerbaijani and other Latin letters lose their marks (the search
    /// normalisation, <see cref="SearchText.Normalize"/>), Russian letters are transliterated, anything else separates
    /// words. Cut at a word boundary to <see cref="MaxTitleLength"/>.
    /// </summary>
    public static string Transliterate(string? text)
    {
        var normalized = SearchText.Normalize(text);
        var ascii = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (ch is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
            {
                ascii.Append(ch);
            }
            else if (Cyrillic.TryGetValue(ch, out var latin))
            {
                ascii.Append(latin);
            }
            else
            {
                ascii.Append('-');
            }
        }

        var words = ascii.ToString().Split('-', StringSplitOptions.RemoveEmptyEntries);
        var slug = new StringBuilder();
        foreach (var word in words)
        {
            var next = slug.Length == 0 ? word.Length : slug.Length + 1 + word.Length;
            if (next > MaxTitleLength)
            {
                if (slug.Length == 0)
                {
                    slug.Append(word.AsSpan(0, MaxTitleLength));
                }

                break;
            }

            if (slug.Length > 0)
            {
                slug.Append('-');
            }

            slug.Append(word);
        }

        return slug.ToString();
    }

    /// <summary>The number at the end of a slug: <c>zeytun-agaci-10482</c> → 10482. False when there is none.</summary>
    public static bool TryGetNumber(string? slug, out long number)
    {
        number = 0;
        if (string.IsNullOrEmpty(slug))
        {
            return false;
        }

        var dash = slug.LastIndexOf('-');
        var digits = dash < 0 ? slug : slug[(dash + 1)..];
        return digits.Length is > 0 and <= 18
            && digits.All(char.IsAsciiDigit)
            && long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out number);
    }

    /// <summary>
    /// Russian letters after <see cref="SearchText.Normalize"/> (which already turned «ё» into «е» and «й» into «и»).
    /// A simple, readable scheme close to the one passports use.
    /// </summary>
    private static readonly Dictionary<char, string> Cyrillic = new()
    {
        ['а'] = "a",
        ['б'] = "b",
        ['в'] = "v",
        ['г'] = "g",
        ['д'] = "d",
        ['е'] = "e",
        ['ж'] = "zh",
        ['з'] = "z",
        ['и'] = "i",
        ['к'] = "k",
        ['л'] = "l",
        ['м'] = "m",
        ['н'] = "n",
        ['о'] = "o",
        ['п'] = "p",
        ['р'] = "r",
        ['с'] = "s",
        ['т'] = "t",
        ['у'] = "u",
        ['ф'] = "f",
        ['х'] = "kh",
        ['ц'] = "ts",
        ['ч'] = "ch",
        ['ш'] = "sh",
        ['щ'] = "shch",
        ['ъ'] = string.Empty,
        ['ы'] = "y",
        ['ь'] = string.Empty,
        ['э'] = "e",
        ['ю'] = "yu",
        ['я'] = "ya",
    };
}
