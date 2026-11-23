using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GreenStore.Api.Common.Json;

/// <summary>Shared format: <c>2026-10-28T06:15:00Z</c>, with fractional seconds only when there are any.</summary>
internal static class UtcDateFormat
{
    public const string Format = "yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'";

    public static string Write(DateTime utc) => utc.ToString(Format, CultureInfo.InvariantCulture);

    /// <summary>
    /// Reads an ISO-8601 date-time. A value with an offset is converted to UTC; a value without one is taken as UTC
    /// (the API never deals in server-local time).
    /// </summary>
    public static DateTimeOffset Read(ref Utf8JsonReader reader)
    {
        // TryGetDateTimeOffset validates the ISO-8601 form; the string is then parsed again so that a value without an
        // offset is read as UTC instead of the server's local time.
        if (reader.TokenType != JsonTokenType.String || !reader.TryGetDateTimeOffset(out _))
        {
            throw new JsonException("Expected an ISO-8601 date-time string.");
        }

        var text = reader.GetString()!;
        return DateTimeOffset.Parse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal);
    }
}

/// <summary>Writes every <see cref="DateTimeOffset"/> as UTC with a "Z" suffix (never "+00:00").</summary>
public sealed class UtcDateTimeOffsetConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        UtcDateFormat.Read(ref reader);

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(UtcDateFormat.Write(value.UtcDateTime));
}

/// <summary>
/// Writes every <see cref="DateTime"/> as UTC with a "Z" suffix. A value of unspecified kind is taken as UTC
/// (Npgsql reads <c>timestamptz</c> as UTC); prefer <see cref="DateTimeOffset"/> in new code.
/// </summary>
public sealed class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        UtcDateFormat.Read(ref reader).UtcDateTime;

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value,
        };
        writer.WriteStringValue(UtcDateFormat.Write(utc));
    }
}
