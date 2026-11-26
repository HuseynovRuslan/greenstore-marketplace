using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary>
/// «Kateqoriya idarəetməsi» (ARCHITECTURE.md §8.1, backend-contract.md 3.5 <c>listCategories</c>, <c>saveCategory</c>):
/// admins only. Names come and go in all three languages (<c>LocalizedText</c>), never as a single string. A changed
/// name builds the search text of the category's listings again; every change is in <c>audit_log</c> and refreshes
/// the site's cached catalogue.
/// </summary>
public static class AdminCategoriesEndpoints
{
    /// <summary>What a category change refreshes on the site: the taxonomy, the catalogues and the home page.</summary>
    public static readonly IReadOnlyList<string> CacheTags = [Revalidation.Taxonomy, "listings", "services", Revalidation.Home];

    public static RouteGroupBuilder MapAdminCategories(this RouteGroupBuilder api)
    {
        var categories = api.MapGroup("/admin/categories").WithTags("Admin").RequireAuthorization(Access.AdminPolicy);
        categories.MapGet("", List);
        categories.MapGet("/{id}", Get);
        categories.MapPost("", Create);
        categories.MapPatch("/{id}", Update);
        categories.MapDelete("/{id}", Delete);
        return api;
    }

    /// <summary>
    /// <c>GET /admin/categories?kind</c> → every category, inactive ones too, in the site's order, each with its
    /// sub-categories (<c>subcategories</c>), names in all languages, filters, active listings and <c>version</c>.
    /// </summary>
    private static async Task<Ok<List<AdminCategoryDto>>> List(HttpContext http, AppDbContext db, CancellationToken ct)
    {
        var query = new QueryReader(http.Request.Query);
        var kind = query.Enum<CategoryKind>("kind");
        query.ThrowIfInvalid();

        var all = await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync(ct);
        var counts = await CountsAsync(db, ct);
        return TypedResults.Ok(all
            .Where(c => c.ParentId is null && (kind is null || c.Kind == kind))
            .Select(c => ToDto(c, all, counts))
            .ToList());
    }

    /// <summary><c>GET /admin/categories/{id}</c> → one category (with its sub-categories) or sub-category; 404 <c>category.not-found</c>.</summary>
    private static async Task<Ok<AdminCategoryDto>> Get(string id, AppDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await ReadAsync(db, id, ct));

    /// <summary>
    /// <c>POST /admin/categories</c> <c>{ id?, parentId?, kind, form, names, descriptions?, icon, filters?, sortOrder?,
    /// isActive? }</c> → 201, the category. A sub-category (<c>parentId</c>) takes its parent's kind and form and has
    /// no icon or filters. 400 <c>validation</c> (<see cref="CategoryAdminRules.ValidateCreate"/>).
    /// </summary>
    private static async Task<Created<AdminCategoryDto>> Create(CategoryCreateDto body, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var (draft, errors) = CategoryAdminRules.ValidateCreate(body, taxonomy);
        errors.ThrowIfAny();

        var now = clock.GetUtcNow();
        var category = new Category
        {
            Id = draft!.Id,
            ParentId = draft.ParentId,
            Kind = draft.Kind,
            Form = draft.Form,
            Name = draft.Name,
            Description = draft.Description,
            Icon = draft.Icon,
            Filters = draft.Filters.ToList(),
            SortOrder = draft.SortOrder,
            IsActive = draft.IsActive,
            CreatedAt = now,
        };
        db.Categories.Add(category);
        Audit.Add(db, me.UserId, "category.create", "category", category.Id, new { category.ParentId, category.Name, category.Kind, category.Form }, now);
        Revalidation.Enqueue(db, CacheTags, now);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException error) when (DbErrors.UniqueViolation(error) is not null)
        {
            // Another admin took the id a moment ago.
            throw ApiProblemException.Validation("id", AdminErrors.NameTaken);
        }

        return TypedResults.Created($"{ApiRoutes.Prefix}/admin/categories/{category.Id}", await ReadAsync(db, category.Id, ct));
    }

    /// <summary>
    /// <c>PATCH /admin/categories/{id}</c> <c>{ names?, descriptions?, icon?, filters?, sortOrder?, isActive?, version? }</c>
    /// → the category. A changed name builds the search text of its listings again (in this request). 400
    /// <c>validation</c>, 404 <c>category.not-found</c>, 409 <c>concurrency-conflict</c> (a stale <c>version</c>).
    /// </summary>
    private static async Task<Ok<AdminCategoryDto>> Update(string id, CategoryPatchDto body, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw ApiProblemException.NotFound(AdminErrors.CategoryNotFound);
        if (body.Has(nameof(CategoryPatchDto.Version)))
        {
            if (!RowVersion.TryParse(body.Version, out var version))
            {
                throw ApiProblemException.Validation("version", FieldErrors.Invalid);
            }

            if (version != category.Version)
            {
                throw ApiProblemException.Conflict(ErrorCodes.ConcurrencyConflict);
            }

            db.SetExpectedVersion(category, version);
        }

        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var (change, errors) = CategoryAdminRules.ValidatePatch(body, category, taxonomy);
        errors.ThrowIfAny();

        var now = clock.GetUtcNow();
        var before = new CategoryAuditFields(category.Name, category.Description, category.Icon, category.Filters, category.SortOrder, category.IsActive);
        category.Name = change!.Name;
        category.Description = change.Description;
        category.Icon = change.Icon;
        category.Filters = change.Filters.ToList();
        category.SortOrder = change.SortOrder;
        category.IsActive = change.IsActive;
        var after = new CategoryAuditFields(category.Name, category.Description, category.Icon, category.Filters, category.SortOrder, category.IsActive);
        await db.SaveChangesAsync(ct);

        var rebuilt = change.NameChanged ? await SearchTextRebuilder.RebuildAsync(db, category.Id, ct) : 0;
        Audit.Add(db, me.UserId, "category.update", "category", category.Id, new { Before = before, After = after, SearchTextsRebuilt = rebuilt }, now);
        Revalidation.Enqueue(db, CacheTags, now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(await ReadAsync(db, category.Id, ct));
    }

    /// <summary>
    /// <c>DELETE /admin/categories/{id}</c> → 204, only for a category nothing uses yet (a mistake just made). 409
    /// <c>category.in-use</c> when listings (deleted ones too) or sub-categories have it: take it off the site with
    /// <c>isActive: false</c> instead, so old listings keep their category.
    /// </summary>
    private static async Task<NoContent> Delete(string id, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw ApiProblemException.NotFound(AdminErrors.CategoryNotFound);
        // Any of a service's types counts: only the first one is a foreign key (subcategory_id).
        var used = await db.Listings.AnyAsync(l => l.CategoryId == id || l.SubcategoryIds.Contains(id), ct)
            || await db.Categories.AnyAsync(c => c.ParentId == id, ct);
        if (used)
        {
            throw ApiProblemException.Conflict(AdminErrors.CategoryInUse);
        }

        var now = clock.GetUtcNow();
        db.Categories.Remove(category);
        Audit.Add(db, me.UserId, "category.delete", "category", category.Id, new { category.ParentId, category.Name }, now);
        Revalidation.Enqueue(db, CacheTags, now);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<AdminCategoryDto> ReadAsync(AppDbContext db, string id, CancellationToken ct)
    {
        var all = await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Id).ToListAsync(ct);
        var category = all.FirstOrDefault(c => c.Id == id) ?? throw ApiProblemException.NotFound(AdminErrors.CategoryNotFound);
        return ToDto(category, all, await CountsAsync(db, ct));
    }

    /// <summary>
    /// Active listings per category and per sub-category (a listing counts for its category and each of its
    /// sub-categories: a service under every one of its types).
    /// </summary>
    private static async Task<Dictionary<string, int>> CountsAsync(AppDbContext db, CancellationToken ct)
    {
        var active = db.Listings.AsNoTracking().Where(l => l.Status == ListingStatus.Active && l.DeletedAt == null);
        var byCategory = await active.GroupBy(l => l.CategoryId).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var bySubcategory = await ListingsEndpoints.CountBySubcategoryAsync(active, ct);
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (key, count) in byCategory.Select(r => (r.Key, r.Count)).Concat(bySubcategory.Select(r => (r.Key, r.Value))))
        {
            counts[key] = counts.GetValueOrDefault(key) + count;
        }

        return counts;
    }

    private static AdminCategoryDto ToDto(Category c, IReadOnlyList<Category> all, IReadOnlyDictionary<string, int> counts) => new()
    {
        Id = c.Id,
        ParentId = c.ParentId,
        Kind = c.Kind,
        Form = c.Form,
        Names = c.Name,
        Descriptions = c.Description,
        Icon = c.Icon,
        Filters = c.Filters,
        SortOrder = c.SortOrder,
        IsActive = c.IsActive,
        ListingCount = counts.GetValueOrDefault(c.Id),
        Version = RowVersion.Format(c.Version),
        CreatedAt = c.CreatedAt,
        UpdatedAt = c.UpdatedAt,
        Subcategories = c.ParentId is null ? all.Where(s => s.ParentId == c.Id).Select(s => ToDto(s, all, counts)).ToList() : null,
    };

    private sealed record CategoryAuditFields(LocalizedText Name, LocalizedText? Description, string? Icon, IReadOnlyList<CategoryFilter> Filters, int SortOrder, bool IsActive);
}

/// <summary>
/// A category as the admin edits it: names in all three languages (<c>names</c>, <c>descriptions</c>: <c>LocalizedText</c>),
/// the form and the filters, the order, whether it is on the site, its active listings and the <c>version</c> to send
/// back. A category lists its sub-categories; a sub-category has none.
/// </summary>
public sealed record AdminCategoryDto
{
    public required string Id { get; init; }

    public string? ParentId { get; init; }

    public CategoryKind Kind { get; init; }

    public CategoryForm? Form { get; init; }

    public required LocalizedText Names { get; init; }

    public LocalizedText? Descriptions { get; init; }

    public string? Icon { get; init; }

    public required IReadOnlyList<CategoryFilter> Filters { get; init; }

    public int SortOrder { get; init; }

    public bool IsActive { get; init; }

    /// <summary>Active listings in it; a category's count includes the listings of its sub-categories.</summary>
    public int ListingCount { get; init; }

    public required string Version { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

    public IReadOnlyList<AdminCategoryDto>? Subcategories { get; init; }
}
