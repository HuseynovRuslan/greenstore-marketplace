using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;

namespace GreenStore.Api.Common.Json;

/// <summary>
/// JSON rules of the API, the same for every response and request body (ARCHITECTURE.md §7):
/// camelCase properties, enums as the kebab-case strings of the TypeScript unions in src/types
/// (<c>BareRoot</c> → <c>"bare-root"</c>, <c>GardenCentre</c> → <c>"garden-centre"</c>), ISO-8601 UTC dates
/// ending in "Z", and no <c>null</c> properties (the TypeScript types use optional fields, not <c>null</c>).
/// <para>
/// The naming policy puts no hyphen before a digit (<c>Flower2</c> → <c>"flower2"</c>). A union string it cannot
/// produce needs the attribute on its member: <c>[JsonStringEnumMemberName("flower-2")] Flower2</c>. In src/types
/// today that is only <c>IconName</c>'s <c>'flower-2'</c>.
/// </para>
/// <para>
/// A body that breaks these rules (malformed JSON, a wrong type or enum string, a required field missing or
/// <c>null</c>) is rejected while it is read: 400 with code <c>bad-request</c> and no <c>errors</c>. That is a client
/// bug, not user input. What a user typed is checked after binding by the module's validator, which answers 400
/// <c>validation</c> with <c>errors</c> (field → codes); so a field a form may leave empty is an optional or string
/// property in the request DTO, and the validator reports it as <c>required</c>.
/// </para>
/// </summary>
public static class JsonDefaults
{
    public static void Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        // Dictionary keys are data (ids, field names), not property names: they are sent as they are.
        options.DictionaryKeyPolicy = null;
        options.PropertyNameCaseInsensitive = true;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        // Numbers are numbers: "12" is not accepted where the contract has a number.
        options.NumberHandling = JsonNumberHandling.Strict;
        // A non-nullable property sent as null, or a missing constructor parameter, is a 400, not a half-filled
        // object. So an optional field of a positional record needs a default value: `string? Area = null`.
        options.RespectNullableAnnotations = true;
        options.RespectRequiredConstructorParameters = true;
        // Azerbaijani and Cyrillic letters are written as letters ("Güllər"), not as backslash-u escapes.
        // HTML-sensitive characters (<, >, &, ') stay escaped.
        options.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);

        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower, allowIntegerValues: false));
        options.Converters.Add(new UtcDateTimeOffsetConverter());
        options.Converters.Add(new UtcDateTimeConverter());
    }

    /// <summary>A standalone copy of the API options (for code that serialises outside the HTTP pipeline).</summary>
    public static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Apply(options);
        return options;
    }
}
