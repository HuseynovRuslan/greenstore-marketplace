using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Listings;

/// <summary>What a listing's search text is made of (DATABASE.md §4).</summary>
public sealed record ListingSearchInput
{
    public required string Title { get; init; }

    public string? Species { get; init; }

    /// <summary>The card line in every language («180–200 sm», «5 yaş», «dibçəkdə», …).</summary>
    public IReadOnlyList<string> AttributeLine { get; init; } = [];

    public LocalizedText? Category { get; init; }

    public LocalizedText? Subcategory { get; init; }

    public LocalizedText? City { get; init; }

    public string? Area { get; init; }

    /// <summary>Services only: the provider's name, as the services catalogue searches it (src/features/services/query.ts).</summary>
    public string? ProviderName { get; init; }

    /// <summary>Services only: the cities served.</summary>
    public IReadOnlyList<LocalizedText> ServiceCities { get; init; } = [];

    /// <summary>Services only: the description paragraphs and the «✓ …» checklist.</summary>
    public IReadOnlyList<string> ServiceTexts { get; init; } = [];
}

/// <summary>
/// Builds <c>listings.search_text</c> (DATABASE.md §4): the searchable words of a listing, normalised like the
/// frontend's <c>normalizeSearch</c> (<see cref="SearchText.Normalize"/>), with category, sub-category and city names
/// in all three languages, so «розы», «roses» and «güllər» find the same listings. A query matches when every one of its
/// normalised words is a substring of this text (<see cref="Matches"/>), which the database does with <c>LIKE</c> on
/// the trigram index.
/// </summary>
public static class ListingSearchText
{
    public static string Build(ListingSearchInput input)
    {
        var parts = new List<string?> { input.Title, input.Species };
        parts.AddRange(input.AttributeLine);
        parts.AddRange(Names(input.Category));
        parts.AddRange(Names(input.Subcategory));
        parts.AddRange(Names(input.City));
        parts.Add(input.Area);
        parts.Add(input.ProviderName);
        parts.AddRange(input.ServiceCities.SelectMany(Names));
        parts.AddRange(input.ServiceTexts);

        var words = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var part in parts)
        {
            foreach (var word in SearchText.Words(part))
            {
                if (seen.Add(word))
                {
                    words.Add(word);
                }
            }
        }

        return string.Join(' ', words);
    }

    /// <summary>
    /// The search text of a listing as stored: its own words, the card line in every language, and the names of its
    /// category, sub-category and city (and, for a service, the cities it covers) from <paramref name="taxonomy"/>.
    /// <paramref name="providerName"/> is the business or person behind a service.
    /// </summary>
    public static string For(Listing listing, TaxonomySnapshot taxonomy, string? providerName)
    {
        var form = taxonomy.FormOf(listing.CategoryId);
        var line = Languages.All
            .SelectMany(language => ListingTexts.AttributeLine(
                form, listing.Attributes, listing.HeightMinCm, listing.HeightMaxCm, listing.AgeYears, listing.RootSystem, language))
            .ToList();
        var isService = listing.Kind == CategoryKind.Service;
        return Build(new ListingSearchInput
        {
            Title = listing.Title,
            Species = listing.Species,
            AttributeLine = line,
            // Every service is under the one service category: its name tells services apart no more than nothing.
            Category = isService ? null : taxonomy.Category(listing.CategoryId)?.Name,
            Subcategory = taxonomy.Category(listing.SubcategoryId)?.Name,
            City = taxonomy.City(listing.CityId)?.Name,
            Area = listing.Area,
            ProviderName = isService ? providerName : null,
            ServiceCities = isService ? listing.ServiceCityIds.Select(taxonomy.City).OfType<City>().Select(c => c.Name).ToList() : [],
            ServiceTexts = isService ? [listing.Description, .. listing.Includes] : [],
        });
    }

    /// <summary>The query's normalised words; an empty list matches everything.</summary>
    public static IReadOnlyList<string> QueryWords(string? query) => SearchText.Words(query);

    /// <summary>The rule the SQL implements: every query word occurs in the search text.</summary>
    public static bool Matches(string searchText, string? query) =>
        QueryWords(query).All(word => searchText.Contains(word, StringComparison.Ordinal));

    private static IEnumerable<string> Names(LocalizedText? text) => text?.Values() ?? [];
}
