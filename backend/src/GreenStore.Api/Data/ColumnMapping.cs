using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;
using GreenStore.Api.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GreenStore.Api.Data;

/// <summary>
/// Column conventions of DATABASE.md §2 that EF does not have built in: enums as kebab-case <c>text</c> with a
/// <c>CHECK (column IN (…))</c>, and small value objects as <c>jsonb</c>.
/// </summary>
public static class ColumnMapping
{
    /// <summary>The JSON inside jsonb columns: camelCase, kebab-case enums, no nulls, letters unescaped.</summary>
    public static readonly JsonSerializerOptions StorageJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = null,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false) },
    };

    /// <summary>Stores the enum as its kebab-case string (<c>BareRoot</c> → <c>'bare-root'</c>).</summary>
    public static PropertyBuilder<TEnum> IsKebabCase<TEnum>(this PropertyBuilder<TEnum> property)
        where TEnum : struct, Enum =>
        property.HasConversion(new ValueConverter<TEnum, string>(v => KebabCase.Value(v), v => KebabCase.Parse<TEnum>(v)));

    /// <inheritdoc cref="IsKebabCase{TEnum}(PropertyBuilder{TEnum})"/>
    public static PropertyBuilder<TEnum?> IsKebabCase<TEnum>(this PropertyBuilder<TEnum?> property)
        where TEnum : struct, Enum =>
        property.HasConversion(new ValueConverter<TEnum, string>(v => KebabCase.Value(v), v => KebabCase.Parse<TEnum>(v)));

    /// <summary><c>column IN ('a', 'b')</c> for the values of an enum (a NULL column passes, as in SQL).</summary>
    public static string In<TEnum>(string column)
        where TEnum : struct, Enum => $"{column} IN ({string.Join(", ", KebabCase.Values<TEnum>().Select(v => $"'{v}'"))})";

    /// <summary>
    /// Stores the value as <c>jsonb</c> (<see cref="StorageJson"/>). Changes are detected by comparing the JSON, so
    /// replacing or mutating the value both get saved.
    /// </summary>
    public static PropertyBuilder<T> IsJson<T>(this PropertyBuilder<T> property)
    {
        var comparer = new ValueComparer<T>(
            (a, b) => Serialize(a) == Serialize(b),
            v => Serialize(v).GetHashCode(StringComparison.Ordinal),
            v => Deserialize<T>(Serialize(v)));
        property.HasConversion(new ValueConverter<T, string>(v => Serialize(v), v => Deserialize<T>(v)), comparer).HasColumnType("jsonb");
        return property;
    }

    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, StorageJson);

    private static T Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, StorageJson)!;
}
