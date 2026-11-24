using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Sellers;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// Accounts: registration (a business account opens its «mağaza» too), both sign-ins, the password reset and the
/// profile changes of /me. The rules are in plain classes (<see cref="PasswordRules"/>, <see cref="LoginLockout"/>,
/// <see cref="OtpRules"/>); this class reads and writes the rows.
/// </summary>
public sealed class AccountService(
    AppDbContext db,
    OtpService otp,
    SessionService sessions,
    IPasswordHasher<User> passwords,
    FailedLoginThrottle throttle,
    TimeProvider clock)
{
    public const int FullNameMaxLength = 60;
    public const int CompanyNameMinLength = 2;
    public const int CompanyNameMaxLength = 80;

    /// <summary>Checked when no account matches the login, so a wrong login takes as long as a wrong password.</summary>
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<User>().HashPassword(new User { FullName = "-" }, "not-a-password-1"));

    /// <summary>
    /// <c>POST /accounts</c>: a new account for the phone a verified <c>register</c> code proved, signed in at once.
    /// A business account gets its business profile in the same transaction (slug from the company name; city
    /// <paramref name="input"/>.CityId or «Bakı»), so its seller page exists from the first second.
    /// </summary>
    public async Task<LoginResponse> RegisterAsync(RegisterRequest input, DeviceInfo device, Language language, CancellationToken ct)
    {
        var errors = new FieldErrors();
        var fullName = input.FullName.Trim();
        errors.Add("fullName", FullNameError(fullName));
        var phone = PhoneNumbers.Normalize(input.Phone);
        errors.Add("phone", phone is null ? FieldErrors.Invalid : PhoneNumbers.IsMobile(phone) ? null : AccountErrors.NotMobile);
        var (email, emailError) = EmailAddresses.Clean(input.Email);
        errors.Add("email", emailError);
        errors.Add("password", PasswordRules.Check(input.Password));

        var business = input.AccountType == AccountType.Business;
        var companyName = input.CompanyName?.Trim() ?? string.Empty;
        string? cityId = null;
        if (business)
        {
            errors.Add("businessKinds", input.BusinessKinds is not { Count: > 0 } ? FieldErrors.Required : null);
            errors.Add("companyName", companyName.Length switch
            {
                0 => FieldErrors.Required,
                < CompanyNameMinLength => FieldErrors.TooShort,
                > CompanyNameMaxLength => FieldErrors.TooLong,
                _ => null,
            });
            cityId = input.CityId is { Length: > 0 } given
                ? await db.Cities.AnyAsync(c => c.Id == given && c.IsActive, ct) ? given : null
                : await SellerProfiles.DefaultCityAsync(db, ct);
            errors.Add("cityId", cityId is null ? FieldErrors.Invalid : null);
        }

        errors.ThrowIfAny();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await otp.ConsumeAsync(input.OtpChallengeId, OtpPurpose.Register, phone, ct);
        if (await db.Users.AnyAsync(u => u.Phone == phone, ct))
        {
            throw ApiProblemException.Conflict(AccountErrors.PhoneTaken);
        }

        if (email is not null && await EmailTakenAsync(email, null, ct))
        {
            throw ApiProblemException.Conflict(AccountErrors.EmailTaken);
        }

        var user = new User
        {
            Id = Ids.New(clock),
            Phone = phone,
            Email = email,
            FullName = fullName,
            AccountType = input.AccountType,
            Locale = language,
            CreatedAt = clock.GetUtcNow(),
        };
        user.PasswordHash = passwords.HashPassword(user, input.Password);
        db.Users.Add(user);
        Seller? seller = null;
        if (business)
        {
            seller = await SellerProfiles.CreateAsync(db, user, companyName, input.BusinessKinds!, cityId!, clock, ct);
        }

        var session = sessions.Open(user, device);
        await SaveAsync(ct);
        await transaction.CommitAsync(ct);
        return new LoginResponse(true, Profile(user, seller?.Id), session);
    }

    /// <summary>
    /// <c>POST /auth/login</c>: the phone number or e-mail and the password. Wrong ones count towards the account's
    /// lockout and the client IP's throttle; a locked account is refused without looking at the password.
    /// </summary>
    public async Task<LoginResponse> LoginAsync(LoginRequest input, DeviceInfo device, CancellationToken ct)
    {
        var ipKey = ClientIpResolver.PartitionKey(device.Ip);
        if (throttle.Blocked(ipKey) is { } wait)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, AccountErrors.TooManyLoginAttempts, retryAfter: wait);
        }

        var errors = new FieldErrors();
        errors.Add("login", string.IsNullOrWhiteSpace(input.Login) ? FieldErrors.Required : null);
        errors.Add("password", string.IsNullOrEmpty(input.Password) ? FieldErrors.Required : null);
        errors.ThrowIfAny();

        var user = await FindByLoginAsync(input.Login, ct);
        var now = clock.GetUtcNow();
        if (user is null)
        {
            Verify(null, DummyHash.Value, input.Password);
            throttle.RecordFailure(ipKey);
            throw WrongCredentials();
        }

        if (LoginLockout.LockedFor(user, now) is { } locked)
        {
            throw LockedProblem(locked);
        }

        var result = Verify(user, user.PasswordHash, input.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            throttle.RecordFailure(ipKey);
            var nowLocked = LoginLockout.RecordFailure(user, now);
            await db.SaveChangesAsync(ct);
            throw nowLocked ? LockedProblem(LoginLockout.Duration) : WrongCredentials();
        }

        if (user.Status == UserStatus.Blocked)
        {
            throw BlockedProblem();
        }

        LoginLockout.RecordSuccess(user);
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwords.HashPassword(user, input.Password);
        }

        var session = sessions.Open(user, device);
        await db.SaveChangesAsync(ct);
        return new LoginResponse(true, await ProfileAsync(user, ct), session);
    }

    /// <summary>
    /// <c>POST /auth/login/otp</c>: a verified <c>login</c> code is the proof. It also opens an account locked by wrong
    /// passwords (the lockout is cleared).
    /// </summary>
    public async Task<LoginResponse> LoginWithOtpAsync(OtpLoginRequest input, DeviceInfo device, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var challenge = await otp.ConsumeAsync(input.OtpChallengeId, OtpPurpose.Login, null, ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Phone == challenge.Phone && u.Status != UserStatus.Deleted, ct)
            ?? throw WrongCredentials();
        if (user.Status == UserStatus.Blocked)
        {
            throw BlockedProblem();
        }

        LoginLockout.RecordSuccess(user);
        var session = sessions.Open(user, device);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new LoginResponse(true, await ProfileAsync(user, ct), session);
    }

    /// <summary>
    /// <c>POST /accounts/password-reset</c>: a verified <c>reset-password</c> code and the new password. Every session of
    /// the account is revoked (whoever knew the old password is signed out) and the lockout is cleared.
    /// </summary>
    public async Task<OkDto> ResetPasswordAsync(PasswordResetRequest input, CancellationToken ct)
    {
        var errors = new FieldErrors();
        errors.Add("password", PasswordRules.Check(input.Password));
        errors.ThrowIfAny();

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var challenge = await otp.ConsumeAsync(input.OtpChallengeId, OtpPurpose.ResetPassword, null, ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Phone == challenge.Phone && u.Status != UserStatus.Deleted, ct)
            ?? throw ApiProblemException.NotFound(AccountErrors.AccountNotFound);
        if (user.Status == UserStatus.Blocked)
        {
            throw BlockedProblem();
        }

        user.PasswordHash = passwords.HashPassword(user, input.Password);
        LoginLockout.RecordSuccess(user);
        await db.SaveChangesAsync(ct);
        await sessions.RevokeAllAsync(user.Id, keep: null, ct);
        await transaction.CommitAsync(ct);
        return new OkDto();
    }

    /// <summary>
    /// <c>POST /me/password</c>: the current password and a new one. A wrong current password counts towards the
    /// lockout, like a wrong sign-in. The account's other sessions are revoked; this one stays.
    /// </summary>
    public async Task<OkDto> ChangePasswordAsync(CurrentUser me, ChangePasswordRequest input, CancellationToken ct)
    {
        var errors = new FieldErrors();
        errors.Add("current", string.IsNullOrEmpty(input.Current) ? FieldErrors.Required : null);
        errors.Add("next", PasswordRules.Check(input.Next));
        errors.ThrowIfAny();

        var user = await db.Users.FirstAsync(u => u.Id == me.UserId, ct);
        var now = clock.GetUtcNow();
        if (LoginLockout.LockedFor(user, now) is { } locked)
        {
            throw LockedProblem(locked);
        }

        if (Verify(user, user.PasswordHash, input.Current) == PasswordVerificationResult.Failed)
        {
            var nowLocked = LoginLockout.RecordFailure(user, now);
            await db.SaveChangesAsync(ct);
            throw nowLocked ? LockedProblem(LoginLockout.Duration) : ApiProblemException.BadRequest(AccountErrors.WrongPassword);
        }

        user.PasswordHash = passwords.HashPassword(user, input.Next);
        LoginLockout.RecordSuccess(user);
        await db.SaveChangesAsync(ct);
        await sessions.RevokeAllAsync(user.Id, keep: me.SessionId, ct);
        return new OkDto();
    }

    /// <summary><c>POST /me/phone</c>: a verified <c>change-phone</c> code sent to the new number becomes the account's number.</summary>
    public async Task<UserProfileDto> ChangePhoneAsync(CurrentUser me, ChangePhoneRequest input, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var challenge = await otp.ConsumeAsync(input.OtpChallengeId, OtpPurpose.ChangePhone, null, ct);
        if (await db.Users.AnyAsync(u => u.Phone == challenge.Phone && u.Id != me.UserId, ct))
        {
            throw ApiProblemException.Conflict(AccountErrors.PhoneTaken);
        }

        var user = await db.Users.FirstAsync(u => u.Id == me.UserId, ct);
        user.Phone = challenge.Phone;
        await SaveAsync(ct);
        await transaction.CommitAsync(ct);
        return await ProfileAsync(user, ct);
    }

    /// <summary><c>PATCH /me</c>: the name, the e-mail ("" or null removes it) and the language of SMS and e-mail.</summary>
    public async Task<UserProfileDto> UpdateMeAsync(CurrentUser me, MePatch patch, CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == me.UserId, ct);
        var errors = new FieldErrors();
        if (patch.Has(nameof(MePatch.FullName)))
        {
            var fullName = patch.FullName?.Trim() ?? string.Empty;
            errors.Add("fullName", FullNameError(fullName));
            user.FullName = fullName;
        }

        if (patch.Has(nameof(MePatch.Email)))
        {
            var (email, emailError) = EmailAddresses.Clean(patch.Email);
            errors.Add("email", emailError);
            if (emailError is null && !string.Equals(email, user.Email, StringComparison.Ordinal))
            {
                if (email is not null && await EmailTakenAsync(email, user.Id, ct))
                {
                    throw ApiProblemException.Conflict(AccountErrors.EmailTaken);
                }

                user.Email = email;
                user.EmailVerifiedAt = null;
            }
        }

        if (patch.Has(nameof(MePatch.Locale)))
        {
            errors.Add("locale", patch.Locale is null ? FieldErrors.Required : null);
            user.Locale = patch.Locale ?? user.Locale;
        }

        errors.ThrowIfAny();
        await SaveAsync(ct);
        return await ProfileAsync(user, ct);
    }

    /// <summary>The profile of <paramref name="user"/>, with its business profile's id.</summary>
    public async Task<UserProfileDto> ProfileAsync(User user, CancellationToken ct)
    {
        var sellerId = await db.Sellers.Where(s => s.OwnerUserId == user.Id).Select(s => (Guid?)s.Id).FirstOrDefaultAsync(ct);
        return Profile(user, sellerId);
    }

    public static UserProfileDto Profile(User user, Guid? sellerId) => new()
    {
        Id = user.Id.ToString(),
        FullName = user.FullName,
        Email = user.Email ?? string.Empty,
        Phone = user.Phone ?? string.Empty,
        AccountType = user.AccountType,
        SellerId = sellerId?.ToString(),
        Role = user.Role,
        Locale = user.Locale,
    };

    private static string? FullNameError(string fullName) => fullName.Length switch
    {
        0 => FieldErrors.Required,
        > FullNameMaxLength => FieldErrors.TooLong,
        _ => null,
    };

    /// <summary>The account a login names: an e-mail when it has "@", else a phone number in any common shape.</summary>
    private Task<User?> FindByLoginAsync(string login, CancellationToken ct)
    {
        var value = login.Trim();
        if (value.Contains('@', StringComparison.Ordinal))
        {
            var lowered = value.ToLowerInvariant();
            return db.Users.FirstOrDefaultAsync(u => u.Email != null && u.Email.ToLower() == lowered && u.Status != UserStatus.Deleted, ct);
        }

        var phone = PhoneNumbers.Normalize(value);
        return phone is null
            ? Task.FromResult<User?>(null)
            : db.Users.FirstOrDefaultAsync(u => u.Phone == phone && u.Status != UserStatus.Deleted, ct);
    }

    private Task<bool> EmailTakenAsync(string email, Guid? except, CancellationToken ct)
    {
        var lowered = email.ToLowerInvariant();
        return db.Users.AnyAsync(u => u.Email != null && u.Email.ToLower() == lowered && u.Id != except, ct);
    }

    /// <summary>A stored hash that is not a valid Identity hash (the demo accounts' «no password») never matches.</summary>
    private PasswordVerificationResult Verify(User? user, string? hash, string password)
    {
        if (string.IsNullOrEmpty(hash))
        {
            return PasswordVerificationResult.Failed;
        }

        try
        {
            return passwords.VerifyHashedPassword(user ?? new User { FullName = "-" }, hash, password);
        }
        catch (FormatException)
        {
            return PasswordVerificationResult.Failed;
        }
    }

    /// <summary>Saves; a phone or e-mail another request took in the meantime is a 409, not a 500.</summary>
    private async Task SaveAsync(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException error) when (DbErrors.UniqueViolation(error) == "ux_users_phone")
        {
            throw ApiProblemException.Conflict(AccountErrors.PhoneTaken);
        }
        catch (DbUpdateException error) when (DbErrors.UniqueViolation(error) == "ux_users_email")
        {
            throw ApiProblemException.Conflict(AccountErrors.EmailTaken);
        }
    }

    private static ApiProblemException WrongCredentials() => new(StatusCodes.Status401Unauthorized, AccountErrors.WrongCredentials);

    private static ApiProblemException LockedProblem(TimeSpan wait) => new(StatusCodes.Status423Locked, AccountErrors.Locked, retryAfter: wait);

    private static ApiProblemException BlockedProblem() => new(StatusCodes.Status403Forbidden, AccountErrors.Blocked);
}
