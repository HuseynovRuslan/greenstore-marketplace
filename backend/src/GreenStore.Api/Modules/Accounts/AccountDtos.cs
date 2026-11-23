using GreenStore.Api.Common.Json;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Sellers;

namespace GreenStore.Api.Modules.Accounts;

/* ---------- Responses ---------- */

/// <summary>
/// <c>UserProfile</c> of src/types plus <c>role</c> and <c>locale</c> (backend-contract.md 2.1). <c>phone</c> is E.164
/// (<c>+994505551234</c>); <c>email</c> is "" when the account has none (the type has it as a required string).
/// </summary>
public sealed record UserProfileDto
{
    public required string Id { get; init; }

    public required string FullName { get; init; }

    public required string Email { get; init; }

    public required string Phone { get; init; }

    public AccountType AccountType { get; init; }

    /// <summary>The business profile of a business account.</summary>
    public string? SellerId { get; init; }

    public UserRole Role { get; init; }

    /// <summary>The language of SMS and e-mail.</summary>
    public Language Locale { get; init; }
}

/// <summary><c>OtpChallenge</c> of src/types. <c>demoCode</c> only with <c>Otp:ExposeDemoCode</c> (never in Production).</summary>
public sealed record OtpChallengeDto(string ChallengeId, string PhoneMasked, int ExpiresInSec, int ResendInSec, string? DemoCode = null);

/// <summary><c>{ ok: true }</c>: <c>OtpVerifyResult</c>, <c>resetPassword</c>, <c>changePassword</c>. Failures are ProblemDetails.</summary>
public sealed record OkDto(bool Ok = true);

/// <summary>
/// A new session. The site's server keeps <see cref="Token"/> in its httpOnly cookie, the app in secure storage; it is
/// sent once, here, and only its hash is stored.
/// </summary>
public sealed record SessionTokenDto(string Id, string Token, DateTimeOffset ExpiresAt);

/// <summary>
/// Registration and both sign-ins: <c>LoginResult</c> of backend-contract.md 2.1 (<c>{ ok: true, user }</c>) plus the
/// session. Failures are ProblemDetails (<c>auth.wrong-credentials</c>, <c>auth.locked</c>, <c>auth.blocked</c>).
/// </summary>
public sealed record LoginResponse(bool Ok, UserProfileDto User, SessionTokenDto Session);

/// <summary>One signed-in device of «Aktiv cihazlar» (<c>GET /me/sessions</c>).</summary>
public sealed record SessionInfoDto(
    string Id,
    SessionClient Client,
    string? DeviceName,
    DateTimeOffset CreatedAt,
    DateTimeOffset LastSeenAt,
    DateTimeOffset ExpiresAt,
    bool Current);

/* ---------- Requests ---------- */

public sealed record OtpRequest(string Phone, OtpPurpose Purpose);

public sealed record OtpVerifyRequest(string ChallengeId, string Code);

/// <summary>
/// <c>RegistrationInput</c> of src/types plus three optional fields: <c>cityId</c> (a business profile's city;
/// «Bakı» when not given) and the device of the new session (<c>client</c>, <c>deviceName</c>).
/// </summary>
public sealed record RegisterRequest(
    AccountType AccountType,
    string FullName,
    string Phone,
    string Password,
    string OtpChallengeId,
    BusinessKind? BusinessKind = null,
    string? CompanyName = null,
    string? Email = null,
    string? CityId = null,
    SessionClient? Client = null,
    string? DeviceName = null);

/// <summary>Sign in with a password; <c>login</c> is the phone number (any common shape) or the e-mail.</summary>
public sealed record LoginRequest(string Login, string Password, SessionClient? Client = null, string? DeviceName = null);

/// <summary>Sign in with a verified SMS code (purpose <c>login</c>).</summary>
public sealed record OtpLoginRequest(string OtpChallengeId, SessionClient? Client = null, string? DeviceName = null);

public sealed record PasswordResetRequest(string OtpChallengeId, string Password);

public sealed record ChangePasswordRequest(string Current, string Next);

public sealed record ChangePhoneRequest(string OtpChallengeId);

/// <summary><c>PATCH /me</c>: what is sent changes; "" or null clears the e-mail.</summary>
public sealed class MePatch : PatchBody
{
    public string? FullName { get; set => field = Sent(value); }

    public string? Email { get; set => field = Sent(value); }

    public Language? Locale { get; set => field = Sent(value); }
}
