using System.Net;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// The device a session is opened on: the client and name from the request body (the name else guessed from the
/// User-Agent), and the client IP (<see cref="ClientIpExtensions.GetClientIp"/>: the visitor's, for the site).
/// </summary>
public sealed record DeviceInfo(SessionClient Client, string? Name, IPAddress? Ip)
{
    public static DeviceInfo From(HttpContext http, SessionClient? client, string? name) =>
        new(
            client ?? SessionClient.Web,
            DeviceNames.Clean(name) ?? DeviceNames.FromUserAgent(http.Request.Headers.UserAgent),
            http.GetClientIp().Address);
}

/// <summary>Opening, listing and revoking sessions (<see cref="Session"/>).</summary>
public sealed class SessionService(AppDbContext db, ServerHash hash, TimeProvider clock)
{
    /// <summary>A new session for <paramref name="user"/>, added to the context (the caller saves). The token is in the result only.</summary>
    public SessionTokenDto Open(User user, DeviceInfo device)
    {
        var now = clock.GetUtcNow();
        var token = SessionTokens.New();
        var session = new Session
        {
            Id = Ids.New(clock),
            UserId = user.Id,
            TokenHash = SessionTokens.Hash(token),
            Client = device.Client,
            DeviceName = device.Name,
            IpHash = hash.Ip(device.Ip),
            CreatedAt = now,
            LastSeenAt = now,
            ExpiresAt = SessionPolicy.ExpiresAt(now),
        };
        db.Sessions.Add(session);
        return new SessionTokenDto(session.Id.ToString(), token, session.ExpiresAt);
    }

    /// <summary>Revokes the user's live sessions, all of them or all but <paramref name="keep"/>. Returns how many.</summary>
    public Task<int> RevokeAllAsync(Guid userId, Guid? keep, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.Sessions
            .Where(s => s.UserId == userId && s.RevokedAt == null && s.ExpiresAt > now && s.Id != keep)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now), ct);
    }

    /// <summary>Revokes one session (no-op when it is revoked already).</summary>
    public Task<int> RevokeAsync(Guid sessionId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.Sessions
            .Where(s => s.Id == sessionId && s.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now), ct);
    }
}
