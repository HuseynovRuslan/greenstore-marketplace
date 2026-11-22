using System.Globalization;
using GreenStore.Api.Modules.Listings;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// A business's address (<c>/saticilar/&lt;slug&gt;</c>): the company name in ASCII, the same way listing slugs are
/// made (<see cref="ListingSlug.Transliterate"/>): «Abşeron Tingçilik» → <c>abseron-tingcilik</c>. When another
/// business has it, a number follows (<c>abseron-tingcilik-2</c>). The slug stays when the name changes later, so
/// shared links keep working.
/// </summary>
public static class SellerSlug
{
    /// <summary>For a name with nothing left in ASCII (emoji only, say).</summary>
    public const string Fallback = "satici";

    public static string Base(string name)
    {
        var text = ListingSlug.Transliterate(name);
        return text.Length == 0 ? Fallback : text;
    }

    /// <summary>The first of <c>base</c>, <c>base-2</c>, <c>base-3</c>, … that is not <paramref name="taken"/>.</summary>
    public static string Choose(string baseSlug, IReadOnlySet<string> taken)
    {
        if (!taken.Contains(baseSlug))
        {
            return baseSlug;
        }

        for (var n = 2; ; n++)
        {
            var candidate = $"{baseSlug}-{n.ToString(CultureInfo.InvariantCulture)}";
            if (!taken.Contains(candidate))
            {
                return candidate;
            }
        }
    }
}
