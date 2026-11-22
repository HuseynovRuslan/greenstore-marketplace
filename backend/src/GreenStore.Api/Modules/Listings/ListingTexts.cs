using System.Globalization;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The few display texts the contract still carries as text, in the request's language: a listing card's grey line
/// (<c>Listing.attributes</c>) and a service's <c>priceLabel</c> (backend-contract.md 1.7, until the UI words it from
/// <c>priceType</c> and <c>priceUnit</c>). Azerbaijani follows the site's own wording (src/features/posting/attributes.ts,
/// src/features/listing/facts.ts); Russian and English are DRAFT translations, like the category names.
/// </summary>
public static class ListingTexts
{
    /// <summary>
    /// The card line, as «Elan yerləşdir» writes it (<c>attributeLine</c> in src/features/posting/attributes.ts):
    /// plants «180–200 sm · 5 yaş · dibçəkdə» from the plant facts; other forms the seller's own words
    /// («20 litrlik kisə», «Yeni · Gardena»).
    /// </summary>
    public static IReadOnlyList<string> AttributeLine(
        CategoryForm? form,
        IReadOnlyDictionary<string, string> attributes,
        int? heightMinCm,
        int? heightMaxCm,
        int? ageYears,
        RootSystem? rootSystem,
        Language language)
    {
        var line = new List<string>();
        if (form is CategoryForm.Plant)
        {
            if (heightMinCm is { } min)
            {
                line.Add(Height(min, heightMaxCm, language));
            }

            if (ageYears is { } age)
            {
                line.Add(Age(age, language));
            }

            if (rootSystem is { } root)
            {
                line.Add(Root(root, language));
            }

            return line;
        }

        if (form is CategoryForm.Service)
        {
            return line;
        }

        Add(line, attributes.GetValueOrDefault("pack"));
        if (attributes.GetValueOrDefault("condition") is { } condition && Condition(condition, language) is { } conditionText)
        {
            line.Add(conditionText);
        }

        Add(line, attributes.GetValueOrDefault("brand"));
        return line;
    }

    /// <summary>{180, 200} → «180–200 sm»; {120} → «120 sm».</summary>
    public static string Height(int min, int? max, Language language)
    {
        var unit = language switch
        {
            Language.Ru => "см",
            Language.En => "cm",
            _ => "sm",
        };
        var value = max is { } top && top != min ? $"{Number(min)}–{Number(top)}" : Number(min);
        return $"{value} {unit}";
    }

    /// <summary>«5 yaş», «5 лет» (1 год, 2 года), «5 years» (1 year).</summary>
    public static string Age(int years, Language language) => language switch
    {
        Language.Ru => $"{Number(years)} {RussianPlural(years, "год", "года", "лет")}",
        Language.En => $"{Number(years)} {(years == 1 ? "year" : "years")}",
        _ => $"{Number(years)} yaş",
    };

    /// <summary>The card line's root system, lower case: «dibçəkdə», «torpaq kürəsi ilə», «açıq kök».</summary>
    public static string Root(RootSystem root, Language language) => (root, language) switch
    {
        (RootSystem.Container, Language.Ru) => "в контейнере",
        (RootSystem.Rootball, Language.Ru) => "с комом земли",
        (RootSystem.BareRoot, Language.Ru) => "с открытыми корнями",
        (RootSystem.Container, Language.En) => "in a container",
        (RootSystem.Rootball, Language.En) => "root-balled",
        (RootSystem.BareRoot, Language.En) => "bare-root",
        (RootSystem.Container, _) => "dibçəkdə",
        (RootSystem.Rootball, _) => "torpaq kürəsi ilə",
        _ => "açıq kök",
    };

    /// <summary>«Yeni» / «İşlənmiş» for the goods form's <c>condition</c>; null for an unknown value.</summary>
    public static string? Condition(string value, Language language) => (value, language) switch
    {
        ("new", Language.Ru) => "Новый",
        ("used", Language.Ru) => "Б/у",
        ("new", Language.En) => "New",
        ("used", Language.En) => "Used",
        ("new", _) => "Yeni",
        ("used", _) => "İşlənmiş",
        _ => null,
    };

    /// <summary>
    /// A service's price as one text: «25 ₼/m²-dən», «350 ₼-dən», «Razılaşma yolu ilə»
    /// (ru «от 25 ₼/м²», en «from 25 ₼/m²»).
    /// </summary>
    public static string ServicePriceLabel(PriceType type, decimal? price, PriceUnit? unit, Language language)
    {
        if (type == PriceType.Agreement || price is null)
        {
            return language switch
            {
                Language.Ru => "По договорённости",
                Language.En => "By agreement",
                _ => "Razılaşma yolu ilə",
            };
        }

        var amount = $"{Money.Format(price.Value, language)} ₼";
        return language switch
        {
            Language.Ru => unit is { } ru ? $"от {amount}/{UnitRu(ru)}" : $"от {amount}",
            Language.En => unit is { } en ? $"from {amount}/{UnitEn(en)}" : $"from {amount}",
            _ => unit is { } az ? $"{amount}/{UnitFromAz(az)}" : $"{amount}-dən",
        };
    }

    /// <summary>«m²-dən», «saatdan»: the unit with the ablative suffix (src/features/listing/facts.ts <c>unitFrom</c>).</summary>
    private static string UnitFromAz(PriceUnit unit) => unit switch
    {
        PriceUnit.Piece => "ədəddən",
        PriceUnit.Kg => "kq-dan",
        PriceUnit.Litre => "litrdən",
        PriceUnit.Sqm => "m²-dən",
        PriceUnit.Bag => "kisədən",
        PriceUnit.Set => "dəstdən",
        PriceUnit.Metre => "metrdən",
        PriceUnit.Hour => "saatdan",
        _ => "işdən",
    };

    private static string UnitRu(PriceUnit unit) => unit switch
    {
        PriceUnit.Piece => "шт.",
        PriceUnit.Kg => "кг",
        PriceUnit.Litre => "л",
        PriceUnit.Sqm => "м²",
        PriceUnit.Bag => "мешок",
        PriceUnit.Set => "набор",
        PriceUnit.Metre => "м",
        PriceUnit.Hour => "час",
        _ => "работа",
    };

    private static string UnitEn(PriceUnit unit) => unit switch
    {
        PriceUnit.Piece => "piece",
        PriceUnit.Kg => "kg",
        PriceUnit.Litre => "litre",
        PriceUnit.Sqm => "m²",
        PriceUnit.Bag => "bag",
        PriceUnit.Set => "set",
        PriceUnit.Metre => "metre",
        PriceUnit.Hour => "hour",
        _ => "job",
    };

    /// <summary>1 год, 2 года, 5 лет, 11 лет, 21 год, 22 года.</summary>
    private static string RussianPlural(int n, string one, string few, string many)
    {
        var tens = Math.Abs(n) % 100;
        var units = tens % 10;
        if (tens is >= 11 and <= 14)
        {
            return many;
        }

        return units switch
        {
            1 => one,
            >= 2 and <= 4 => few,
            _ => many,
        };
    }

    private static string Number(int value) => value.ToString(CultureInfo.InvariantCulture);

    private static void Add(List<string> line, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            line.Add(value.Trim());
        }
    }
}
