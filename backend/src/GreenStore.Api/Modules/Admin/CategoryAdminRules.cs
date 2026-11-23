using System.Text.RegularExpressions;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Admin;

/// <summary>A name in the three languages as an admin form sends it: blanks are «not written».</summary>
public sealed record LocalizedTextInput
{
    public string? Az { get; init; }

    public string? Ru { get; init; }

    public string? En { get; init; }
}

/// <summary><c>POST /admin/categories</c>: a category, or with <c>parentId</c> a sub-category.</summary>
public sealed record CategoryCreateDto
{
    /// <summary>The URL id (<c>agaclar</c>); made from the Azerbaijani name when not given.</summary>
    public string? Id { get; init; }

    public string? ParentId { get; init; }

    /// <summary><c>product</c> or <c>service</c>; a sub-category takes its parent's.</summary>
    public string? Kind { get; init; }

    /// <summary>The «Elan yerləşdir» form (<c>plant</c>, <c>pack</c>, <c>goods</c>, <c>grass</c>, <c>service</c>): categories only.</summary>
    public string? Form { get; init; }

    public LocalizedTextInput? Names { get; init; }

    public LocalizedTextInput? Descriptions { get; init; }

    /// <summary>An <c>IconName</c> of src/types: categories only.</summary>
    public string? Icon { get; init; }

    public IReadOnlyList<CategoryFilter>? Filters { get; init; }

    public int? SortOrder { get; init; }

    public bool? IsActive { get; init; }
}

/// <summary>
/// <c>PATCH /admin/categories/{id}</c>: what is sent changes. <c>descriptions: null</c> removes the description. The
/// id, the kind, the form and the parent never change (listings and URLs depend on them).
/// </summary>
public sealed class CategoryPatchDto : PatchBody
{
    public LocalizedTextInput? Names { get; set => field = Sent(value); }

    public LocalizedTextInput? Descriptions { get; set => field = Sent(value); }

    public string? Icon { get; set => field = Sent(value); }

    public IReadOnlyList<CategoryFilter>? Filters { get; set => field = Sent(value); }

    public int? SortOrder { get; set => field = Sent(value); }

    public bool? IsActive { get; set => field = Sent(value); }

    /// <summary>The <c>version</c> the admin saw: a stale one answers 409 <c>concurrency-conflict</c>.</summary>
    public string? Version { get; set => field = Sent(value); }
}

/// <summary>A new category that passed the rules.</summary>
public sealed record CategoryDraft
{
    public required string Id { get; init; }

    public string? ParentId { get; init; }

    public CategoryKind Kind { get; init; }

    public CategoryForm? Form { get; init; }

    public required LocalizedText Name { get; init; }

    public LocalizedText? Description { get; init; }

    public string? Icon { get; init; }

    public required IReadOnlyList<CategoryFilter> Filters { get; init; }

    public int SortOrder { get; init; }

    public bool IsActive { get; init; }
}

/// <summary>A change that passed the rules: the category's fields after it.</summary>
public sealed record CategoryChange
{
    public required LocalizedText Name { get; init; }

    public LocalizedText? Description { get; init; }

    public string? Icon { get; init; }

    public required IReadOnlyList<CategoryFilter> Filters { get; init; }

    public int SortOrder { get; init; }

    public bool IsActive { get; init; }

    /// <summary>The name changed in some language: the search text of its listings is built again (DATABASE.md §4).</summary>
    public bool NameChanged { get; init; }
}

/// <summary>
/// The rules of «Kateqoriya idarəetməsi» (ARCHITECTURE.md §8.1: system names in three languages, written by the admin),
/// without ASP.NET or EF: two levels, a category's form decides its filters, sub-categories take their parent's kind
/// and form and have no icon or filters, and the Azerbaijani name is required and unique under one parent.
/// </summary>
public static partial class CategoryAdminRules
{
    public const int MaxIdLength = 80;

    public const int MaxNameLength = 60;

    public const int MaxDescriptionLength = 200;

    public const int MaxSortOrder = 100_000;

    /// <summary>For a name with nothing left in ASCII.</summary>
    public const string FallbackId = "kateqoriya";

    /// <summary>The <c>IconName</c> union of src/types (lucide icons of the category cards).</summary>
    public static readonly IReadOnlyList<string> Icons =
    [
        "trees", "shrub", "flower-2", "flower", "grape", "clover", "sprout", "wheat", "shovel", "amphora", "droplets", "scissors", "fence",
    ];

    /// <summary>
    /// A new category, or the field errors: <c>id</c> (<c>invalid</c>, <c>taken</c>), <c>parentId</c>
    /// (<c>invalid</c>: not a category of the first level), <c>kind</c>, <c>form</c> (required on a category, must suit
    /// the kind: services have the <c>service</c> form; <c>not-allowed</c> on a sub-category, which takes its parent's),
    /// <c>names.az</c> (<c>required</c>, <c>too-long</c>, <c>taken</c>), <c>names.ru</c>, <c>names.en</c>,
    /// <c>descriptions.*</c>, <c>icon</c> (required on a category), <c>filters</c>, <c>sortOrder</c>.
    /// </summary>
    public static (CategoryDraft? Draft, FieldErrors Errors) ValidateCreate(CategoryCreateDto input, TaxonomySnapshot taxonomy)
    {
        var errors = new FieldErrors();
        Category? parent = null;
        var parentId = Clean(input.ParentId);
        if (parentId is not null)
        {
            parent = taxonomy.Category(parentId);
            errors.Add("parentId", parent is null || parent.ParentId is not null ? FieldErrors.Invalid : null);
        }

        var isSub = parentId is not null;
        CategoryKind? kind = parent?.Kind;
        CategoryForm? form = null;
        var kindText = Clean(input.Kind);
        var formText = Clean(input.Form);
        if (kindText is not null)
        {
            if (!KebabCase.TryParse<CategoryKind>(kindText, out var parsed))
            {
                errors.Add("kind", FieldErrors.Invalid);
            }
            else if (parent is not null && parsed != parent.Kind)
            {
                errors.Add("kind", FieldErrors.Invalid);
            }
            else
            {
                kind = parsed;
            }
        }
        else if (!isSub)
        {
            errors.Add("kind", FieldErrors.Required);
        }

        if (isSub)
        {
            errors.Add("form", formText is not null ? AdminErrors.NotAllowed : null);
        }
        else if (formText is null)
        {
            errors.Add("form", FieldErrors.Required);
        }
        else if (!KebabCase.TryParse<CategoryForm>(formText, out var parsedForm) || (kind is { } k && !FormSuits(k, parsedForm)))
        {
            errors.Add("form", FieldErrors.Invalid);
        }
        else
        {
            form = parsedForm;
        }

        var name = Names(input.Names, "names", errors, MaxNameLength, required: true);
        if (name is not null && SiblingHasName(taxonomy, parentId, name.Az, exceptId: null))
        {
            errors.Add("names.az", AdminErrors.NameTaken);
        }

        var description = Names(input.Descriptions, "descriptions", errors, MaxDescriptionLength, required: false);
        var icon = Icon(input.Icon, isSub, errors, required: !isSub);
        var filters = Filters(input.Filters, isSub ? null : form, isSub, errors);
        errors.Add("sortOrder", input.SortOrder is < 0 or > MaxSortOrder ? AdminErrors.OutOfRange : null);

        string? id = Clean(input.Id);
        if (id is not null)
        {
            if (!IdShape().IsMatch(id))
            {
                errors.Add("id", FieldErrors.Invalid);
            }
            else if (taxonomy.Category(id) is not null)
            {
                errors.Add("id", AdminErrors.NameTaken);
            }
        }
        else if (name is not null)
        {
            id = IdFor(name.Az, taxonomy.Categories.Select(c => c.Id).ToHashSet(StringComparer.Ordinal));
        }

        if (errors.Any || kind is null || name is null || id is null || (!isSub && form is null))
        {
            return (null, errors);
        }

        var siblings = taxonomy.Categories.Where(c => c.ParentId == parentId).ToList();
        return (new CategoryDraft
        {
            Id = id,
            ParentId = parentId,
            Kind = kind.Value,
            Form = isSub ? null : form,
            Name = name,
            Description = description,
            Icon = icon,
            Filters = filters ?? [],
            SortOrder = input.SortOrder ?? (siblings.Count == 0 ? 10 : siblings.Max(c => c.SortOrder) + 10),
            IsActive = input.IsActive ?? true,
        }, errors);
    }

    /// <summary>The category after <paramref name="patch"/>, or the field errors (the same ones as <see cref="ValidateCreate"/>).</summary>
    public static (CategoryChange? Change, FieldErrors Errors) ValidatePatch(CategoryPatchDto patch, Category category, TaxonomySnapshot taxonomy)
    {
        var errors = new FieldErrors();
        var isSub = category.ParentId is not null;

        var name = category.Name;
        if (patch.Has(nameof(CategoryPatchDto.Names)))
        {
            name = Names(patch.Names, "names", errors, MaxNameLength, required: true) ?? category.Name;
            if (!errors.Any && SiblingHasName(taxonomy, category.ParentId, name.Az, exceptId: category.Id))
            {
                errors.Add("names.az", AdminErrors.NameTaken);
            }
        }

        var description = patch.Has(nameof(CategoryPatchDto.Descriptions))
            ? Names(patch.Descriptions, "descriptions", errors, MaxDescriptionLength, required: false)
            : category.Description;
        var icon = patch.Has(nameof(CategoryPatchDto.Icon)) ? Icon(patch.Icon, isSub, errors, required: !isSub) : category.Icon;
        var filters = patch.Has(nameof(CategoryPatchDto.Filters))
            ? Filters(patch.Filters, category.Form, isSub, errors) ?? []
            : category.Filters;
        if (patch.Has(nameof(CategoryPatchDto.SortOrder)))
        {
            errors.Add("sortOrder", patch.SortOrder is null ? FieldErrors.Required : patch.SortOrder is < 0 or > MaxSortOrder ? AdminErrors.OutOfRange : null);
        }

        if (patch.Has(nameof(CategoryPatchDto.IsActive)))
        {
            errors.Add("isActive", patch.IsActive is null ? FieldErrors.Required : null);
        }

        if (errors.Any)
        {
            return (null, errors);
        }

        return (new CategoryChange
        {
            Name = name,
            Description = description,
            Icon = icon,
            Filters = filters,
            SortOrder = patch.Has(nameof(CategoryPatchDto.SortOrder)) ? patch.SortOrder!.Value : category.SortOrder,
            IsActive = patch.Has(nameof(CategoryPatchDto.IsActive)) ? patch.IsActive!.Value : category.IsActive,
            NameChanged = name != category.Name,
        }, errors);
    }

    /// <summary>Services are posted with the service form; products with one of the others.</summary>
    public static bool FormSuits(CategoryKind kind, CategoryForm form) =>
        kind == CategoryKind.Service ? form == CategoryForm.Service : form != CategoryForm.Service;

    /// <summary>
    /// An id from a name, as the admin page's <c>slugify</c> makes one («Bağ dekoru» → <c>bag-dekoru</c>), with
    /// <c>-2</c>, <c>-3</c>, … when <paramref name="taken"/> has it.
    /// </summary>
    public static string IdFor(string name, IReadOnlySet<string> taken)
    {
        var text = ListingSlug.Transliterate(name);
        if (text.Length > MaxIdLength - 4)
        {
            text = text[..(MaxIdLength - 4)].TrimEnd('-');
        }

        return SellerSlug.Choose(text.Length == 0 ? FallbackId : text, taken);
    }

    private static LocalizedText? Names(LocalizedTextInput? input, string field, FieldErrors errors, int maxLength, bool required)
    {
        var az = Clean(input?.Az);
        var ru = Clean(input?.Ru);
        var en = Clean(input?.En);
        errors.Add($"{field}.az", az is { } a && a.Length > maxLength ? FieldErrors.TooLong : null);
        errors.Add($"{field}.ru", ru is { } r && r.Length > maxLength ? FieldErrors.TooLong : null);
        errors.Add($"{field}.en", en is { } e && e.Length > maxLength ? FieldErrors.TooLong : null);
        if (az is null)
        {
            // Azerbaijani is the language every other falls back to (DATABASE.md §2): no text without it.
            errors.Add($"{field}.az", required || ru is not null || en is not null ? FieldErrors.Required : null);
            return null;
        }

        return new LocalizedText(az, ru, en);
    }

    private static string? Icon(string? value, bool isSub, FieldErrors errors, bool required)
    {
        var icon = Clean(value);
        if (isSub)
        {
            errors.Add("icon", icon is not null ? AdminErrors.NotAllowed : null);
            return null;
        }

        if (icon is null)
        {
            errors.Add("icon", required ? FieldErrors.Required : null);
            return null;
        }

        errors.Add("icon", Icons.Contains(icon) ? null : FieldErrors.Invalid);
        return icon;
    }

    private static List<CategoryFilter>? Filters(IReadOnlyList<CategoryFilter>? filters, CategoryForm? form, bool isSub, FieldErrors errors)
    {
        if (filters is null || filters.Count == 0)
        {
            return [];
        }

        if (isSub)
        {
            errors.Add("filters", AdminErrors.NotAllowed);
            return null;
        }

        var allowed = CategoryFilters.For(form);
        if (filters.Any(f => !allowed.Contains(f.Id)))
        {
            errors.Add("filters", AdminErrors.NotAllowed);
            return null;
        }

        if (filters.Select(f => f.Id).Distinct(StringComparer.Ordinal).Count() != filters.Count)
        {
            errors.Add("filters", AdminErrors.Duplicate);
            return null;
        }

        return filters.Select(f => new CategoryFilter(f.Id, f.Enabled)).ToList();
    }

    /// <summary>Another category under the same parent (or another top-level one) has the name, as the search compares it.</summary>
    private static bool SiblingHasName(TaxonomySnapshot taxonomy, string? parentId, string name, string? exceptId)
    {
        var normalized = SearchText.Normalize(name);
        return taxonomy.Categories.Any(c => c.ParentId == parentId && c.Id != exceptId && SearchText.Normalize(c.Name.Az) == normalized);
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    [GeneratedRegex("^[a-z0-9-]{1,80}$")]
    private static partial Regex IdShape();
}
