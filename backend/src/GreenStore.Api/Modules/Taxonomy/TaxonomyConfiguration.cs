using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Taxonomy;

/// <summary><c>categories</c> and <c>cities</c> (DATABASE.md §3.1).</summary>
internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> category)
    {
        category.ToTable("categories", t =>
        {
            t.HasCheckConstraint("ck_categories_id", "id ~ '^[a-z0-9-]{1,80}$'");
            t.HasCheckConstraint("ck_categories_kind", ColumnMapping.In<CategoryKind>("kind"));
            t.HasCheckConstraint("ck_categories_form", ColumnMapping.In<CategoryForm>("form"));
            t.HasCheckConstraint("ck_categories_name", LocalizedTextMapping.CheckSql("name"));
            // Only a category has a form; a sub-category takes its parent's.
            t.HasCheckConstraint("ck_categories_form_on_categories_only", "(parent_id IS NULL) = (form IS NOT NULL)");
        });

        category.Property(c => c.Id).ValueGeneratedNever();
        category.HasOne(c => c.Parent).WithMany(c => c.Subcategories).HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.NoAction);
        category.Property(c => c.Kind).IsKebabCase();
        category.Property(c => c.Form).IsKebabCase();
        category.Property(c => c.Name).IsLocalizedText();
        category.Property(c => c.Description).IsLocalizedText();
        category.Property(c => c.Filters).IsJson().HasDefaultValueSql("'[]'::jsonb");
        category.Property(c => c.SortOrder).HasDefaultValue(0);
        category.Property(c => c.IsActive).HasDefaultValue(true).HasSentinel(true);
        category.Property(c => c.CreatedAt).HasDefaultValueSql("now()");
        category.Property(c => c.UpdatedAt).HasDefaultValueSql("now()");
        category.HasXminRowVersion();
    }
}

internal sealed class CityConfiguration : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> city)
    {
        city.ToTable("cities", t =>
        {
            t.HasCheckConstraint("ck_cities_id", "id ~ '^[a-z0-9-]{1,40}$'");
            t.HasCheckConstraint("ck_cities_name", LocalizedTextMapping.CheckSql("name"));
        });

        city.Property(c => c.Id).ValueGeneratedNever();
        city.Property(c => c.Name).IsLocalizedText();
        city.Property(c => c.SortOrder).HasDefaultValue(0);
        city.Property(c => c.IsActive).HasDefaultValue(true).HasSentinel(true);
    }
}
