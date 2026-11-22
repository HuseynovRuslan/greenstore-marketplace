using System.Security.Claims;
using System.Text.Encodings.Web;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Accounts.Auth;

/// <summary>
/// Signs requests in by their session token (<c>Authorization: Bearer &lt;token&gt;</c>, ARCHITECTURE.md §3: no JWT).
/// The token's hash must name a session that is not revoked or expired, of an active account. A request without a
/// token stays anonymous; one with a wrong token is anonymous too, and endpoints that require a user answer it
/// <c>401 unauthorized</c> (the site then drops its cookie). Every use extends the session (written at most every 5
/// minutes, <see cref="SessionPolicy"/>).
/// </summary>
public sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    AppDbContext db,
    TimeProvider clock)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Session";

    public const string SessionIdClaim = "sid";

    private const string BearerPrefix = "Bearer ";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        string? header = Request.Headers.Authorization;
        if (header is null || !header.StartsWith(BearerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var token = header[BearerPrefix.Length..].Trim();
        if (!SessionTokens.IsWellFormed(token))
        {
            return AuthenticateResult.Fail("Malformed session token.");
        }

        var hash = SessionTokens.Hash(token);
        var now = clock.GetUtcNow();
        var session = await db.Sessions.AsNoTracking()
            .Where(s => s.TokenHash == hash && s.RevokedAt == null && s.ExpiresAt > now && s.User!.Status == UserStatus.Active)
            .Select(s => new { s.Id, s.UserId, s.LastSeenAt, s.User!.Role, s.User.AccountType })
            .FirstOrDefaultAsync(Context.RequestAborted);
        if (session is null)
        {
            return AuthenticateResult.Fail("Unknown, expired or revoked session.");
        }

        if (SessionPolicy.ShouldTouch(session.LastSeenAt, now))
        {
            var expires = SessionPolicy.ExpiresAt(now);
            await db.Sessions
                .Where(s => s.Id == session.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.LastSeenAt, now).SetProperty(x => x.ExpiresAt, expires), Context.RequestAborted);
        }

        var user = new CurrentUser(session.UserId, session.Id, session.Role, session.AccountType);
        Context.Features.Set(user);
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(SessionIdClaim, user.SessionId.ToString()),
                new Claim(ClaimTypes.Role, KebabCase.Value(user.Role)),
            ],
            SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    /// <summary>401 with <c>WWW-Authenticate: Bearer</c>; the status code pages write the ProblemDetails body.</summary>
    protected override Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        Response.Headers.WWWAuthenticate = "Bearer";
        return Task.CompletedTask;
    }
}

public static class AuthSetup
{
    public static IServiceCollection AddSessionAuthentication(this IServiceCollection services)
    {
        services.AddAuthentication(SessionAuthenticationHandler.SchemeName)
            .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthenticationHandler.SchemeName, null);
        services.AddAuthorizationBuilder()
            .AddPolicy(Access.StaffPolicy, p => p.RequireRole(KebabCase.Value(UserRole.Moderator), KebabCase.Value(UserRole.Admin)))
            .AddPolicy(Access.AdminPolicy, p => p.RequireRole(KebabCase.Value(UserRole.Admin)));
        return services;
    }
}
