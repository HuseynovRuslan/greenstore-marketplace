using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Data.Seed;

/// <summary>
/// Categories, sub-categories and cities from seed/reference (every environment, production included). A row whose id
/// exists is left exactly as it is, even when the file now says otherwise: from then on the admin owns it.
/// </summary>
public static class ReferenceSeeder
{
    public const string CategoriesFile = "reference/categories.json";
    public const string CitiesFile = "reference/cities.json";

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

        await db.SaveChangesAsync(cancellationToken);
        return added;
    }
}
