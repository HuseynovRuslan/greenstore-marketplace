using System.Text.Json;
using System.Text.RegularExpressions;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// The frontend's types (src/types/index.ts, src/services/repository.ts) as backend/contracts/frontend-types.json has
/// them: every interface's properties with their TypeScript types, and every string union. <see cref="Check"/> walks a
/// JSON response against a TypeScript type and lists every difference: a property the type does not have, a required
/// one missing, a wrong JSON kind, an enum string outside its union, a date that is not ISO 8601 UTC.
/// </summary>
public sealed partial class FrontendContract
{
    /// <summary>
    /// Approved additions of backend-contract.md that src/types does not have yet, by type and property (property →
    /// TypeScript type). Empty now: every phase's frontend added its own (1.3 <c>subcategoryId</c>, 1.7
    /// <c>Service.priceType</c> and <c>priceUnit</c>, 3.1 <c>phoneMasked</c>, 2.1 <c>UserProfile.role</c> and
    /// <c>locale</c>, 5.1 <c>PromotionOrder.number</c> and <c>paidAt</c>, <c>OwnListing.pendingPromotion</c> and
    /// <c>PromotionCheckout</c>). A new approved field the API sends before the site has it goes here.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> ApprovedAdditions =
        new Dictionary<string, IReadOnlyDictionary<string, string>>();

    /// <summary>
    /// Properties public responses must never send (backend-contract.md 3.1; owner-only data), though src/types still
    /// declares them.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> Withheld = new Dictionary<string, IReadOnlyList<string>>
    {
        ["Listing"] = ["contactPhone", "stats", "rejectionReason"],
        ["Seller"] = ["phone"],
        ["ServiceProvider"] = ["phone"],
    };

    private FrontendContract(
        Dictionary<string, Dictionary<string, (bool Optional, string Type)>> interfaces,
        Dictionary<string, string[]> unions)
    {
        Interfaces = interfaces;
        Unions = unions;
    }

    public IReadOnlyDictionary<string, Dictionary<string, (bool Optional, string Type)>> Interfaces { get; }

    public IReadOnlyDictionary<string, string[]> Unions { get; }

    public static FrontendContract Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "contracts", "frontend-types.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var interfaces = document.RootElement.GetProperty("interfaces").EnumerateObject().ToDictionary(
            i => i.Name,
            i => i.Value.EnumerateObject().ToDictionary(
                p => p.Name,
                p => (p.Value.GetProperty("optional").GetBoolean(), p.Value.GetProperty("type").GetString()!)));
        var unions = document.RootElement.GetProperty("unions").EnumerateObject().ToDictionary(
            u => u.Name,
            u => u.Value.EnumerateArray().Select(v => v.GetString()!).ToArray());
        foreach (var (derived, @base) in Bases)
        {
            foreach (var (name, property) in interfaces[@base])
            {
                interfaces[derived].TryAdd(name, property);
            }
        }

        return new FrontendContract(interfaces, unions);
    }

    /// <summary>The differences between <paramref name="value"/> and the TypeScript <paramref name="type"/>; empty when it fits.</summary>
    /// <param name="generic">What <c>T</c> stands for (<c>PageResult&lt;T&gt;</c>).</param>
    public IReadOnlyList<string> Check(JsonElement value, string type, string? generic = null)
    {
        var problems = new List<string>();
        Check(value, type, "$", generic, problems);
        return problems;
    }

    /// <summary>
    /// Interfaces of src/types that extend another one (<c>interface OwnListing extends Listing</c>): the contract file
    /// lists only each interface's own properties, so <see cref="Load"/> adds the base's to them.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, string> Bases = new Dictionary<string, string>
    {
        ["OwnListing"] = "Listing",
    };

    /// <summary>
    /// The owner's (and the moderator's) view of a listing (phase 3): <c>OwnListing</c> of src/types, the public
    /// <c>Listing</c> with the owner's fields (<c>contactPhone</c> is not withheld there).
    /// </summary>
    public IReadOnlyList<string> CheckOwnListing(JsonElement value) => Check(value, "OwnListing");

    /// <summary>A page: <c>PageResult&lt;T&gt;</c>, plus the properties of <paramref name="extended"/> (<c>ServiceSearchResult</c>).</summary>
    public IReadOnlyList<string> CheckPage(JsonElement value, string itemType, string? extended = null)
    {
        var problems = new List<string>();
        var properties = new Dictionary<string, (bool Optional, string Type)>(Interfaces["PageResult"]);
        foreach (var (name, property) in extended is null ? [] : Interfaces[extended])
        {
            properties[name] = property;
        }

        CheckObject(value, extended ?? "PageResult", properties, "$", itemType, problems);
        return problems;
    }

    private void Check(JsonElement value, string type, string path, string? generic, List<string> problems)
    {
        type = type.Trim();
        if (type == "T" && generic is not null)
        {
            type = generic;
        }

        if (type.EndsWith("[]", StringComparison.Ordinal))
        {
            CheckArray(value, type[..^2], path, generic, problems);
        }
        else if (type.StartsWith("Array<", StringComparison.Ordinal) && type.EndsWith('>'))
        {
            CheckArray(value, type["Array<".Length..^1], path, generic, problems);
        }
        else if (type.StartsWith("Record<string, ", StringComparison.Ordinal) && type.EndsWith('>'))
        {
            if (Expect(value, JsonValueKind.Object, type, path, problems))
            {
                foreach (var entry in value.EnumerateObject())
                {
                    Check(entry.Value, type["Record<string, ".Length..^1], $"{path}.{entry.Name}", generic, problems);
                }
            }
        }
        else if (type.StartsWith('{') && type.EndsWith('}'))
        {
            CheckObject(value, type, InlineObject(type), path, generic, problems);
        }
        else if (type.Contains('|', StringComparison.Ordinal) || type.StartsWith('\''))
        {
            CheckLiterals(value, type, path, problems);
        }
        else if (Unions.TryGetValue(type, out var values))
        {
            if (Expect(value, JsonValueKind.String, type, path, problems) && !values.Contains(value.GetString()))
            {
                problems.Add($"{path}: \"{value.GetString()}\" is not a {type} ({string.Join(", ", values)})");
            }
        }
        else if (Interfaces.TryGetValue(type, out var properties))
        {
            CheckObject(value, type, properties, path, generic, problems);
        }
        else
        {
            CheckPrimitive(value, type, path, problems);
        }
    }

    private void CheckObject(
        JsonElement value,
        string name,
        IReadOnlyDictionary<string, (bool Optional, string Type)> properties,
        string path,
        string? generic,
        List<string> problems)
    {
        if (!Expect(value, JsonValueKind.Object, name, path, problems))
        {
            return;
        }

        var additions = ApprovedAdditions.GetValueOrDefault(name) ?? new Dictionary<string, string>();
        var withheld = Withheld.GetValueOrDefault(name) ?? [];
        foreach (var property in value.EnumerateObject())
        {
            var at = $"{path}.{property.Name}";
            if (withheld.Contains(property.Name))
            {
                problems.Add($"{at}: public responses must not send {name}.{property.Name}");
            }
            else if (property.Value.ValueKind == JsonValueKind.Null)
            {
                problems.Add($"{at}: null (optional properties are left out instead)");
            }
            else if (properties.TryGetValue(property.Name, out var declared))
            {
                Check(property.Value, declared.Type, at, generic, problems);
            }
            else if (additions.TryGetValue(property.Name, out var added))
            {
                Check(property.Value, added, at, generic, problems);
            }
            else
            {
                problems.Add($"{at}: {name} has no property \"{property.Name}\"");
            }

            if (property.Name.EndsWith("At", StringComparison.Ordinal) && property.Value.ValueKind == JsonValueKind.String
                && !UtcDate().IsMatch(property.Value.GetString()!))
            {
                problems.Add($"{at}: \"{property.Value.GetString()}\" is not an ISO 8601 UTC date");
            }
        }

        foreach (var (property, declared) in properties)
        {
            if (!declared.Optional && !value.TryGetProperty(property, out _))
            {
                problems.Add($"{path}: required {name}.{property} is missing");
            }
        }
    }

    private void CheckArray(JsonElement value, string itemType, string path, string? generic, List<string> problems)
    {
        if (!Expect(value, JsonValueKind.Array, $"{itemType}[]", path, problems))
        {
            return;
        }

        var index = 0;
        foreach (var item in value.EnumerateArray())
        {
            Check(item, itemType, $"{path}[{index++}]", generic, problems);
        }
    }

    /// <summary><c>'company' | 'individual'</c>, <c>1 | 2 | … | 7</c>.</summary>
    private static void CheckLiterals(JsonElement value, string type, string path, List<string> problems)
    {
        var literals = type.Split('|', StringSplitOptions.TrimEntries);
        var text = value.ValueKind switch
        {
            JsonValueKind.String => $"'{value.GetString()}'",
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
        if (text is null || !literals.Contains(text))
        {
            problems.Add($"{path}: {value.GetRawText()} is not one of {type}");
        }
    }

    private static void CheckPrimitive(JsonElement value, string type, string path, List<string> problems)
    {
        var ok = type switch
        {
            "string" => value.ValueKind == JsonValueKind.String,
            "number" => value.ValueKind == JsonValueKind.Number,
            "boolean" => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
            _ => false,
        };
        if (!ok)
        {
            problems.Add(type is "string" or "number" or "boolean"
                ? $"{path}: expected {type}, got {value.ValueKind}"
                : $"{path}: unknown TypeScript type {type}");
        }
    }

    /// <summary><c>{ min: number; max?: number }</c> → its properties (members may be object types themselves).</summary>
    private static Dictionary<string, (bool Optional, string Type)> InlineObject(string type)
    {
        var members = new List<string>();
        var depth = 0;
        var start = 1;
        for (var i = 1; i < type.Length - 1; i++)
        {
            depth += type[i] switch
            {
                '{' or '<' => 1,
                '}' or '>' => -1,
                _ => 0,
            };
            if (type[i] == ';' && depth == 0)
            {
                members.Add(type[start..i]);
                start = i + 1;
            }
        }

        members.Add(type[start..^1]);
        return members
            .Select(member => member.Trim())
            .Where(member => member.Length > 0)
            .Select(member => member.Split(':', 2, StringSplitOptions.TrimEntries))
            .ToDictionary(parts => parts[0].TrimEnd('?'), parts => (parts[0].EndsWith('?'), parts[1]));
    }

    private static bool Expect(JsonElement value, JsonValueKind kind, string type, string path, List<string> problems)
    {
        if (value.ValueKind == kind)
        {
            return true;
        }

        problems.Add($"{path}: expected {type} ({kind}), got {value.ValueKind}");
        return false;
    }

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z$")]
    private static partial Regex UtcDate();
}
