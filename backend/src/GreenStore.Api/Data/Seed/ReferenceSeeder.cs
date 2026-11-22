using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Data.Seed;

/// <summary>
/// Categories, sub-categories, cities and the promotion packages with their options from seed/reference (every
/// environment, production included). A row whose id exists is left exactly as it is, even when the file now says
/// otherwise (a price, a name): from then on the admin owns it.
/// </summary>
public static class ReferenceSeeder
{
    public const string CategoriesFile = "reference/categories.json";
    public const string CitiesFile = "reference/cities.json";
    public const string PromotionsFile = "reference/promotions.json";

    /// <returns>The number of rows added.</returns>
    public static async Task<int> SeedAsync(AppDbContext db, string directory, CancellationToken cancellationToken)
    {
        var categories = SeedFiles.Read<CategorySeed>(directory, CategoriesFile);
        var cities = SeedFiles.Read<CitySeed>(directory, CitiesFile);

        var existingCategories = (await db.Categories.Select(c => c.Id).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var existingCities = (await db.Cities.Select(c => c.Id).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var added = 0;

        foreach (var seed in categories)
        {
            if (existingCategories.Add(seed.Id))
            {
                db.Categories.Add(new Category
                {
                    Id = seed.Id,
                    Kind = seed.Kind,
                    Form = seed.Form,
                    Icon = seed.Icon,
                    Name = seed.Name,
                    Description = seed.Description,
                    Filters = seed.Filters.ToList(),
                    SortOrder = seed.SortOrder,
                });
                added++;
            }

            foreach (var sub in seed.Subcategories)
            {
                if (existingCategories.Add(sub.Id))
                {
                    db.Categories.Add(new Category
                    {
                        Id = sub.Id,
                        ParentId = seed.Id,
                        Kind = seed.Kind,
                        Name = sub.Name,
                        SortOrder = sub.SortOrder,
                    });
                    added++;
                }
            }
        }

        foreach (var seed in cities)
        {
            if (existingCities.Add(seed.Id))
            {
                db.Cities.Add(new City { Id = seed.Id, Name = seed.Name, SortOrder = seed.SortOrder });
                added++;
            }
        }

        added += await SeedPromotionsAsync(db, directory, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return added;
    }

    private static async Task<int> SeedPromotionsAsync(AppDbContext db, string directory, CancellationToken cancellationToken)
    {
        var packages = SeedFiles.Read<PromotionPackageSeed>(directory, PromotionsFile);
        var existingPackages = (await db.PromotionPackages.Select(p => p.Id).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var existingOptions = (await db.PromotionOptions.Select(o => o.Id).ToListAsync(cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var added = 0;
        foreach (var seed in packages)
        {
            if (existingPackages.Add(seed.Id))
            {
                db.PromotionPackages.Add(new PromotionPackage
                {
                    Id = seed.Id,
                    Name = seed.Name,
                    Summary = seed.Summary,
                    Benefits = seed.Benefits.ToList(),
                    SortOrder = seed.SortOrder,
                });
                added++;
            }

            foreach (var option in seed.Options)
            {
                if (existingOptions.Add(option.Id))
                {
                    db.PromotionOptions.Add(new PromotionOption
                    {
                        Id = option.Id,
                        PackageId = seed.Id,
                        Label = option.Label,
                        Price = option.Price,
                        Days = option.Days,
                        Bumps = option.Bumps,
                        SortOrder = option.SortOrder,
                    });
                    added++;
                }
            }
        }

        return added;
    }
}
