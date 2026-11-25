using System.Text.RegularExpressions;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// <c>ListingInput</c> of src/types: what «Elan yerləşdir» sends (<c>POST /listings</c>, <c>PUT /me/listings/{id}</c>).
/// Fields a form can leave empty are optional here and reported by <see cref="ListingInputRules"/> as <c>required</c>
/// (400 <c>validation</c>); only a body that is not this shape at all is a 400 <c>bad-request</c>. Numbers the
/// wizard types freely are decimals, so «140,5 sm» is a field error, not a broken body.
/// </summary>
public sealed record ListingInputDto
{
    public CategoryKind? Kind { get; init; }

    public string? CategoryId { get; init; }

    /// <summary>The sub-category id (backend-contract.md 1.3); preferred over <see cref="Subcategory"/>.</summary>
    public string? SubcategoryId { get; init; }

    /// <summary>The sub-category's (or service type's) Azerbaijani name, as the wizard sends it today.</summary>
    public string? Subcategory { get; init; }

    public string? Title { get; init; }

    public string? Description { get; init; }

    public Dictionary<string, string>? Attributes { get; init; }

    public PlantInputDto? Plant { get; init; }

    public PriceType? PriceType { get; init; }

    public decimal? Price { get; init; }

    public PriceUnit? PriceUnit { get; init; }

    public WholesaleInputDto? Wholesale { get; init; }

    public decimal? QuantityAvailable { get; init; }

    public string? CityId { get; init; }

    public string? Area { get; init; }

    public bool DeliveryAvailable { get; init; }

    public string? DeliveryAreas { get; init; }

    public bool PlantingAvailable { get; init; }

    public string? ContactName { get; init; }

    public string? ContactPhone { get; init; }

    public bool Whatsapp { get; init; }

    public bool PhoneHidden { get; init; }

    public IReadOnlyList<string>? PhotoIds { get; init; }

    public PromotionInputDto? Promotion { get; init; }

    /// <summary><c>PUT</c> only: the <c>version</c> the owner's copy had; a newer row answers 409 <c>concurrency-conflict</c>.</summary>
    public string? Version { get; init; }
}

/// <summary><c>PlantFacts</c> of src/types as sent.</summary>
public sealed record PlantInputDto
{
    public string? Species { get; init; }

    public HeightInputDto? HeightCm { get; init; }

    public decimal? AgeYears { get; init; }

    public RootSystem? RootSystem { get; init; }

    public decimal? PotLitres { get; init; }

    public SunNeed? Sun { get; init; }

    public WaterNeed? Water { get; init; }

    public decimal? FrostHardinessC { get; init; }

    public Foliage? Foliage { get; init; }

    public IReadOnlyList<int>? PlantingMonths { get; init; }
}

public sealed record HeightInputDto(decimal? Min = null, decimal? Max = null);

public sealed record WholesaleInputDto(decimal? Price = null, decimal? MinQuantity = null);

public sealed record PromotionInputDto(string? PackageId = null, string? OptionId = null);

/// <summary>
/// Checks a <see cref="ListingInputDto"/> with the wizard's own rules (src/features/posting/validation.ts) and the
/// table's limits, and turns it into <see cref="ListingContent"/>. Every bad field is reported at once, by its JSON
/// path (<c>plant.heightCm.min</c>, <c>wholesale.price</c>, <c>attributes.availability</c>). Photo ids are only
/// checked for shape here; whose they are is the service's question.
/// </summary>
public static partial class ListingInputRules
{
    public const int TitleMin = 5;
    public const int TitleMax = 80;
    public const int DescriptionMin = 20;
    public const int DescriptionMax = 3000;
    public const int ContactNameMin = 2;
    public const int ContactNameMax = 50;
    public const int AreaMax = 80;
    public const int DeliveryAreasMax = 120;
    public const int SpeciesMax = 60;
    public const decimal MaxPrice = 1_000_000m;
    public const int MaxQuantity = 10_000_000;
    public const int MaxWholesaleQuantity = 1_000_000;
    public const int HeightMinCm = 1;
    public const int HeightMaxCm = 3000;
    public const int AgeMax = 200;
    public const decimal PotMinLitres = 0.5m;
    public const decimal PotMaxLitres = 2000m;
    public const int FrostMin = -60;
    public const int FrostMax = 30;
    public const int AttributeCount = 30;
    public const int AttributeKeyMax = 40;
    public const int AttributeValueMax = 200;

    /* Field error codes besides FieldErrors' required, invalid, too-short, too-long */

    /// <summary>The description has a phone number in it: it belongs in the contact step.</summary>
    public const string ContainsPhone = "contains-phone";

    /// <summary>A number below or above its limits.</summary>
    public const string OutOfRange = "out-of-range";

    /// <summary>A wholesale price that is not below the retail price.</summary>
    public const string NotBelowPrice = "not-below-price";

    /// <summary>The category of a published listing cannot change.</summary>
    public const string Locked = "locked";

    /// <summary>The same photo twice.</summary>
    public const string Duplicate = "duplicate";

    public const string TooMany = "too-many";

    /// <summary>«Satışdadır» / «Sifarişlə» as the wizard sends them (src/features/home/heroSearch.ts).</summary>
    private static readonly Dictionary<string, Availability> AvailabilityValues = new(StringComparer.Ordinal)
    {
        ["satisda"] = Listings.Availability.InStock,
        ["sifarisle"] = Listings.Availability.OnOrder,
        ["in-stock"] = Listings.Availability.InStock,
        ["on-order"] = Listings.Availability.OnOrder,
    };

    /// <summary>A phone number typed into the text: 9 or more digits in a row, spaces and dashes allowed (validation.ts).</summary>
    [GeneratedRegex(@"(?:\+?\d[\s-]?){9,}", RegexOptions.CultureInvariant)]
    private static partial Regex PhoneInText();

    /// <summary>
    /// The checked content, or the field errors. <paramref name="locked"/> is the published listing's category when
    /// an edit may not change it.
    /// </summary>
    public static (ListingContent? Content, FieldErrors Errors) Validate(ListingInputDto input, TaxonomySnapshot taxonomy, LockedCategory? locked = null)
    {
        var errors = new FieldErrors();

        /* Step 1: what it is */
        var kind = input.Kind;
        Category? category = null;
        Category? subcategory = null;
        if (locked is not null)
        {
            // An edit of a published listing keeps its category, even one taken off the site since; naming another
            // one is refused. The wizard locks it too and sends the same values.
            category = taxonomy.Category(locked.CategoryId);
            subcategory = taxonomy.Category(locked.SubcategoryId);
            var otherSub = Clean(input.SubcategoryId) is { } sentId
                ? sentId != locked.SubcategoryId
                : Clean(input.Subcategory) is { } sentName && !SameName(subcategory, sentName);
            if ((kind is { } sentKind && sentKind != locked.Kind)
                || (Clean(input.CategoryId) is { } sentCategory && sentCategory != locked.CategoryId)
                || otherSub)
            {
                errors.Add("categoryId", Locked);
            }

            kind = locked.Kind;
        }
        else
        {
            var categoryId = Clean(input.CategoryId);
            if (kind is null)
            {
                errors.Add("kind", FieldErrors.Required);
            }

            if (categoryId is null)
            {
                errors.Add("categoryId", FieldErrors.Required);
            }
            else
            {
                category = taxonomy.Category(categoryId);
                if (category is null || category.ParentId is not null || !category.IsActive || (kind is { } k && category.Kind != k))
                {
                    errors.Add("categoryId", FieldErrors.Invalid);
                    category = null;
                }
            }

            if (category is not null)
            {
                var children = taxonomy.Categories.Where(c => c.ParentId == category.Id && c.IsActive).ToList();
                var subId = Clean(input.SubcategoryId);
                var subName = Clean(input.Subcategory);
                if (subId is not null)
                {
                    subcategory = children.FirstOrDefault(c => c.Id == subId);
                    errors.Add("subcategoryId", subcategory is null ? FieldErrors.Invalid : null);
                }
                else if (subName is not null)
                {
                    subcategory = children.FirstOrDefault(c => SameName(c, subName));
                    errors.Add("subcategory", subcategory is null ? FieldErrors.Invalid : null);
                }
                else if (children.Count > 0)
                {
                    errors.Add("subcategoryId", FieldErrors.Required);
                }
            }
        }

        var categoryIdValue = category?.Id;
        var form = category?.Form;
        var isService = kind == CategoryKind.Service;

        /* Step 2: title, description, attributes */
        var title = Clean(input.Title);
        errors.Add("title", Length(title, TitleMin, TitleMax));

        var description = Clean(input.Description);
        errors.Add("description", Length(description, DescriptionMin, DescriptionMax)
            ?? (description is not null && PhoneInText().IsMatch(description) ? ContainsPhone : null));

        var attributes = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, value) in input.Attributes ?? [])
        {
            var text = value?.Trim() ?? string.Empty;
            if (text.Length == 0)
            {
                continue;
            }

            if (key.Length is 0 or > AttributeKeyMax || text.Length > AttributeValueMax)
            {
                errors.Add($"attributes.{key}", FieldErrors.Invalid);
                continue;
            }

            attributes[key] = text;
        }

        if (attributes.Count > AttributeCount)
        {
            errors.Add("attributes", TooMany);
        }

        var plant = form == CategoryForm.Plant ? PlantFacts(input.Plant, taxonomy, categoryIdValue, errors) : null;
        Availability? availability = null;
        if (form is CategoryForm.Plant or CategoryForm.Pack or CategoryForm.Goods or CategoryForm.Grass)
        {
            if (!attributes.TryGetValue("availability", out var raw))
            {
                errors.Add("attributes.availability", FieldErrors.Required);
            }
            else if (AvailabilityValues.TryGetValue(raw, out var found))
            {
                availability = found;
            }
            else
            {
                errors.Add("attributes.availability", FieldErrors.Invalid);
            }
        }

        if (form == CategoryForm.Pack)
        {
            errors.Add("attributes.pack", attributes.ContainsKey("pack") ? null : FieldErrors.Required);
        }

        if (form == CategoryForm.Goods)
        {
            errors.Add("attributes.condition", attributes.GetValueOrDefault("condition") switch
            {
                null => FieldErrors.Required,
                "new" or "used" => null,
                _ => FieldErrors.Invalid,
            });
        }

        var serviceCities = new List<string>();
        if (isService)
        {
            var areas = attributes.GetValueOrDefault("areas")?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) ?? [];
            serviceCities = areas.Distinct(StringComparer.Ordinal).ToList();
            if (serviceCities.Count == 0)
            {
                errors.Add("attributes.areas", FieldErrors.Required);
            }
            else if (serviceCities.Any(id => taxonomy.City(id) is not { IsActive: true }))
            {
                errors.Add("attributes.areas", FieldErrors.Invalid);
            }
        }

        /* Step 3: photos */
        var photoIds = new List<Guid>();
        var photos = input.PhotoIds ?? [];
        if (photos.Count == 0)
        {
            errors.Add("photoIds", FieldErrors.Required);
        }
        else if (photos.Count > ListingPhoto.MaxPhotos)
        {
            errors.Add("photoIds", TooMany);
        }
        else
        {
            foreach (var raw in photos)
            {
                if (!Guid.TryParse(raw, out var id))
                {
                    errors.Add("photoIds", FieldErrors.Invalid);
                    break;
                }

                if (photoIds.Contains(id))
                {
                    errors.Add("photoIds", Duplicate);
                    break;
                }

                photoIds.Add(id);
            }
        }

        /* Step 4: price and place */
        var priceType = input.PriceType;
        decimal? price = null;
        PriceUnit? unit = null;
        decimal? wholesalePrice = null;
        int? wholesaleMin = null;
        if (priceType is null)
        {
            errors.Add("priceType", FieldErrors.Required);
        }
        else if (priceType != Listings.PriceType.Agreement)
        {
            price = input.Price;
            errors.Add("price", price is null ? FieldErrors.Required : InRange(price.Value, 0.01m, MaxPrice) ? Decimals(price.Value) : OutOfRange);
            unit = input.PriceUnit;
            errors.Add("priceUnit", unit is null ? FieldErrors.Required : UnitsOf(form).Contains(unit.Value) ? null : FieldErrors.Invalid);
            if (input.Wholesale is { } wholesale)
            {
                wholesalePrice = wholesale.Price;
                errors.Add("wholesale.price", wholesalePrice switch
                {
                    null => FieldErrors.Required,
                    { } w when !InRange(w, 0.01m, MaxPrice) => OutOfRange,
                    { } w when price is { } retail && w >= retail => NotBelowPrice,
                    { } w => Decimals(w),
                });
                wholesaleMin = WholeNumber(wholesale.MinQuantity, 2, MaxWholesaleQuantity, "wholesale.minQuantity", errors, required: true);
            }
        }

        var quantity = WholeNumber(input.QuantityAvailable, 1, MaxQuantity, "quantityAvailable", errors, required: false);

        var cityId = Clean(input.CityId);
        if (cityId is null)
        {
            errors.Add("cityId", FieldErrors.Required);
        }
        else if (taxonomy.City(cityId) is not { IsActive: true })
        {
            errors.Add("cityId", FieldErrors.Invalid);
        }

        var area = Clean(input.Area);
        errors.Add("area", area is { Length: > AreaMax } ? FieldErrors.TooLong : null);

        var delivery = input.DeliveryAvailable;
        var deliveryAreas = delivery ? Clean(input.DeliveryAreas) : null;
        if (delivery && !isService && deliveryAreas is null)
        {
            errors.Add("deliveryAreas", FieldErrors.Required);
        }

        errors.Add("deliveryAreas", deliveryAreas is { Length: > DeliveryAreasMax } ? FieldErrors.TooLong : null);

        /* Step 5: contact */
        var contactName = Clean(input.ContactName);
        errors.Add("contactName", Length(contactName, ContactNameMin, ContactNameMax) ?? (PersonNames.IsValid(contactName) ? null : FieldErrors.Invalid));
        var phone = PhoneNumbers.Normalize(input.ContactPhone);
        errors.Add("contactPhone", string.IsNullOrWhiteSpace(input.ContactPhone) ? FieldErrors.Required : phone is null ? FieldErrors.Invalid : null);
        if (input.PhoneHidden && !input.Whatsapp)
        {
            // A hidden number leaves buyers WhatsApp only.
            errors.Add("whatsapp", FieldErrors.Required);
        }

        PromotionChoice? promotion = null;
        if (input.Promotion is { } chosen)
        {
            var package = Clean(chosen.PackageId);
            var option = Clean(chosen.OptionId);
            if (package is null || option is null || package.Length > 40 || option.Length > 40)
            {
                errors.Add("promotion", FieldErrors.Invalid);
            }
            else
            {
                promotion = new PromotionChoice(package, option);
            }
        }

        if (errors.Any)
        {
            return (null, errors);
        }

        var content = new ListingContent
        {
            Kind = kind!.Value,
            CategoryId = category!.Id,
            SubcategoryId = subcategory?.Id,
            Title = title!,
            Description = description!,
            Attributes = attributes,
            Species = plant?.Species,
            HeightMinCm = plant?.HeightMin,
            HeightMaxCm = plant?.HeightMax,
            AgeYears = plant?.Age,
            RootSystem = plant?.Root,
            Plant = plant?.Details,
            Availability = availability,
            PriceType = priceType!.Value,
            Price = price,
            PriceUnit = unit,
            WholesalePrice = wholesalePrice,
            WholesaleMinQty = wholesalePrice is null ? null : wholesaleMin,
            QuantityAvailable = quantity,
            CityId = cityId!,
            Area = area,
            DeliveryAvailable = delivery,
            DeliveryAreas = deliveryAreas,
            PlantingAvailable = input.PlantingAvailable,
            ContactName = contactName!,
            ContactPhone = phone!,
            Whatsapp = input.Whatsapp,
            PhoneHidden = input.PhoneHidden,
            ServiceCityIds = serviceCities,
            PhotoIds = photoIds,
            Promotion = promotion,
        };
        return (content, errors);
    }

    /// <summary>The price units a form offers (<c>formUnits</c> in src/features/posting/attributes.ts).</summary>
    public static IReadOnlyList<PriceUnit> UnitsOf(CategoryForm? form) => form switch
    {
        CategoryForm.Service => [Listings.PriceUnit.Job, Listings.PriceUnit.Sqm, Listings.PriceUnit.Hour, Listings.PriceUnit.Piece],
        CategoryForm.Plant => [Listings.PriceUnit.Piece, Listings.PriceUnit.Set],
        CategoryForm.Grass => [Listings.PriceUnit.Sqm, Listings.PriceUnit.Kg, Listings.PriceUnit.Bag],
        CategoryForm.Pack => [Listings.PriceUnit.Bag, Listings.PriceUnit.Kg, Listings.PriceUnit.Litre],
        _ => [Listings.PriceUnit.Piece, Listings.PriceUnit.Set, Listings.PriceUnit.Metre],
    };

    private sealed record PlantResult(string? Species, int? HeightMin, int? HeightMax, short? Age, RootSystem? Root, PlantDetails? Details);

    private static PlantResult PlantFacts(PlantInputDto? plant, TaxonomySnapshot taxonomy, string? categoryId, FieldErrors errors)
    {
        var species = Clean(plant?.Species);
        errors.Add("plant.species", species is { Length: > SpeciesMax } ? FieldErrors.TooLong : null);

        // Heights and ages are whole numbers in the table; the wizard does not insist, so a fraction is rounded.
        int? heightMin = null;
        int? heightMax = null;
        if (plant?.HeightCm?.Min is not { } min)
        {
            errors.Add("plant.heightCm.min", FieldErrors.Required);
        }
        else if (!InRange(min, HeightMinCm, HeightMaxCm))
        {
            errors.Add("plant.heightCm.min", OutOfRange);
        }
        else
        {
            heightMin = Round(min);
        }

        if (plant?.HeightCm?.Max is { } max)
        {
            if (!InRange(max, HeightMinCm, HeightMaxCm))
            {
                errors.Add("plant.heightCm.max", OutOfRange);
            }
            else if (heightMin is { } low && Round(max) < low)
            {
                errors.Add("plant.heightCm.max", OutOfRange);
            }
            else
            {
                heightMax = Round(max) == heightMin ? null : Round(max);
            }
        }

        short? age = null;
        if (plant?.AgeYears is { } years)
        {
            if (InRange(years, 0, AgeMax))
            {
                age = (short)Round(years);
            }
            else
            {
                errors.Add("plant.ageYears", OutOfRange);
            }
        }

        var root = plant?.RootSystem;
        if (root is null && categoryId is not null && taxonomy.HasFilter(categoryId, CategoryFilters.RootSystem))
        {
            // «Kök sistemi» is a filter of this category, so every listing in it must say.
            errors.Add("plant.rootSystem", FieldErrors.Required);
        }

        decimal? pot = null;
        if (root == Listings.RootSystem.Container && plant?.PotLitres is { } litres)
        {
            if (InRange(litres, PotMinLitres, PotMaxLitres))
            {
                pot = Math.Round(litres, 1, MidpointRounding.AwayFromZero);
            }
            else
            {
                errors.Add("plant.potLitres", OutOfRange);
            }
        }

        int? frost = null;
        if (plant?.FrostHardinessC is { } degrees)
        {
            if (InRange(degrees, FrostMin, FrostMax))
            {
                frost = Round(degrees);
            }
            else
            {
                errors.Add("plant.frostHardinessC", OutOfRange);
            }
        }

        var months = plant?.PlantingMonths ?? [];
        if (months.Any(m => m is < 1 or > 12))
        {
            errors.Add("plant.plantingMonths", OutOfRange);
        }

        var distinctMonths = months.Where(m => m is >= 1 and <= 12).Distinct().Order().ToList();
        var details = new PlantDetails
        {
            PotLitres = pot,
            Sun = plant?.Sun,
            Water = plant?.Water,
            FrostHardinessC = frost,
            Foliage = plant?.Foliage,
            PlantingMonths = distinctMonths.Count > 0 ? distinctMonths : null,
        };
        var empty = details is { PotLitres: null, Sun: null, Water: null, FrostHardinessC: null, Foliage: null, PlantingMonths: null };
        return new PlantResult(species, heightMin, heightMax, age, root, empty ? null : details);
    }

    private static int? WholeNumber(decimal? value, int min, int max, string field, FieldErrors errors, bool required)
    {
        if (value is not { } number)
        {
            errors.Add(field, required ? FieldErrors.Required : null);
            return null;
        }

        if (number != decimal.Truncate(number))
        {
            errors.Add(field, FieldErrors.Invalid);
            return null;
        }

        if (!InRange(number, min, max))
        {
            errors.Add(field, OutOfRange);
            return null;
        }

        return (int)number;
    }

    /// <summary>Prices have at most two decimals (<c>numeric(10,2)</c>).</summary>
    private static string? Decimals(decimal value) => decimal.Round(value, 2) == value ? null : FieldErrors.Invalid;

    private static bool InRange(decimal value, decimal min, decimal max) => value >= min && value <= max;

    private static int Round(decimal value) => (int)Math.Round(value, MidpointRounding.AwayFromZero);

    private static string? Length(string? value, int min, int max) => value switch
    {
        null => FieldErrors.Required,
        { Length: var n } when n < min => FieldErrors.TooShort,
        { Length: var n } when n > max => FieldErrors.TooLong,
        _ => null,
    };

    /// <summary>Trimmed; null when empty. Line breaks inside are kept (the description's paragraphs).</summary>
    private static string? Clean(string? value)
    {
        var text = value?.Replace("\r\n", "\n", StringComparison.Ordinal).Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    /// <summary>A sub-category named as the wizard names it: its Azerbaijani name (letters and case aside).</summary>
    private static bool SameName(Category? category, string name) =>
        category is not null && SearchText.Normalize(category.Name.Az) == SearchText.Normalize(name);
}

/// <summary>The category of a published listing, which an edit keeps (<see cref="ListingLifecycle.CategoryLocked"/>).</summary>
public sealed record LockedCategory(CategoryKind Kind, string CategoryId, string? SubcategoryId);
