namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// «Chrome, Windows»: a short device name for «Aktiv cihazlar» from a browser's User-Agent, when the client does not
/// send one itself. Only the common browsers and systems are told apart; anything else has no name.
/// </summary>
public static class DeviceNames
{
    public const int MaxLength = 80;

    public static string? FromUserAgent(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return null;
        }

        var browser = Browser(userAgent);
        var system = System(userAgent);
        return (browser, system) switch
        {
            (null, null) => null,
            (null, _) => system,
            (_, null) => browser,
            _ => $"{browser}, {system}",
        };
    }

    /// <summary>A name the client sent: trimmed, cut to <see cref="MaxLength"/>; null when empty.</summary>
    public static string? Clean(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= MaxLength ? trimmed : trimmed[..MaxLength];
    }

    // Order matters: Edge and Opera say "Chrome" too, Chrome says "Safari", and every Android says "Linux".
    private static string? Browser(string ua) =>
        Has(ua, "Edg/") ? "Edge"
        : Has(ua, "OPR/") || Has(ua, "Opera") ? "Opera"
        : Has(ua, "YaBrowser") ? "Yandex Browser"
        : Has(ua, "SamsungBrowser") ? "Samsung Internet"
        : Has(ua, "Firefox/") || Has(ua, "FxiOS") ? "Firefox"
        : Has(ua, "Chrome/") || Has(ua, "CriOS") ? "Chrome"
        : Has(ua, "Safari/") ? "Safari"
        : null;

    private static string? System(string ua) =>
        Has(ua, "iPhone") ? "iPhone"
        : Has(ua, "iPad") ? "iPad"
        : Has(ua, "Android") ? "Android"
        : Has(ua, "Windows") ? "Windows"
        : Has(ua, "Mac OS X") || Has(ua, "Macintosh") ? "macOS"
        : Has(ua, "CrOS") ? "ChromeOS"
        : Has(ua, "Linux") ? "Linux"
        : null;

    private static bool Has(string ua, string token) => ua.Contains(token, StringComparison.Ordinal);
}
