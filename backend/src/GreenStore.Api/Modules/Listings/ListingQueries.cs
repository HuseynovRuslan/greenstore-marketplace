using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The catalogue as SQL: what buyers may see, the filters and the sort orders. Mirrors src/services/marketplace.ts
/// and src/features/services/query.ts, so the API answers the same queries with the same listings
/// (backend/contracts/*-search-parity.json).
/// </summary>
public static class ListingQueries
{
    /// <summary>Active, not deleted: the predicate of the public indexes (<see cref="ListingConfiguration.PublicFilter"/>).</summary>
    public static IQueryable<Listing> Public(this IQueryable<Listing> listings, CategoryKind kind) =>
        listings.Where(l => l.Kind == kind && l.Status == ListingStatus.Active && l.DeletedAt == null);

    /// <summary>Every query word occurs in the search text (<c>LIKE '%word%'</c> on the trigram index, DATABASE.md §4).</summary>
    public static IQueryable<Listing> Matching(this IQueryable<Listing> listings, string? query)
    {
        foreach (var word in ListingSearchText.QueryWords(query))
        {
            var pattern = $"%{EscapeLike(word)}%";
            listings = listings.Where(l => EF.Functions.Like(l.SearchText, pattern, LikeEscape));
        }

        return listings;
    }

    /// <summary>The product filters. <paramref name="except"/> leaves some out (facet counts choose them one by one).</summary>
    public static IQueryable<Listing> Filter(this IQueryable<Listing> listings, ListingFilter f, FilterPart except = FilterPart.None)
    {
        listings = listings.Matching(f.Query);

        if (!except.HasFlag(FilterPart.Category))
        {
            if (f.CategoryId is { } categoryId)
            {
                listings = listings.Where(l => l.CategoryId == categoryId);
            }

            if (f.SubcategoryId is { } subcategoryId)
            {
                listings = listings.Where(l => l.SubcategoryId == subcategoryId);
            }
        }

        if (!except.HasFlag(FilterPart.Cities) && f.CityIds.Count > 0)
        {
            var cityIds = f.CityIds.ToList();
            listings = listings.Where(l => cityIds.Contains(l.CityId));
        }

        listings = listings.PricedBetween(f.MinPrice, f.MaxPrice);

        if (f.PromotedOnly)
        {
            listings = listings.Where(l => l.IsPromoted);
        }

        if (f.DeliveryOnly)
        {
            listings = listings.Where(l => l.DeliveryAvailable);
        }

        listings = f.SellerType switch
        {
            AccountType.Business => listings.Where(l => l.SellerId != null),
            AccountType.Individual => listings.Where(l => l.SellerId == null),
            _ => listings,
        };

        if (f.SellerId is { } sellerId)
        {
            listings = listings.Where(l => l.SellerId == sellerId);
        }

        // A listing matches a height range when its own range overlaps it (marketplace.ts: «180–200 sm» is in 100–200).
        if (f.HeightMin is { } heightMin)
        {
            listings = listings.Where(l => l.HeightMinCm != null && (l.HeightMaxCm ?? l.HeightMinCm) >= heightMin);
        }

        if (f.HeightMax is { } heightMax)
        {
            listings = listings.Where(l => l.HeightMinCm != null && l.HeightMinCm <= heightMax);
        }

        // age_years is a smallint, and EF sends the bound as one: a bound past 32 767 would overflow the parameter.
        // Every age is within that range, so a larger minimum matches nothing and a larger maximum is 32 767.
        if (f.AgeMin is { } ageMin)
        {
            listings = ageMin <= short.MaxValue
                ? listings.Where(l => l.AgeYears != null && l.AgeYears >= (short)ageMin)
                : listings.Where(l => false);
        }

        if (f.AgeMax is { } ageMax)
        {
            var highest = (short)Math.Min(ageMax, short.MaxValue);
            listings = listings.Where(l => l.AgeYears != null && l.AgeYears <= highest);
        }

        if (!except.HasFlag(FilterPart.RootSystem) && f.RootSystem is { } root)
        {
            listings = listings.Where(l => l.RootSystem == root);
        }

        return listings;
    }

    /// <summary>The services catalogue's filters (src/features/services/query.ts <c>filterServices</c>).</summary>
    public static IQueryable<Listing> Filter(this IQueryable<Listing> services, ServiceFilter f)
    {
        services = services.Matching(f.Query);

        if (f.CategoryId is { } serviceType)
        {
            services = services.Where(l => l.SubcategoryId == serviceType);
        }

        if (f.CityId is { } cityId)
        {
            services = services.Where(l => l.ServiceCityIds.Contains(cityId));
        }

        services = f.ProviderKind switch
        {
            // «Təsdiqlənmiş şirkətlər»: a business profile that GreenStore verified.
            ProviderKind.Company => services.Where(l => l.SellerId != null && l.Seller!.VerifiedAt != null),
            ProviderKind.Individual => services.Where(l => l.SellerId == null),
            _ => services,
        };

        return services.PricedBetween(f.MinPrice, f.MaxPrice);
    }

    /// <summary>
    /// «Ən yenilər»: «Önə çıxan» first, then the newest publication or «İrəli çək» (<c>sort_at</c>). Price orders put
    /// listings priced «Razılaşma ilə» last (backend-contract.md 1.6). Ties end with the newest number, so pages never
    /// overlap.
    /// </summary>
    public static IOrderedQueryable<Listing> Sort(this IQueryable<Listing> listings, ListingSort sort) => sort switch
    {
        ListingSort.PriceAsc => listings
            .OrderBy(l => l.Price == null)
            .ThenBy(l => l.Price)
            .ThenByDescending(l => l.SortAt)
            .ThenByDescending(l => l.Number),
        ListingSort.PriceDesc => listings
            .OrderBy(l => l.Price == null)
            .ThenByDescending(l => l.Price)
            .ThenByDescending(l => l.SortAt)
            .ThenByDescending(l => l.Number),
        _ => listings
            .OrderByDescending(l => l.IsPromoted)
            .ThenByDescending(l => l.SortAt)
            .ThenByDescending(l => l.Number),
    };

    /// <summary>The photos, their files and the counters a DTO needs.</summary>
    public static IQueryable<Listing> WithCardData(this IQueryable<Listing> listings) =>
        listings
            .Include(l => l.Photos.OrderBy(p => p.Position)).ThenInclude(p => p.Photo)
            .Include(l => l.Counter)
            .Include(l => l.Seller)
            .AsSplitQuery();

    /// <summary>A price filter matches priced listings only: «Razılaşma ilə» has no price to compare.</summary>
    private static IQueryable<Listing> PricedBetween(this IQueryable<Listing> listings, decimal? min, decimal? max)
    {
        if (min is { } low)
        {
            listings = listings.Where(l => l.Price != null && l.Price >= low);
        }

        if (max is { } high)
        {
            listings = listings.Where(l => l.Price != null && l.Price <= high);
        }

        return listings;
    }

    private const string LikeEscape = "\\";

    private static string EscapeLike(string word) =>
        word.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}

/// <summary>Filters a facet count leaves out.</summary>
[Flags]
public enum FilterPart
{
    None = 0,
    Category = 1,
    Cities = 2,
    RootSystem = 4,
}
