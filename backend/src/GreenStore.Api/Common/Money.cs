using System.Globalization;
using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Common;

/// <summary>Amounts in AZN (<c>numeric(10,2)</c>, DATABASE.md §2).</summary>
public static class Money
{
    /// <summary>
    /// The amount without trailing zeros, so JSON says <c>145</c> and <c>2.5</c> instead of <c>145.00</c> and
    /// <c>2.50</c> (PostgreSQL returns the column's scale). Dividing by 1.000… keeps the value and drops the scale.
    /// </summary>
    public static decimal Trim(decimal value) => value / 1.000000000000000000000000000000000m;

    /// <summary>
    /// «1 500», «2,5» (az, ru) or «1 500», «2.5» (en): thousands grouped with a space like the site's
    /// <c>formatNumber</c> (src/lib/format.ts), decimals only when there are any.
    /// </summary>
    public static string Format(decimal value, Language language)
    {
        var text = Trim(value).ToString("#,0.##", CultureInfo.InvariantCulture);
        var decimalMark = language == Language.En ? "." : ",";
        return text.Replace(",", " ", StringComparison.Ordinal).Replace(".", decimalMark, StringComparison.Ordinal);
    }
}
