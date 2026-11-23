using System.Security.Cryptography;
using System.Text;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// Session tokens (ARCHITECTURE.md §14): 256 random bits, sent as base64url (43 characters), stored only as their
/// SHA-256. A token is long and random, so a plain hash is enough (no key, no salt): nobody can guess one from it.
/// </summary>
public static class SessionTokens
{
    public const int Bytes = 32;

    /// <summary>Tokens of other lengths are not ours: refused before any lookup.</summary>
    public const int Length = 43;

    public static string New() => Base64Url(RandomNumberGenerator.GetBytes(Bytes));

    public static byte[] Hash(string token) => SHA256.HashData(Encoding.ASCII.GetBytes(token));

    /// <summary>The shape of a token: 43 base64url characters.</summary>
    public static bool IsWellFormed(string? token) =>
        token is { Length: Length } && token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

/// <summary>
/// The life of a session: 30 days from its last use (sliding). Uses are written at most every 5 minutes, so an active
/// visitor does not cause a database write per request.
/// </summary>
public static class SessionPolicy
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    public static readonly TimeSpan TouchInterval = TimeSpan.FromMinutes(5);

    public static DateTimeOffset ExpiresAt(DateTimeOffset lastUse) => lastUse + Lifetime;

    /// <summary>True when the use at <paramref name="now"/> should be written (and the session extended).</summary>
    public static bool ShouldTouch(DateTimeOffset lastSeenAt, DateTimeOffset now) => now - lastSeenAt >= TouchInterval;

    public static bool IsLive(DateTimeOffset expiresAt, DateTimeOffset? revokedAt, DateTimeOffset now) =>
        revokedAt is null && expiresAt > now;
}
