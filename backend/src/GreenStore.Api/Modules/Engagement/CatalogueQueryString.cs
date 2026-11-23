using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// The product catalogue's query string as the site writes it (src/features/search/filterDefs.ts <c>PARAM</c>:
/// <c>q</c>, <c>kateqoriya</c>, <c>alt</c>, <c>seher</c>, <c>min</c>, <c>max</c>, <c>hundurluk</c>, <c>yas</c>,
/// <c>kok</c>, <c>vip</c>, <c>catdirilma</c>, <c>saticiNovu</c>), read the way the site reads it
/// (<c>parseSearchState</c>, <c>toListingFilters</c>, src/services/apiQuery.ts), for saved searches.
/// </summary>
public static partial class CatalogueQueryString
{
    public const int MaxLength = 500;

    /// <summary>Page, sort and view: not part of a saved search (src/features/saved-searches/useSavedSearches.ts).</summary>
    private static readonly string[] NotFilters = ["sehife", "siralama", "gorunus"];

    /// <summary>«Kök sistemi» in the URL (src/features/search/filterDefs.ts <c>rootSystemOf</c>).</summary>
    private static readonly Dictionary<string, RootSystem> RootSystems = new(StringComparer.Ordinal)
    {
        ["dibcek"] = RootSystem.Container,
        ["torpaq-kuresi"] = RootSystem.Rootball,
        ["aciq-kok"] = RootSystem.BareRoot,
    };

    private const decimal MaxAmount = 99_999_999.99m;

    /// <summary>
    /// The site's <c>filterQuery</c>: without page, sort and view, the parameters sorted by name (a stable sort, as
    /// <c>URLSearchParams.sort()</c>), written as <c>URLSearchParams</c> writes them. Two links to the same search give
    /// the same text, so saving it again updates the saved search instead of adding a second one.
    /// </summary>
    public static string Normalize(string? query)
    {
        var parameters = Parse(query)
            .Where(p => !NotFilters.Contains(p.Key, StringComparer.Ordinal))
            .OrderBy(p => p.Key, StringComparer.Ordinal);
        return Serialize(parameters);
    }

    /// <summary>The search a query string describes, with unknown categories, sub-categories and cities left out, as the site does.</summary>
    public static ListingFilter ToFilter(string? query, TaxonomySnapshot taxonomy)
    {
        var parameters = Parse(query);
        string? Get(string name) => parameters.FirstOrDefault(p => p.Key == name).Value;

        var category = taxonomy.Category(Get("kateqoriya"));
        var categoryId = category is { ParentId: null, Kind: CategoryKind.Product, IsActive: true } ? category.Id : null;
        var subcategory = taxonomy.Category(Get("alt"));
        var subcategoryId = categoryId is not null && subcategory?.ParentId == categoryId ? subcategory.Id : null;
        var cityIds = (Get("seher") ?? string.Empty)
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .ToHashSet(StringComparer.Ordinal);
        var (heightMin, heightMax) = Range(Get("hundurluk"));
        var (ageMin, ageMax) = Range(Get("yas"));
        var q = Get("q")?.Trim();

        return new ListingFilter
        {
            Query = string.IsNullOrEmpty(q) ? null : q,
            CategoryId = categoryId,
            SubcategoryId = subcategoryId,
            CityIds = taxonomy.Cities.Where(c => cityIds.Contains(c.Id)).Select(c => c.Id).ToList(),
            MinPrice = Price(Get("min"), Math.Ceiling),
            MaxPrice = Price(Get("max"), Math.Floor),
            PromotedOnly = Get("vip") == "1",
            DeliveryOnly = Get("catdirilma") == "1",
            SellerType = Get("saticiNovu") switch
            {
                "biznes" => AccountType.Business,
                "ferdi" => AccountType.Individual,
                _ => null,
            },
            HeightMin = heightMin,
            HeightMax = heightMax,
            AgeMin = ageMin,
            AgeMax = ageMax,
            RootSystem = Get("kok") is { } root && RootSystems.TryGetValue(root, out var system) ? system : null,
        };
    }

    /// <summary>
    /// <c>new URLSearchParams(query)</c>: a leading "?" dropped, pairs split at "&amp;" and the first "=", "+" read as
    /// a space, percent escapes decoded as UTF-8.
    /// </summary>
    public static IReadOnlyList<KeyValuePair<string, string>> Parse(string? query)
    {
        var text = query ?? string.Empty;
        if (text.StartsWith('?'))
        {
            text = text[1..];
        }

        var result = new List<KeyValuePair<string, string>>();
        foreach (var pair in text.Split('&'))
        {
            if (pair.Length == 0)
            {
                continue;
            }

            var equals = pair.IndexOf('=');
            var name = equals < 0 ? pair : pair[..equals];
            var value = equals < 0 ? string.Empty : pair[(equals + 1)..];
            result.Add(new(Decode(name), Decode(value)));
        }

        return result;
    }

    /// <summary><c>URLSearchParams.toString()</c> (application/x-www-form-urlencoded).</summary>
    public static string Serialize(IEnumerable<KeyValuePair<string, string>> parameters) =>
        string.Join('&', parameters.Select(p => $"{Encode(p.Key)}={Encode(p.Value)}"));

    private static string Encode(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var b in Encoding.UTF8.GetBytes(value))
        {
            if (b is (byte)'*' or (byte)'-' or (byte)'.' or (byte)'_' || char.IsAsciiLetterOrDigit((char)b))
            {
                builder.Append((char)b);
            }
            else if (b == (byte)' ')
            {
                builder.Append('+');
            }
            else
            {
                builder.Append('%').Append(b.ToString("X2", CultureInfo.InvariantCulture));
            }
        }

        return builder.ToString();
    }

    private static string Decode(string value)
    {
        var plain = value.Replace('+', ' ');
        var bytes = new List<byte>(plain.Length);
        var i = 0;
        while (i < plain.Length)
        {
            if (plain[i] == '%' && i + 2 < plain.Length
                && byte.TryParse(plain.AsSpan(i + 1, 2), NumberStyles.AllowHexSpecifier, CultureInfo.InvariantCulture, out var escaped))
            {
                bytes.Add(escaped);
                i += 3;
                continue;
            }

            // Up to the next "%" (whole runs, so a surrogate pair stays one character).
            var next = plain.IndexOf('%', i + 1);
            var run = next < 0 ? plain[i..] : plain[i..next];
            bytes.AddRange(Encoding.UTF8.GetBytes(run));
            i += run.Length;
        }

        return Encoding.UTF8.GetString(bytes.ToArray());
    }

    /// <summary>
    /// <c>min</c> and <c>max</c>: any finite number, as the site accepts (<c>isPrice</c>), brought into the API's range
    /// in whole qəpik the way src/services/apiQuery.ts does: a minimum rounds up, a maximum down.
    /// </summary>
    private static decimal? Price(string? value, Func<decimal, decimal> round)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text)
            || !decimal.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var amount))
        {
            return null;
        }

        var clamped = Math.Clamp(amount, 0, MaxAmount);
        return round(clamped * 100) / 100;
    }

    /// <summary>"100-200", "-100", "300-" (not "-" alone), as the site's <c>parseRange</c>.</summary>
    private static (int? Min, int? Max) Range(string? value)
    {
        var match = value is null or "-" ? null : RangePattern().Match(value.Trim());
        if (match is not { Success: true })
        {
            return (null, null);
        }

        return (Bound(match.Groups[1].Value), Bound(match.Groups[2].Value));
    }

    private static int? Bound(string digits)
    {
        if (digits.Length == 0)
        {
            return null;
        }

        return long.TryParse(digits, NumberStyles.None, CultureInfo.InvariantCulture, out var number) && number <= int.MaxValue
            ? (int)number
            : int.MaxValue;
    }

    [GeneratedRegex(@"^(\d*)-(\d*)$")]
    private static partial Regex RangePattern();
}
