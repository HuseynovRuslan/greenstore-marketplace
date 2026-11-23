using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;
using GreenStore.Api.Common.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace GreenStore.Api.Data;

/// <summary>
/// Stores <see cref="LocalizedText"/> as <c>jsonb</c>: <c>{"az": "Güllər", "ru": "Розы", "en": "Roses"}</c>
/// (missing languages are left out). The storage format is independent of the API's JSON options.
/// </summary>
public static class LocalizedTextMapping
{
    private static readonly JsonSerializerOptions StorageJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.Create(UnicodeRanges.All),
    };

    public static readonly ValueConverter<LocalizedText, string> Converter = new(
        text => JsonSerializer.Serialize(text, StorageJson),
        json => JsonSerializer.Deserialize<LocalizedText>(json, StorageJson)!);

    /// <summary>Maps the property (required or optional) to a <c>jsonb</c> column. Add <see cref="CheckSql"/> as the table's check constraint.</summary>
    public static PropertyBuilder IsLocalizedText(this PropertyBuilder property) =>
        property.HasConversion(Converter).HasColumnType("jsonb");

    /// <summary>The constraint DATABASE.md §2 requires on every localised column: an object with an "az" key.</summary>
    public static string CheckSql(string column) => $"jsonb_typeof({column}) = 'object' AND {column} ? 'az'";
}
