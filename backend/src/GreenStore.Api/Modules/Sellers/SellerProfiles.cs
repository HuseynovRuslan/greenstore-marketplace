using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>Opening a business profile («mağaza»): registering a business account creates it.</summary>
public static class SellerProfiles
{
    /// <summary>Key of the advisory lock held while a slug is chosen, so two new businesses never pick the same one.</summary>
    private const long SlugLock = 0x67_73_6c_75_67; // "gslug"

    /// <summary>
    /// A new profile for <paramref name="owner"/>, added to the context. Must run inside the caller's transaction (the
    /// slug lock lasts until it ends). The contact person is the owner's name until the owner changes it.
    /// </summary>
    public static async Task<Seller> CreateAsync(
        AppDbContext db,
        User owner,
        string name,
        BusinessKind kind,
        string cityId,
        TimeProvider clock,
        CancellationToken ct)
    {
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({SlugLock})", ct);
        var baseSlug = SellerSlug.Base(name);
        var prefix = baseSlug + "-";
        var taken = await db.Sellers
            .Where(s => s.Slug == baseSlug || s.Slug.StartsWith(prefix))
            .Select(s => s.Slug)
            .ToListAsync(ct);

        var seller = new Seller
        {
            Id = Ids.New(clock),
            Owner = owner,
            OwnerUserId = owner.Id,
            Slug = SellerSlug.Choose(baseSlug, taken.ToHashSet(StringComparer.Ordinal)),
            Name = name,
            BusinessKind = kind,
            CityId = cityId,
            ContactPerson = owner.FullName,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Sellers.Add(seller);
        return seller;
    }

    /// <summary>A new business's city when none is given: the first active city of the list («Bakı»).</summary>
    public static Task<string?> DefaultCityAsync(AppDbContext db, CancellationToken ct) =>
        db.Cities.Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Id).Select(c => c.Id).FirstOrDefaultAsync(ct);
}
