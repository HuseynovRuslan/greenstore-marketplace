using System.Text.Json;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Taxonomy;
using GreenStore.Api.Tests.Engagement;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Admin;

/// <summary>«Kateqoriya idarəetməsi»: two levels, names in three languages, form-bound filters, without a database.</summary>
public sealed class CategoryAdminRulesTests
{
    private static readonly Category Trees = new()
    {
        Id = "agaclar",
        Kind = CategoryKind.Product,
        Form = CategoryForm.Plant,
        Icon = "trees",
        Name = new LocalizedText("Ağaclar", "Деревья", "Trees"),
        Filters = [new CategoryFilter(CategoryFilters.RootSystem, true)],
        SortOrder = 10,
    };

    private static readonly Category FruitTrees = new()
    {
        Id = "agaclar-meyve",
        ParentId = "agaclar",
        Kind = CategoryKind.Product,
        Name = new LocalizedText("Meyvə ağacları"),
        SortOrder = 10,
    };

    private static readonly Category Services = new()
    {
        Id = "landsaft-xidmetleri",
        Kind = CategoryKind.Service,
        Form = CategoryForm.Service,
        Icon = "fence",
        Name = new LocalizedText("Landşaft xidmətləri"),
        SortOrder = 60,
    };

    private static readonly TaxonomySnapshot Taxonomy = new([Trees, FruitTrees, Services], []);

    private static CategoryCreateDto Root(Func<CategoryCreateDto, CategoryCreateDto>? edit = null)
    {
        var input = new CategoryCreateDto
        {
            Kind = "product",
            Form = "plant",
            Names = new LocalizedTextInput { Az = " Bağ dekoru ", Ru = "Садовый декор", En = "  " },
            Icon = "sprout",
            Filters = [new CategoryFilter(CategoryFilters.Height, true), new CategoryFilter(CategoryFilters.RootSystem, false)],
        };
        return edit is null ? input : edit(input);
    }

    [Fact]
    public void A_category_gets_an_id_from_its_name_and_the_next_place()
    {
        var (draft, errors) = CategoryAdminRules.ValidateCreate(Root(), Taxonomy);

        Assert.False(errors.Any);
        Assert.Equal("bag-dekoru", draft!.Id);
        Assert.Equal(new LocalizedText("Bağ dekoru", "Садовый декор"), draft.Name);
        Assert.Equal(CategoryForm.Plant, draft.Form);
        Assert.Equal(70, draft.SortOrder);
        Assert.True(draft.IsActive);
        Assert.Equal([CategoryFilters.Height, CategoryFilters.RootSystem], draft.Filters.Select(f => f.Id));
    }

    [Fact]
    public void A_sub_category_takes_its_parents_kind_and_has_no_form_icon_or_filters()
    {
        var (draft, errors) = CategoryAdminRules.ValidateCreate(
            new CategoryCreateDto { ParentId = "agaclar", Names = new LocalizedTextInput { Az = "Sərv ağacları" } },
            Taxonomy);

        Assert.False(errors.Any);
        Assert.Equal("serv-agaclari", draft!.Id);
        Assert.Equal(CategoryKind.Product, draft.Kind);
        Assert.Null(draft.Form);
        Assert.Null(draft.Icon);
        Assert.Empty(draft.Filters);
        Assert.Equal(20, draft.SortOrder);
    }

    public static TheoryData<string, string, string> BadCategories() => new()
    {
        { """{"form":"plant","names":{"az":"X"},"icon":"sprout"}""", "kind", FieldErrors.Required },
        { """{"kind":"product","names":{"az":"X"},"icon":"sprout"}""", "form", FieldErrors.Required },
        { """{"kind":"service","form":"plant","names":{"az":"X"},"icon":"sprout"}""", "form", FieldErrors.Invalid },
        { """{"kind":"product","form":"service","names":{"az":"X"},"icon":"sprout"}""", "form", FieldErrors.Invalid },
        { """{"kind":"tool","form":"goods","names":{"az":"X"},"icon":"sprout"}""", "kind", FieldErrors.Invalid },
        { """{"kind":"product","form":"plant","names":{"ru":"Деревья"},"icon":"sprout"}""", "names.az", FieldErrors.Required },
        { """{"kind":"product","form":"plant","icon":"sprout"}""", "names.az", FieldErrors.Required },
        { """{"kind":"product","form":"plant","names":{"az":"AĞACLAR"},"icon":"sprout"}""", "names.az", AdminErrors.NameTaken },
        { $$"""{"kind":"product","form":"plant","names":{"az":"{{new string('a', 61)}}"},"icon":"sprout"}""", "names.az", FieldErrors.TooLong },
        { """{"kind":"product","form":"plant","names":{"az":"X"},"descriptions":{"en":"Only English"},"icon":"sprout"}""", "descriptions.az", FieldErrors.Required },
        { """{"kind":"product","form":"plant","names":{"az":"X"}}""", "icon", FieldErrors.Required },
        { """{"kind":"product","form":"plant","names":{"az":"X"},"icon":"rose"}""", "icon", FieldErrors.Invalid },
        { """{"kind":"product","form":"plant","names":{"az":"X"},"icon":"sprout","filters":[{"id":"serviceType","enabled":true}]}""", "filters", AdminErrors.NotAllowed },
        { """{"kind":"product","form":"goods","names":{"az":"X"},"icon":"sprout","filters":[{"id":"height","enabled":true}]}""", "filters", AdminErrors.NotAllowed },
        { """{"kind":"product","form":"plant","names":{"az":"X"},"icon":"sprout","filters":[{"id":"age","enabled":true},{"id":"age","enabled":false}]}""", "filters", AdminErrors.Duplicate },
        { """{"kind":"product","form":"plant","names":{"az":"X"},"icon":"sprout","sortOrder":-1}""", "sortOrder", AdminErrors.OutOfRange },
        { """{"id":"Bağ","kind":"product","form":"plant","names":{"az":"X"},"icon":"sprout"}""", "id", FieldErrors.Invalid },
        { """{"id":"agaclar-meyve","kind":"product","form":"plant","names":{"az":"X"},"icon":"sprout"}""", "id", AdminErrors.NameTaken },
        { """{"parentId":"yoxdur","names":{"az":"X"}}""", "parentId", FieldErrors.Invalid },
        { """{"parentId":"agaclar-meyve","names":{"az":"X"}}""", "parentId", FieldErrors.Invalid },
        { """{"parentId":"agaclar","kind":"service","names":{"az":"X"}}""", "kind", FieldErrors.Invalid },
        { """{"parentId":"agaclar","form":"plant","names":{"az":"X"}}""", "form", AdminErrors.NotAllowed },
        { """{"parentId":"agaclar","names":{"az":"X"},"icon":"trees"}""", "icon", AdminErrors.NotAllowed },
        { """{"parentId":"agaclar","names":{"az":"X"},"filters":[{"id":"age","enabled":true}]}""", "filters", AdminErrors.NotAllowed },
        { """{"parentId":"agaclar","names":{"az":"Meyve agaclari"}}""", "names.az", AdminErrors.NameTaken },
    };

    [Theory]
    [MemberData(nameof(BadCategories))]
    public void A_bad_category_names_its_field(string json, string field, string code)
    {
        var (draft, errors) = CategoryAdminRules.ValidateCreate(JsonSerializer.Deserialize<CategoryCreateDto>(json, JsonDefaults.Create())!, Taxonomy);

        Assert.Null(draft);
        Assert.Equal(code, ServiceRequestRulesTests.FirstErrors(errors)[field]);
    }

    [Fact]
    public void The_same_name_may_live_under_another_parent() =>
        Assert.NotNull(CategoryAdminRules.ValidateCreate(new CategoryCreateDto { ParentId = "landsaft-xidmetleri", Names = new LocalizedTextInput { Az = "Meyvə ağacları" } }, Taxonomy).Draft);

    [Fact]
    public void A_taken_id_gets_a_number()
    {
        Assert.Equal("agaclar-2", CategoryAdminRules.IdFor("Ağaclar", new HashSet<string> { "agaclar" }));
        Assert.Equal(CategoryAdminRules.FallbackId, CategoryAdminRules.IdFor("🌳", new HashSet<string>()));
        Assert.True(CategoryAdminRules.IdFor(new string('ə', 200), new HashSet<string>()).Length <= CategoryAdminRules.MaxIdLength);
    }

    [Fact]
    public void Forms_suit_their_kind()
    {
        Assert.True(CategoryAdminRules.FormSuits(CategoryKind.Service, CategoryForm.Service));
        Assert.All(new[] { CategoryForm.Plant, CategoryForm.Pack, CategoryForm.Goods, CategoryForm.Grass }, form =>
        {
            Assert.True(CategoryAdminRules.FormSuits(CategoryKind.Product, form));
            Assert.False(CategoryAdminRules.FormSuits(CategoryKind.Service, form));
        });
        Assert.False(CategoryAdminRules.FormSuits(CategoryKind.Product, CategoryForm.Service));
    }

    [Fact]
    public void The_icons_are_the_IconName_union_of_the_frontend() =>
        Assert.Equal(FrontendContract.Load().Unions["IconName"], CategoryAdminRules.Icons);

    private static CategoryPatchDto Patch(string json) => JsonSerializer.Deserialize<CategoryPatchDto>(json, JsonDefaults.Create())!;

    [Fact]
    public void A_patch_changes_what_it_sends_and_tells_when_the_name_changed()
    {
        var (change, errors) = CategoryAdminRules.ValidatePatch(Patch("""{"names":{"az":"Ağaclar","ru":"Деревья и саженцы","en":"Trees"},"sortOrder":15}"""), Trees, Taxonomy);

        Assert.False(errors.Any);
        Assert.True(change!.NameChanged);
        Assert.Equal("Деревья и саженцы", change.Name.Ru);
        Assert.Equal(15, change.SortOrder);
        Assert.Equal("trees", change.Icon);
        Assert.Equal(Trees.Filters, change.Filters);
        Assert.True(change.IsActive);
    }

    [Fact]
    public void A_patch_without_names_keeps_them_and_null_clears_the_description()
    {
        var withDescription = new Category { Id = "x", Kind = CategoryKind.Product, Form = CategoryForm.Goods, Icon = "shovel", Name = new LocalizedText("X"), Description = new LocalizedText("Təsvir") };
        var (change, _) = CategoryAdminRules.ValidatePatch(Patch("""{"descriptions":null,"isActive":false,"filters":[]}"""), withDescription, new TaxonomySnapshot([withDescription], []));

        Assert.False(change!.NameChanged);
        Assert.Null(change.Description);
        Assert.False(change.IsActive);
        Assert.Empty(change.Filters);
    }

    [Theory]
    [InlineData("""{"names":{"az":"  "}}""", "names.az", FieldErrors.Required)]
    [InlineData("""{"names":{"az":"Landşaft xidmətləri"}}""", "names.az", AdminErrors.NameTaken)]
    [InlineData("""{"icon":null}""", "icon", FieldErrors.Required)]
    [InlineData("""{"sortOrder":null}""", "sortOrder", FieldErrors.Required)]
    [InlineData("""{"isActive":null}""", "isActive", FieldErrors.Required)]
    [InlineData("""{"filters":[{"id":"area","enabled":true}]}""", "filters", AdminErrors.NotAllowed)]
    public void A_bad_patch_names_its_field(string json, string field, string code)
    {
        var (change, errors) = CategoryAdminRules.ValidatePatch(Patch(json), Trees, Taxonomy);

        Assert.Null(change);
        Assert.Equal(code, ServiceRequestRulesTests.FirstErrors(errors)[field]);
    }

    [Fact]
    public void A_category_keeps_its_own_name_and_a_sub_category_takes_no_icon()
    {
        Assert.False(CategoryAdminRules.ValidatePatch(Patch("""{"names":{"az":"ağaclar","ru":"Деревья","en":"Trees"}}"""), Trees, Taxonomy).Errors.Any);
        Assert.Equal(
            AdminErrors.NotAllowed,
            ServiceRequestRulesTests.FirstErrors(CategoryAdminRules.ValidatePatch(Patch("""{"icon":"trees"}"""), FruitTrees, Taxonomy).Errors)["icon"]);
    }

    [Fact]
    public void Every_form_lists_its_filters()
    {
        Assert.Equal([CategoryFilters.Species, CategoryFilters.Height, CategoryFilters.Age, CategoryFilters.RootSystem], CategoryFilters.For(CategoryForm.Plant));
        Assert.Equal([CategoryFilters.ServiceType, CategoryFilters.Area, CategoryFilters.PriceType], CategoryFilters.For(CategoryForm.Service));
        Assert.Empty(CategoryFilters.For(CategoryForm.Goods));
        Assert.Empty(CategoryFilters.For(null));
    }
}
