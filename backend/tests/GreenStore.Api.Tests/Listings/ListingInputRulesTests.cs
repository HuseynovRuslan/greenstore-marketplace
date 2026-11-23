using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Listings;

/// <summary>«Elan yerləşdir»'s rules on the API side (src/features/posting/validation.ts and the table's limits).</summary>
public sealed class ListingInputRulesTests
{
    private const string Photo = "019a8b4e-0000-7000-8000-000000000001";

    public static readonly TaxonomySnapshot Taxonomy = new(
        [
            new Category { Id = "agaclar", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Ağaclar"), Filters = [new CategoryFilter(CategoryFilters.RootSystem, true)] },
            new Category { Id = "agaclar-meyve", ParentId = "agaclar", Kind = CategoryKind.Product, Name = new LocalizedText("Meyvə ağacları") },
            new Category { Id = "agaclar-kohne", ParentId = "agaclar", Kind = CategoryKind.Product, Name = new LocalizedText("Köhnə"), IsActive = false },
            new Category { Id = "guller", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Güllər") },
            new Category { Id = "torpaq", Kind = CategoryKind.Product, Form = CategoryForm.Pack, Name = new LocalizedText("Torpaq") },
            new Category { Id = "aletler", Kind = CategoryKind.Product, Form = CategoryForm.Goods, Name = new LocalizedText("Alətlər") },
            new Category { Id = "kohne", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Köhnə"), IsActive = false },
            new Category { Id = "landsaft-xidmetleri", Kind = CategoryKind.Service, Form = CategoryForm.Service, Name = new LocalizedText("Bağ xidmətləri") },
            new Category { Id = "landsaft-dizayni", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Landşaft dizaynı") },
        ],
        [
            new City { Id = "baki", Name = new LocalizedText("Bakı") },
            new City { Id = "abseron", Name = new LocalizedText("Abşeron") },
            new City { Id = "kohne-seher", Name = new LocalizedText("Köhnə"), IsActive = false },
        ]);

    public static ListingInputDto Tree() => new()
    {
        Kind = CategoryKind.Product,
        CategoryId = "agaclar",
        Subcategory = "Meyvə ağacları",
        Title = "Alma tingi Golden — 150 sm",
        Description = "Sağlam, iki yaşlı alma tingləri. Dibçəkdə, əkinə hazırdır.",
        Attributes = new() { ["heightMin"] = "150", ["age"] = "2", ["rootSystem"] = "container", ["availability"] = "satisda", ["empty"] = "  " },
        Plant = new PlantInputDto { HeightCm = new HeightInputDto(150), AgeYears = 2, RootSystem = RootSystem.Container, PotLitres = 10, Sun = SunNeed.FullSun, PlantingMonths = [10, 3, 3] },
        PriceType = PriceType.Fixed,
        Price = 25,
        PriceUnit = PriceUnit.Piece,
        Wholesale = new WholesaleInputDto(20, 10),
        QuantityAvailable = 100,
        CityId = "baki",
        Area = "  Mərdəkan ",
        DeliveryAvailable = true,
        DeliveryAreas = "Bakı",
        ContactName = "Elvin Əliyev",
        ContactPhone = "+994 50 555 12 34",
        Whatsapp = true,
        PhotoIds = [Photo],
    };

    [Fact]
    public void A_complete_tree_becomes_its_columns()
    {
        var (content, errors) = ListingInputRules.Validate(Tree(), Taxonomy);

        Assert.False(errors.Any);
        Assert.NotNull(content);
        Assert.Equal(CategoryKind.Product, content.Kind);
        Assert.Equal("agaclar-meyve", content.SubcategoryId);
        Assert.Equal(150, content.HeightMinCm);
        Assert.Null(content.HeightMaxCm);
        Assert.Equal((short)2, content.AgeYears);
        Assert.Equal(RootSystem.Container, content.RootSystem);
        Assert.Equal(Availability.InStock, content.Availability);
        Assert.Equal(10m, content.Plant!.PotLitres);
        Assert.Equal([3, 10], content.Plant.PlantingMonths);
        Assert.Equal(20m, content.WholesalePrice);
        Assert.Equal(10, content.WholesaleMinQty);
        Assert.Equal("Mərdəkan", content.Area);
        Assert.Equal("+994505551234", content.ContactPhone);
        Assert.Equal([Guid.Parse(Photo)], content.PhotoIds);
        Assert.False(content.Attributes.ContainsKey("empty"));
    }

    [Fact]
    public void An_empty_form_names_every_missing_field()
    {
        var (content, errors) = ListingInputRules.Validate(new ListingInputDto(), Taxonomy);

        Assert.Null(content);
        var codes = Errors(errors);
        foreach (var field in new[] { "kind", "categoryId", "title", "description", "photoIds", "priceType", "cityId", "contactName", "contactPhone" })
        {
            Assert.Equal(FieldErrors.Required, codes[field]);
        }
    }

    [Theory]
    [InlineData("Alma", FieldErrors.TooShort)]
    [InlineData("    ", FieldErrors.Required)]
    public void The_title_has_the_wizard_limits(string title, string code) =>
        Assert.Equal(code, Errors(Validate(Tree() with { Title = title }))["title"]);

    [Fact]
    public void A_title_over_80_characters_is_too_long() =>
        Assert.Equal(FieldErrors.TooLong, Errors(Validate(Tree() with { Title = new string('a', 81) }))["title"]);

    [Theory]
    [InlineData("Qısa təsvir", FieldErrors.TooShort)]
    [InlineData("Zəng edin: 050 555 12 34, gec saatlarda da", ListingInputRules.ContainsPhone)]
    [InlineData("Zəng edin: +994505551234 nömrəsinə, hər gün", ListingInputRules.ContainsPhone)]
    public void The_description_is_long_enough_and_has_no_phone_number(string description, string code) =>
        Assert.Equal(code, Errors(Validate(Tree() with { Description = description }))["description"]);

    [Fact]
    public void Paragraphs_of_the_description_are_kept() =>
        Assert.Equal("Birinci abzas, uzun mətn.\n\nİkinci abzas.", Validate(Tree() with { Description = "Birinci abzas, uzun mətn.\r\n\r\nİkinci abzas.  " }).Content!.Description);

    [Theory]
    [InlineData("service", "agaclar", "categoryId", FieldErrors.Invalid)]
    [InlineData("product", "agaclar-meyve", "categoryId", FieldErrors.Invalid)]
    [InlineData("product", "kohne", "categoryId", FieldErrors.Invalid)]
    [InlineData("product", "yoxdur", "categoryId", FieldErrors.Invalid)]
    public void The_category_must_be_an_active_category_of_the_kind(string kind, string categoryId, string field, string code)
    {
        var input = Tree() with { Kind = kind == "service" ? CategoryKind.Service : CategoryKind.Product, CategoryId = categoryId };

        Assert.Equal(code, Errors(Validate(input))[field]);
    }

    [Fact]
    public void A_category_with_sub_categories_needs_one()
    {
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { Subcategory = null }))["subcategoryId"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { Subcategory = "Köhnə" }))["subcategory"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { SubcategoryId = "guller-movsumi" }))["subcategoryId"]);
        Assert.Equal("agaclar-meyve", Validate(Tree() with { Subcategory = null, SubcategoryId = "agaclar-meyve" }).Content!.SubcategoryId);
        // The wizard sends the name; letters and case aside, it matches.
        Assert.Equal("agaclar-meyve", Validate(Tree() with { Subcategory = "MEYVE AGACLARI" }).Content!.SubcategoryId);
    }

    [Fact]
    public void A_category_without_sub_categories_needs_none()
    {
        var input = Tree() with { CategoryId = "guller", Subcategory = null, Plant = new PlantInputDto { HeightCm = new HeightInputDto(30) } };

        Assert.False(Validate(input).Errors.Any);
    }

    [Fact]
    public void A_plant_needs_its_height_and_where_the_category_filters_by_it_its_root_system()
    {
        var codes = Errors(Validate(Tree() with { Plant = null }));
        Assert.Equal(FieldErrors.Required, codes["plant.heightCm.min"]);
        Assert.Equal(FieldErrors.Required, codes["plant.rootSystem"]);

        var flower = Tree() with { CategoryId = "guller", Subcategory = null, Plant = new PlantInputDto { HeightCm = new HeightInputDto(40) } };
        Assert.False(Validate(flower).Errors.Any);
    }

    [Theory]
    [InlineData(0, null, "plant.heightCm.min")]
    [InlineData(3001, null, "plant.heightCm.min")]
    [InlineData(150, 100, "plant.heightCm.max")]
    [InlineData(150, 3001, "plant.heightCm.max")]
    public void Heights_are_within_the_limits(int min, int? max, string field) =>
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { Plant = Tree().Plant! with { HeightCm = new HeightInputDto(min, max) } }))[field]);

    [Fact]
    public void Fractions_of_whole_number_facts_are_rounded_and_a_max_equal_to_the_min_is_dropped()
    {
        var content = Validate(Tree() with
        {
            Plant = Tree().Plant! with { HeightCm = new HeightInputDto(140.5m, 140.6m), AgeYears = 2.5m, FrostHardinessC = -14.6m },
        }).Content!;

        Assert.Equal(141, content.HeightMinCm);
        Assert.Null(content.HeightMaxCm);
        Assert.Equal((short)3, content.AgeYears);
        Assert.Equal(-15, content.Plant!.FrostHardinessC);
    }

    [Fact]
    public void The_pot_size_counts_only_for_a_container()
    {
        var content = Validate(Tree() with { Plant = Tree().Plant! with { RootSystem = RootSystem.Rootball } }).Content!;

        Assert.Null(content.Plant!.PotLitres);
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { Plant = Tree().Plant! with { PotLitres = 0.2m } }))["plant.potLitres"]);
    }

    [Theory]
    [InlineData(null, FieldErrors.Required)]
    [InlineData("bazarda", FieldErrors.Invalid)]
    public void Availability_is_one_of_the_wizard_choices(string? value, string code)
    {
        var attributes = new Dictionary<string, string>(Tree().Attributes!);
        attributes.Remove("availability");
        if (value is not null)
        {
            attributes["availability"] = value;
        }

        Assert.Equal(code, Errors(Validate(Tree() with { Attributes = attributes }))["attributes.availability"]);
    }

    [Fact]
    public void Sifarisle_is_on_order() =>
        Assert.Equal(Availability.OnOrder, Validate(Tree() with { Attributes = new() { ["availability"] = "sifarisle" } }).Content!.Availability);

    [Fact]
    public void Soil_needs_its_pack_and_tools_their_condition()
    {
        var soil = Tree() with { CategoryId = "torpaq", Subcategory = null, Plant = null, PriceUnit = PriceUnit.Bag, Wholesale = null, Attributes = new() { ["availability"] = "satisda" } };
        Assert.Equal(FieldErrors.Required, Errors(Validate(soil))["attributes.pack"]);

        var tool = soil with { CategoryId = "aletler", PriceUnit = PriceUnit.Piece, Attributes = new() { ["availability"] = "satisda", ["condition"] = "kohne" } };
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(tool))["attributes.condition"]);
    }

    [Fact]
    public void A_price_is_required_unless_by_agreement_and_then_none_is_kept()
    {
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { Price = null }))["price"]);
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { PriceUnit = null }))["priceUnit"]);
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { Price = 0 }))["price"]);
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { Price = 1_000_001 }))["price"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { Price = 2.555m }))["price"]);

        var agreed = Validate(Tree() with { PriceType = PriceType.Agreement, Price = 99, PriceUnit = null }).Content!;
        Assert.Null(agreed.Price);
        Assert.Null(agreed.PriceUnit);
        Assert.Null(agreed.WholesalePrice);
        Assert.Null(agreed.WholesaleMinQty);
    }

    [Fact]
    public void The_unit_is_one_the_category_offers()
    {
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { PriceUnit = PriceUnit.Hour }))["priceUnit"]);
        Assert.Equal([PriceUnit.Job, PriceUnit.Sqm, PriceUnit.Hour, PriceUnit.Piece], ListingInputRules.UnitsOf(CategoryForm.Service));
    }

    [Fact]
    public void A_wholesale_price_is_below_the_price_from_a_whole_quantity_of_two()
    {
        Assert.Equal(ListingInputRules.NotBelowPrice, Errors(Validate(Tree() with { Wholesale = new WholesaleInputDto(25, 10) }))["wholesale.price"]);
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { Wholesale = new WholesaleInputDto(20, 1) }))["wholesale.minQuantity"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { Wholesale = new WholesaleInputDto(20, 2.5m) }))["wholesale.minQuantity"]);
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { Wholesale = new WholesaleInputDto(null, 10) }))["wholesale.price"]);
    }

    [Fact]
    public void Quantity_place_and_delivery_have_their_limits()
    {
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { QuantityAvailable = 1.5m }))["quantityAvailable"]);
        Assert.Equal(ListingInputRules.OutOfRange, Errors(Validate(Tree() with { QuantityAvailable = 0 }))["quantityAvailable"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { CityId = "kohne-seher" }))["cityId"]);
        Assert.Equal(FieldErrors.TooLong, Errors(Validate(Tree() with { Area = new string('a', 81) }))["area"]);
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { DeliveryAreas = " " }))["deliveryAreas"]);
        Assert.Equal(FieldErrors.TooLong, Errors(Validate(Tree() with { DeliveryAreas = new string('a', 121) }))["deliveryAreas"]);
        Assert.Null(Validate(Tree() with { DeliveryAvailable = false, DeliveryAreas = "Bakı" }).Content!.DeliveryAreas);
    }

    [Theory]
    [InlineData("12345", FieldErrors.Invalid)]
    [InlineData("+7 900 123 45 67", FieldErrors.Invalid)]
    [InlineData("", FieldErrors.Required)]
    public void The_contact_number_is_an_azerbaijani_one(string phone, string code) =>
        Assert.Equal(code, Errors(Validate(Tree() with { ContactPhone = phone }))["contactPhone"]);

    [Fact]
    public void A_landline_is_a_valid_contact_number() =>
        Assert.Equal("+994124980000", Validate(Tree() with { ContactPhone = "(012) 498-00-00" }).Content!.ContactPhone);

    [Fact]
    public void A_hidden_number_needs_whatsapp() =>
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { PhoneHidden = true, Whatsapp = false }))["whatsapp"]);

    [Fact]
    public void The_contact_name_has_the_wizard_limits()
    {
        Assert.Equal(FieldErrors.TooShort, Errors(Validate(Tree() with { ContactName = "E" }))["contactName"]);
        Assert.Equal(FieldErrors.TooLong, Errors(Validate(Tree() with { ContactName = new string('a', 51) }))["contactName"]);
    }

    [Fact]
    public void Photos_are_one_to_twelve_distinct_ids()
    {
        Assert.Equal(FieldErrors.Required, Errors(Validate(Tree() with { PhotoIds = [] }))["photoIds"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { PhotoIds = ["ph_81f2"] }))["photoIds"]);
        Assert.Equal(ListingInputRules.Duplicate, Errors(Validate(Tree() with { PhotoIds = [Photo, Photo] }))["photoIds"]);
        var thirteen = Enumerable.Range(0, 13).Select(_ => Guid.NewGuid().ToString()).ToList();
        Assert.Equal(ListingInputRules.TooMany, Errors(Validate(Tree() with { PhotoIds = thirteen }))["photoIds"]);
    }

    [Fact]
    public void A_service_has_its_type_and_areas()
    {
        var service = new ListingInputDto
        {
            Kind = CategoryKind.Service,
            CategoryId = "landsaft-xidmetleri",
            Subcategory = "Landşaft dizaynı",
            Title = "Həyətyanı sahənin dizaynı",
            Description = "Layihə, bitki seçimi və əkin. Bakı və Abşeronda işləyirik.",
            Attributes = new() { ["areas"] = "baki,abseron,baki", ["experience"] = "8" },
            PriceType = PriceType.Fixed,
            Price = 350,
            PriceUnit = PriceUnit.Job,
            CityId = "baki",
            DeliveryAvailable = true,
            ContactName = "Nigar",
            ContactPhone = "0551234567",
            PhotoIds = [Photo],
        };

        var (content, errors) = ListingInputRules.Validate(service, Taxonomy);

        Assert.False(errors.Any, string.Join(", ", Errors(errors)));
        Assert.Equal("landsaft-dizayni", content!.SubcategoryId);
        Assert.Equal(["baki", "abseron"], content.ServiceCityIds);
        Assert.Null(content.DeliveryAreas);
        Assert.Null(content.HeightMinCm);
        Assert.Equal(FieldErrors.Required, Errors(Validate(service with { Attributes = [] }))["attributes.areas"]);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(service with { Attributes = new() { ["areas"] = "baki,mars" } }))["attributes.areas"]);
    }

    [Fact]
    public void An_edit_of_a_published_listing_keeps_its_category()
    {
        var locked = new LockedCategory(CategoryKind.Product, "agaclar", "agaclar-meyve");

        Assert.False(ListingInputRules.Validate(Tree(), Taxonomy, locked).Errors.Any);
        Assert.Equal("agaclar-meyve", ListingInputRules.Validate(Tree() with { CategoryId = null, Subcategory = null }, Taxonomy, locked).Content!.SubcategoryId);
        Assert.Equal(ListingInputRules.Locked, Errors(ListingInputRules.Validate(Tree() with { CategoryId = "guller", Subcategory = null }, Taxonomy, locked).Errors)["categoryId"]);
        Assert.Equal(ListingInputRules.Locked, Errors(ListingInputRules.Validate(Tree() with { SubcategoryId = "agaclar-kohne" }, Taxonomy, locked).Errors)["categoryId"]);
    }

    [Fact]
    public void A_locked_category_taken_off_the_site_still_takes_edits()
    {
        var locked = new LockedCategory(CategoryKind.Product, "kohne", null);

        Assert.False(ListingInputRules.Validate(Tree() with { CategoryId = "kohne", Subcategory = null }, Taxonomy, locked).Errors.Any);
    }

    [Fact]
    public void The_promotion_choice_is_kept_for_later()
    {
        var content = Validate(Tree() with { Promotion = new PromotionInputDto("one-cixar", "one-cixar-7") }).Content!;

        Assert.Equal(new PromotionChoice("one-cixar", "one-cixar-7"), content.Promotion);
        Assert.Equal(FieldErrors.Invalid, Errors(Validate(Tree() with { Promotion = new PromotionInputDto("one-cixar") }))["promotion"]);
    }

    private static (ListingContent? Content, FieldErrors Errors) Validate(ListingInputDto input) => ListingInputRules.Validate(input, Taxonomy);

    private static Dictionary<string, string> Errors((ListingContent? Content, FieldErrors Errors) result) => Errors(result.Errors);

    /// <summary>The first code of each field, as the 400 would carry it.</summary>
    private static Dictionary<string, string> Errors(FieldErrors errors)
    {
        try
        {
            errors.ThrowIfAny();
            return [];
        }
        catch (ApiProblemException problem)
        {
            return problem.Errors!.ToDictionary(e => e.Key, e => e.Value[0]);
        }
    }
}
