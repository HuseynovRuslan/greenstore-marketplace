using GreenStore.Api.Common;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// SMS codes, registration, sign-in and sign-out, the password reset, and the signed-in user's own account (/me),
/// ARCHITECTURE.md §7. Anonymous POSTs are limited per client IP (<see cref="RateLimitPolicies.AnonymousWrites"/>).
/// </summary>
public static class AccountsEndpoints
{
    public static RouteGroupBuilder MapAccounts(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Accounts");
        auth.MapPost("/otp", RequestOtp).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        auth.MapPost("/otp/verify", VerifyOtp).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        auth.MapPost("/login", Login).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        auth.MapPost("/login/otp", LoginWithOtp).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        auth.MapPost("/logout", Logout);

        var accounts = api.MapGroup("/accounts").WithTags("Accounts");
        accounts.MapPost("", Register).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        accounts.MapPost("/password-reset", ResetPassword).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);

        var me = api.MapGroup("/me").WithTags("Me").RequireAuthorization();
        me.MapGet("", GetMe);
        me.MapPatch("", UpdateMe);
        me.MapPost("/password", ChangePassword);
        me.MapPost("/phone", ChangePhone);
        me.MapGet("/sessions", ListSessions);
        me.MapDelete("/sessions/{id:guid}", RevokeSession);
        return api;
    }

    /// <summary>
    /// <c>POST /auth/otp</c> → <c>OtpChallenge</c>. 400 <c>validation</c> (<c>phone</c>: <c>invalid</c>,
    /// <c>not-mobile</c>), 409 <c>account.phone-taken</c>, 404 <c>account.not-found</c>, 403 <c>auth.blocked</c>, 429
    /// <c>otp.too-soon</c> / <c>otp.phone-limit</c> / <c>otp.ip-limit</c> (with <c>Retry-After</c>), 503
    /// <c>otp.unavailable</c>. <c>change-phone</c> needs a signed-in user (401 otherwise).
    /// </summary>
    private static async Task<Ok<OtpChallengeDto>> RequestOtp(OtpRequest body, HttpContext http, OtpService otp, CancellationToken ct) =>
        TypedResults.Ok(await otp.RequestAsync(body.Phone, body.Purpose, CurrentUser.Of(http), http.GetClientIp().Address, http.GetLanguage(), ct));

    /// <summary><c>POST /auth/otp/verify</c> → <c>{ ok: true }</c>; 400 <c>otp.wrong-code</c> (<c>attemptsLeft</c>), <c>otp.too-many-attempts</c>, <c>otp.expired</c>.</summary>
    private static async Task<Ok<OkDto>> VerifyOtp(OtpVerifyRequest body, OtpService otp, CancellationToken ct)
    {
        await otp.VerifyAsync(body.ChallengeId, body.Code, ct);
        return TypedResults.Ok(new OkDto());
    }

    /// <summary>
    /// <c>POST /accounts</c> → 201 <c>{ ok, user, session }</c>. 400 <c>validation</c>, 400 <c>otp.not-verified</c>, 409
    /// <c>account.phone-taken</c> / <c>account.email-taken</c>.
    /// </summary>
    private static async Task<Created<LoginResponse>> Register(RegisterRequest body, HttpContext http, AccountService accounts, CancellationToken ct)
    {
        var result = await accounts.RegisterAsync(body, DeviceInfo.From(http, body.Client, body.DeviceName), http.GetLanguage(), ct);
        return TypedResults.Created($"{ApiRoutes.Prefix}/me", result);
    }

    /// <summary>
    /// <c>POST /auth/login</c> → <c>{ ok, user, session }</c>. 401 <c>auth.wrong-credentials</c>, 423 <c>auth.locked</c>,
    /// 403 <c>auth.blocked</c>, 429 <c>auth.too-many-attempts</c>.
    /// </summary>
    private static async Task<Ok<LoginResponse>> Login(LoginRequest body, HttpContext http, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.LoginAsync(body, DeviceInfo.From(http, body.Client, body.DeviceName), ct));

    /// <summary><c>POST /auth/login/otp</c> → <c>{ ok, user, session }</c>. 400 <c>otp.not-verified</c>, 403 <c>auth.blocked</c>.</summary>
    private static async Task<Ok<LoginResponse>> LoginWithOtp(OtpLoginRequest body, HttpContext http, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.LoginWithOtpAsync(body, DeviceInfo.From(http, body.Client, body.DeviceName), ct));

    /// <summary><c>POST /auth/logout</c> → 204: revokes the request's session. Without a valid one there is nothing to do: 204 too.</summary>
    private static async Task<NoContent> Logout(HttpContext http, SessionService sessions, CancellationToken ct)
    {
        if (CurrentUser.Of(http) is { } me)
        {
            await sessions.RevokeAsync(me.SessionId, ct);
        }

        return TypedResults.NoContent();
    }

    /// <summary><c>POST /accounts/password-reset</c> → <c>{ ok: true }</c>. 400 <c>validation</c>, <c>otp.not-verified</c>.</summary>
    private static async Task<Ok<OkDto>> ResetPassword(PasswordResetRequest body, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.ResetPasswordAsync(body, ct));

    /// <summary><c>GET /me</c> → <c>UserProfile</c> (with <c>role</c> and <c>locale</c>).</summary>
    private static async Task<Ok<UserProfileDto>> GetMe(CurrentUser me, AppDbContext db, AccountService accounts, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == me.UserId, ct);
        return TypedResults.Ok(await accounts.ProfileAsync(user, ct));
    }

    /// <summary><c>PATCH /me</c> <c>{ fullName?, email?, locale? }</c> → <c>UserProfile</c>. 409 <c>account.email-taken</c>.</summary>
    private static async Task<Ok<UserProfileDto>> UpdateMe(MePatch body, CurrentUser me, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.UpdateMeAsync(me, body, ct));

    /// <summary><c>POST /me/password</c> <c>{ current, next }</c> → <c>{ ok: true }</c>. 400 <c>auth.wrong-password</c>, 423 <c>auth.locked</c>.</summary>
    private static async Task<Ok<OkDto>> ChangePassword(ChangePasswordRequest body, CurrentUser me, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.ChangePasswordAsync(me, body, ct));

    /// <summary><c>POST /me/phone</c> <c>{ otpChallengeId }</c> (purpose <c>change-phone</c>) → <c>UserProfile</c>.</summary>
    private static async Task<Ok<UserProfileDto>> ChangePhone(ChangePhoneRequest body, CurrentUser me, AccountService accounts, CancellationToken ct) =>
        TypedResults.Ok(await accounts.ChangePhoneAsync(me, body, ct));

    /// <summary><c>GET /me/sessions</c>: «Aktiv cihazlar», the live sessions, the most recently used first.</summary>
    private static async Task<Ok<List<SessionInfoDto>>> ListSessions(CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var rows = await db.Sessions.AsNoTracking()
            .Where(s => s.UserId == me.UserId && s.RevokedAt == null && s.ExpiresAt > now)
            .OrderByDescending(s => s.LastSeenAt).ThenByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
        return TypedResults.Ok(rows
            .Select(s => new SessionInfoDto(s.Id.ToString(), s.Client, s.DeviceName, s.CreatedAt, s.LastSeenAt, s.ExpiresAt, s.Id == me.SessionId))
            .ToList());
    }

    /// <summary><c>DELETE /me/sessions/{id}</c> → 204: «bu cihazdan çıx». Another user's or an ended session: 404 <c>session.not-found</c>.</summary>
    private static async Task<NoContent> RevokeSession(Guid id, CurrentUser me, AppDbContext db, SessionService sessions, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var owner = await db.Sessions
            .Where(s => s.Id == id && s.RevokedAt == null && s.ExpiresAt > now)
            .Select(s => (Guid?)s.UserId)
            .FirstOrDefaultAsync(ct);
        Access.EnsureCanManage(me, owner, AccountErrors.SessionNotFound);
        await sessions.RevokeAsync(id, ct);
        return TypedResults.NoContent();
    }
}
