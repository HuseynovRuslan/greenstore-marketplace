using System.Globalization;
using GreenStore.Api.Common;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// One changed field between two revisions, as the moderator sees it: «price: 145 → 120». Values are plain strings
/// (numbers invariant, enums as their kebab-case codes); a missing value is null.
/// </summary>
public sealed record FieldChange(string Field, string? Before = null, string? After = null);

/// <summary>
/// What changed between the last approved revision and the pending one (DATABASE.md §3.5): the moderator checks only
/// that, «qiymət 145 → 120 ₼, 2 şəkil əlavə olunub». Field names are the <c>ListingInput</c> paths.
/// </summary>
public static class RevisionDiff
{
    public static IReadOnlyList<FieldChange> Compare(ListingContent before, ListingContent after)
    {
        var changes = new List<FieldChange>();
        void Add(string field, string? a, string? b)
        {
            if (!string.Equals(a, b, StringComparison.Ordinal))
            {
                changes.Add(new FieldChange(field, a, b));
            }
        }

        Add("kind", Code(before.Kind), Code(after.Kind));
        Add("categoryId", before.CategoryId, after.CategoryId);
        Add("subcategoryId", before.SubcategoryId, after.SubcategoryId);
        // A service's types, the main one first: a line of their own once either version has more than one (with one
        // type, as for a product, the subcategoryId line above already says it).
        var typesBefore = before.AllSubcategoryIds();
        var typesAfter = after.AllSubcategoryIds();
        if (typesBefore.Count > 1 || typesAfter.Count > 1)
        {
            Add("subcategoryIds", List(typesBefore), List(typesAfter));
        }

        Add("title", before.Title, after.Title);
        Add("description", before.Description, after.Description);
        Add("plant.species", before.Species, after.Species);
        Add("plant.heightCm", Height(before), Height(after));
        Add("plant.ageYears", Number(before.AgeYears), Number(after.AgeYears));
        Add("plant.rootSystem", Code(before.RootSystem), Code(after.RootSystem));
        Add("plant.potLitres", Number(before.Plant?.PotLitres), Number(after.Plant?.PotLitres));
        Add("plant.sun", Code(before.Plant?.Sun), Code(after.Plant?.Sun));
        Add("plant.water", Code(before.Plant?.Water), Code(after.Plant?.Water));
        Add("plant.frostHardinessC", Number(before.Plant?.FrostHardinessC), Number(after.Plant?.FrostHardinessC));
        Add("plant.foliage", Code(before.Plant?.Foliage), Code(after.Plant?.Foliage));
        Add("plant.plantingMonths", List(before.Plant?.PlantingMonths?.Select(m => Number(m))), List(after.Plant?.PlantingMonths?.Select(m => Number(m))));
        Add("availability", Code(before.Availability), Code(after.Availability));
        Add("priceType", Code(before.PriceType), Code(after.PriceType));
        Add("price", Number(before.Price), Number(after.Price));
        Add("priceUnit", Code(before.PriceUnit), Code(after.PriceUnit));
        Add("wholesale", Wholesale(before), Wholesale(after));
        Add("quantityAvailable", Number(before.QuantityAvailable), Number(after.QuantityAvailable));
        Add("cityId", before.CityId, after.CityId);
        Add("area", before.Area, after.Area);
        Add("deliveryAvailable", Flag(before.DeliveryAvailable), Flag(after.DeliveryAvailable));
        Add("deliveryAreas", before.DeliveryAreas, after.DeliveryAreas);
        Add("plantingAvailable", Flag(before.PlantingAvailable), Flag(after.PlantingAvailable));
        Add("serviceCityIds", List(before.ServiceCityIds), List(after.ServiceCityIds));
        Add("contactName", before.ContactName, after.ContactName);
        Add("contactPhone", before.ContactPhone, after.ContactPhone);
        Add("whatsapp", Flag(before.Whatsapp), Flag(after.Whatsapp));
        Add("phoneHidden", Flag(before.PhoneHidden), Flag(after.PhoneHidden));

        // The form's other values («Qablaşdırma», «Təcrübə», …), by key; the ones above already have their own line.
        foreach (var key in before.Attributes.Keys.Union(after.Attributes.Keys).Where(k => !Covered.Contains(k)).Order(StringComparer.Ordinal))
        {
            Add($"attributes.{key}", before.Attributes.GetValueOrDefault(key), after.Attributes.GetValueOrDefault(key));
        }

        // Photos: how many were added and removed, or that the order (the cover) changed.
        var added = after.PhotoIds.Except(before.PhotoIds).Count();
        var removed = before.PhotoIds.Except(after.PhotoIds).Count();
        if (added > 0 || removed > 0)
        {
            changes.Add(new FieldChange("photos", Number(before.PhotoIds.Count), Number(after.PhotoIds.Count)));
        }
        else if (!before.PhotoIds.SequenceEqual(after.PhotoIds))
        {
            changes.Add(new FieldChange("photos.order"));
        }

        return changes;
    }

    /// <summary>Attribute ids whose value is compared as a column above (the wizard sends both forms).</summary>
    private static readonly HashSet<string> Covered = new(StringComparer.Ordinal)
    {
        "species", "heightMin", "heightMax", "age", "rootSystem", "potLitres", "sun", "water", "frost", "foliage",
        "plantingMonths", "availability", "areas",
    };

    private static string? Height(ListingContent c) => c.HeightMinCm is { } min
        ? c.HeightMaxCm is { } max ? $"{Number(min)}–{Number(max)}" : Number(min)
        : null;

    private static string? Wholesale(ListingContent c) =>
        c.WholesalePrice is { } price ? $"{Number(price)} / {Number(c.WholesaleMinQty)}" : null;

    private static string Flag(bool value) => value ? "true" : "false";

    private static string? Code<TEnum>(TEnum? value)
        where TEnum : struct, Enum => value is { } v ? KebabCase.Value(v) : null;

    private static string Code<TEnum>(TEnum value)
        where TEnum : struct, Enum => KebabCase.Value(value);

    private static string? Number(int? value) => value?.ToString(CultureInfo.InvariantCulture);

    private static string? Number(short? value) => value?.ToString(CultureInfo.InvariantCulture);

    private static string? Number(decimal? value) => value is { } v ? Money.Trim(v).ToString(CultureInfo.InvariantCulture) : null;

    private static string? List(IEnumerable<string?>? values)
    {
        var list = values?.OfType<string>().ToList();
        return list is { Count: > 0 } ? string.Join(",", list) : null;
    }
}
