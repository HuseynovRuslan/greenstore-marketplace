using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Common.Http;

/// <summary>Settings for calls from the Next.js server (section "Internal").</summary>
public sealed class InternalApiOptions
{
    public const string Section = "Internal";

    /// <summary>
    /// Shared secret the Next.js server sends as <c>X-Internal-Key</c>. Empty: no caller is trusted and
    /// <c>X-Client-IP</c> is always ignored. Set from the environment (<c>Internal__ApiKey</c>), never committed.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;
}

/// <summary>The caller's IP for rate limits and abuse checks, and whether the request came from our Next.js server.</summary>
public sealed record ClientIpFeature(IPAddress? Address, bool IsInternal);

/// <summary>
/// Which IP a request is counted against (ARCHITECTURE.md §9). Site requests come from the Next.js server, which
/// passes the visitor's IP in <c>X-Client-IP</c>; the API believes it only together with a valid
/// <c>X-Internal-Key</c>. Everything else (the mobile app, scripts calling the open API) is counted by the
/// connection's IP.
/// </summary>
public static class ClientIpResolver
{
    public const string ClientIpHeader = "X-Client-IP";
    public const string InternalKeyHeader = "X-Internal-Key";

    public static ClientIpFeature Resolve(IPAddress? connectionIp, string? clientIpHeader, string? internalKeyHeader, string? expectedKey)
    {
        var isInternal = IsValidInternalKey(internalKeyHeader, expectedKey);
        if (isInternal && IPAddress.TryParse(clientIpHeader?.Trim(), out var forwarded))
        {
            return new ClientIpFeature(Canonical(forwarded), true);
        }

        return new ClientIpFeature(connectionIp is null ? null : Canonical(connectionIp), isInternal);
    }

    /// <summary>Constant-time comparison; an unset key never matches.</summary>
    public static bool IsValidInternalKey(string? provided, string? expected)
    {
        if (string.IsNullOrEmpty(expected) || string.IsNullOrEmpty(provided))
        {
            return false;
        }

        // Hashing first gives equal-length inputs, so the comparison does not reveal the key's length either.
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    /// <summary>
    /// The rate-limit bucket of an address: the address itself for IPv4, its /64 network for IPv6 (one home or phone
    /// line usually gets a whole /64, so per-address limits would be easy to dodge).
    /// </summary>
    public static string PartitionKey(IPAddress? address)
    {
        if (address is null)
        {
            return "unknown";
        }

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address.ToString();
        }

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes) + "/64";
    }

    private static IPAddress Canonical(IPAddress address) => address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
}

public static class ClientIpExtensions
{
    public static ClientIpFeature GetClientIp(this HttpContext context) =>
        context.Features.Get<ClientIpFeature>() ?? new ClientIpFeature(context.Connection.RemoteIpAddress, false);

    public static IServiceCollection AddClientIp(this IServiceCollection services)
    {
        services.AddOptions<InternalApiOptions>().BindConfiguration(InternalApiOptions.Section);
        return services;
    }

    public static IApplicationBuilder UseClientIp(this IApplicationBuilder app) => app.UseMiddleware<ClientIpMiddleware>();
}

public sealed class ClientIpMiddleware(RequestDelegate next, IOptionsMonitor<InternalApiOptions> options)
{
    public Task InvokeAsync(HttpContext context)
    {
        var headers = context.Request.Headers;
        var client = ClientIpResolver.Resolve(
            context.Connection.RemoteIpAddress,
            headers[ClientIpResolver.ClientIpHeader],
            headers[ClientIpResolver.InternalKeyHeader],
            options.CurrentValue.ApiKey);
        context.Features.Set(client);
        return next(context);
    }
}
