using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GreenStore.Api.Common;

/// <summary>
/// The kebab-case strings of an enum, the same ones the JSON options write (<c>BareRoot</c> → <c>"bare-root"</c>,
/// <c>[JsonStringEnumMemberName("flower-2")]</c> respected). The database stores enums as these strings too
/// (DATABASE.md §2: <c>text</c> with a <c>CHECK (x IN (…))</c>), and query parameters use them.
/// </summary>
public static class KebabCase
{
    private static readonly ConcurrentDictionary<Type, (Dictionary<string, object> ByValue, Dictionary<object, string> ByMember)> Maps = new();

    /// <summary><c>RootSystem.BareRoot</c> → <c>"bare-root"</c>.</summary>
    public static string Value<TEnum>(TEnum member)
        where TEnum : struct, Enum => Map(typeof(TEnum)).ByMember[member];

    /// <summary>Every value of the enum, in declaration order.</summary>
    public static IReadOnlyList<string> Values<TEnum>()
        where TEnum : struct, Enum => Enum.GetValues<TEnum>().Select(Value).ToList();

    /// <summary>Exact match only: <c>"bare-root"</c> parses, <c>"BareRoot"</c>, <c>"Bare-Root"</c> and <c>"2"</c> do not.</summary>
    public static bool TryParse<TEnum>(string? value, out TEnum member)
        where TEnum : struct, Enum
    {
        if (value is not null && Map(typeof(TEnum)).ByValue.TryGetValue(value, out var found))
        {
            member = (TEnum)found;
            return true;
        }

        member = default;
        return false;
    }

    public static TEnum Parse<TEnum>(string value)
        where TEnum : struct, Enum =>
        TryParse<TEnum>(value, out var member)
            ? member
            : throw new FormatException($"'{value}' is not a value of {typeof(TEnum).Name} ({string.Join(", ", Values<TEnum>())}).");

    private static (Dictionary<string, object> ByValue, Dictionary<object, string> ByMember) Map(Type type) =>
        Maps.GetOrAdd(type, static t =>
        {
            var byValue = new Dictionary<string, object>(StringComparer.Ordinal);
            var byMember = new Dictionary<object, string>();
            foreach (var field in t.GetFields(BindingFlags.Public | BindingFlags.Static))
            {
                var value = field.GetCustomAttribute<JsonStringEnumMemberNameAttribute>()?.Name
                    ?? JsonNamingPolicy.KebabCaseLower.ConvertName(field.Name);
                var member = field.GetValue(null)!;
                byValue[value] = member;
                byMember[member] = value;
            }

            return (byValue, byMember);
        });
}
