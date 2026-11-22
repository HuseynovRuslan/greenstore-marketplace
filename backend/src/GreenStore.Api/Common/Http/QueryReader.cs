using System.Globalization;
using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Common.Http;

/// <summary>
/// Reads a list endpoint's query string with the API's rules, collecting every bad parameter so one 400
/// <c>validation</c> names them all (<c>errors: { "minPrice": ["invalid"] }</c>). Missing or empty parameters are
/// "not set". Error codes: <c>invalid</c> (not a value of the parameter's type) and <c>out-of-range</c>.
/// </summary>
public sealed class QueryReader(IQueryCollection query)
{
    public const string Invalid = "invalid";
    public const string OutOfRange = "out-of-range";

    private readonly Dictionary<string, string[]> errors = new(StringComparer.Ordinal);

    /// <summary>The trimmed value, or null when the parameter is missing or blank.</summary>
    public string? String(string name)
    {
        var value = query[name].ToString().Trim();
        return value.Length == 0 ? null : value;
    }

    /// <summary>Comma-separated and/or repeated values (<c>cityIds=baki,abseron</c>), without blanks or repeats.</summary>
    public IReadOnlyList<string> List(string name) =>
        query[name]
            .SelectMany(v => (v ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.Ordinal)
            .ToList();

    /// <summary><c>true</c>/<c>1</c> or <c>false</c>/<c>0</c>.</summary>
    public bool? Bool(string name)
    {
        var value = String(name);
        switch (value)
        {
            case null:
                return null;
            case "true" or "1":
                return true;
            case "false" or "0":
                return false;
            default:
                Fail(name, Invalid);
                return null;
        }
    }

    public int? Int(string name, int min = 0, int max = int.MaxValue)
    {
        var value = String(name);
        if (value is null)
        {
            return null;
        }

        if (!int.TryParse(value, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var number))
        {
            Fail(name, Invalid);
            return null;
        }

        if (number < min || number > max)
        {
            Fail(name, OutOfRange);
            return null;
        }

        return number;
    }

    /// <summary>A non-negative amount with a dot as the decimal mark (<c>12.5</c>).</summary>
    public decimal? Amount(string name)
    {
        var value = String(name);
        if (value is null)
        {
            return null;
        }

        if (!decimal.TryParse(value, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var amount))
        {
            Fail(name, Invalid);
            return null;
        }

        if (amount is < 0 or > 99_999_999.99m)
        {
            Fail(name, OutOfRange);
            return null;
        }

        return amount;
    }

    /// <summary>One of the enum's kebab-case strings (<c>bare-root</c>), as the JSON writes them.</summary>
    public TEnum? Enum<TEnum>(string name)
        where TEnum : struct, Enum
    {
        var value = String(name);
        if (value is null)
        {
            return null;
        }

        if (KebabCase.TryParse<TEnum>(value, out var member))
        {
            return member;
        }

        Fail(name, Invalid);
        return null;
    }

    public Guid? Guid(string name)
    {
        var value = String(name);
        if (value is null)
        {
            return null;
        }

        if (System.Guid.TryParseExact(value, "D", out var id))
        {
            return id;
        }

        Fail(name, Invalid);
        return null;
    }

    /// <summary><c>page</c> and <c>pageSize</c> (1–60, <see cref="PageRequest"/>).</summary>
    public PageRequest Page(int defaultPageSize)
    {
        var page = Int("page", min: 1);
        var size = Int("pageSize", min: 1, max: PageRequest.MaxPageSize);
        return new PageRequest(page ?? 1, size ?? defaultPageSize);
    }

    public void Fail(string name, string code)
    {
        if (!errors.ContainsKey(name))
        {
            errors[name] = [code];
        }
    }

    /// <summary>Throws the 400 <c>validation</c> problem when any parameter was bad.</summary>
    public void ThrowIfInvalid()
    {
        if (errors.Count > 0)
        {
            throw ApiProblemException.Validation(errors);
        }
    }
}
