using System.Net;
using System.Security.Cryptography;
using System.Text;
using GreenStore.Api.Common.Http;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Common.Security;

/// <summary>
/// HMAC-SHA256 with the server's secret key (<c>Otp:HmacKey</c>, DATABASE.md §2) for values that have few possible
/// inputs: a 4-digit SMS code has only 10 000, an IPv4 address 4 billion. A plain hash of those is reversed by trying
/// them all once the database leaks; without the key it is not. Each kind of value gets its own prefix, so a hash of
/// one kind never equals a hash of another.
/// </summary>
public sealed class ServerHash
{
    private readonly byte[] key;

    public ServerHash(IOptions<OtpOptions> options)
        : this(options.Value.HmacKey)
    {
    }

    public ServerHash(string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            throw new InvalidOperationException("Otp:HmacKey is not set.");
        }

        this.key = Encoding.UTF8.GetBytes(key);
    }

    /// <summary>An SMS code of one challenge: <c>HMAC(key, "otp:" + id + ":" + code)</c>, so equal codes differ per challenge.</summary>
    public byte[] OtpCode(Guid challengeId, string code) => Hash($"otp:{challengeId:N}:{code}");

    /// <summary>True when <paramref name="code"/> is the challenge's code (constant-time comparison).</summary>
    public bool OtpCodeMatches(Guid challengeId, string code, byte[] stored) =>
        CryptographicOperations.FixedTimeEquals(OtpCode(challengeId, code), stored);

    /// <summary>
    /// A client's IP as limits count it: the rate-limit bucket (<see cref="ClientIpResolver.PartitionKey"/>: the address,
    /// or its /64 network for IPv6; one bucket for an unknown address).
    /// </summary>
    public byte[] Ip(IPAddress? address) => Hash($"ip:{ClientIpResolver.PartitionKey(address)}");

    /// <summary>
    /// A visitor of a listing, for counting a view or a phone reveal once a day (DATABASE.md §3.6): the session when
    /// signed in, else the IP's bucket and the browser. Not reversible to either without the key.
    /// </summary>
    public byte[] Visitor(Guid? sessionId, IPAddress? address, string? userAgent) =>
        sessionId is { } session
            ? Hash($"visitor:s:{session:N}")
            : Hash($"visitor:ip:{ClientIpResolver.PartitionKey(address)}|{userAgent?.Trim() ?? string.Empty}");

    private byte[] Hash(string value) => HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(value));
}
