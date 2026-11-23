using System.Net;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Accounts.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// SMS codes: sending one (<see cref="RequestAsync"/>), checking what the user typed (<see cref="VerifyAsync"/>), and
/// using a verified one as proof of the phone (<see cref="ConsumeAsync"/>). The limits are <see cref="OtpRules"/>.
/// </summary>
public sealed class OtpService(
    AppDbContext db,
    ServerHash hash,
    ISmsSender sms,
    IOptions<OtpOptions> options,
    TimeProvider clock,
    ILogger<OtpService> logger)
{
    private OtpOptions Settings => options.Value;

    /// <summary>
    /// Sends a code to <paramref name="phoneInput"/> for <paramref name="purpose"/>. Who may ask: anybody for
    /// <c>register</c> (when no account has the number), the account's owner for <c>login</c> and
    /// <c>reset-password</c> (an unknown number gets 404 and no SMS, so nobody pays for SMS to numbers without an
    /// account), and a signed-in user for <c>change-phone</c> (the new number, which no account may have).
    /// </summary>
    public async Task<OtpChallengeDto> RequestAsync(
        string phoneInput,
        OtpPurpose purpose,
        CurrentUser? me,
        IPAddress? clientIp,
        Language requestLanguage,
        CancellationToken ct)
    {
        var phone = PhoneNumbers.Normalize(phoneInput)
            ?? throw ApiProblemException.Validation("phone", string.IsNullOrWhiteSpace(phoneInput) ? FieldErrors.Required : FieldErrors.Invalid);
        if (!PhoneNumbers.IsMobile(phone))
        {
            throw ApiProblemException.Validation("phone", AccountErrors.NotMobile);
        }

        var account = await db.Users.AsNoTracking()
            .Where(u => u.Phone == phone && u.Status != UserStatus.Deleted)
            .Select(u => new { u.Id, u.Status, u.Locale })
            .FirstOrDefaultAsync(ct);
        var language = account?.Locale ?? requestLanguage;
        switch (purpose)
        {
            case OtpPurpose.Register when account is not null:
                throw ApiProblemException.Conflict(AccountErrors.PhoneTaken);
            case OtpPurpose.Login or OtpPurpose.ResetPassword when account is null:
                throw ApiProblemException.NotFound(AccountErrors.AccountNotFound);
            case OtpPurpose.Login or OtpPurpose.ResetPassword when account.Status == UserStatus.Blocked:
                throw new ApiProblemException(StatusCodes.Status403Forbidden, AccountErrors.Blocked);
            case OtpPurpose.ChangePhone when me is null:
                throw new ApiProblemException(StatusCodes.Status401Unauthorized, ErrorCodes.Unauthorized);
            case OtpPurpose.ChangePhone when account is not null:
                throw ApiProblemException.Conflict(AccountErrors.PhoneTaken);
            case OtpPurpose.ChangePhone:
                language = await db.Users.Where(u => u.Id == me!.UserId).Select(u => u.Locale).FirstAsync(ct);
                break;
        }

        var ipHash = hash.Ip(clientIp);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // One request per number and one per client IP at a time, so parallel requests cannot pass the limits together.
        // Always the number's lock first: a request holding an IP lock never waits for a number's, so no deadlock.
        var lockKey = $"otp:{phone}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))", ct);
        var ipLockKey = $"otp-ip:{Convert.ToHexString(ipHash)}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({ipLockKey}, 0))", ct);

        var now = clock.GetUtcNow();
        var dayAgo = now - OtpRules.Day;
        var phoneTimes = await db.OtpChallenges.Where(o => o.Phone == phone && o.CreatedAt > dayAgo).Select(o => o.CreatedAt).ToListAsync(ct);
        var ipTimes = await db.OtpChallenges.Where(o => o.IpHash == ipHash && o.CreatedAt > dayAgo).Select(o => o.CreatedAt).ToListAsync(ct);
        var global = await db.OtpChallenges.CountAsync(o => o.CreatedAt > dayAgo, ct);

        var limits = new OtpLimits(
            TimeSpan.FromSeconds(Settings.ResendSeconds),
            Settings.PerPhoneHourly,
            Settings.PerPhoneDaily,
            Settings.PerIpHourly,
            Settings.PerIpDaily,
            Settings.GlobalDailyCap);
        if (OtpRules.Check(limits, phoneTimes, ipTimes, global, now) is { } refusal)
        {
            throw Refused(refusal, global);
        }

        var code = OtpRules.NewCode(Settings.CodeLength);
        var challenge = new OtpChallenge
        {
            Id = Ids.New(clock),
            Phone = phone,
            Purpose = purpose,
            CodeHash = [],
            IpHash = ipHash,
            CreatedAt = now,
            ExpiresAt = now.AddSeconds(Settings.LifetimeSeconds),
        };
        challenge.CodeHash = hash.OtpCode(challenge.Id, code);
        db.OtpChallenges.Add(challenge);
        await db.SaveChangesAsync(ct);

        try
        {
            var minutes = Math.Max(1, Settings.LifetimeSeconds / 60);
            await sms.SendAsync(new SmsMessage(phone, SmsTexts.OtpCode(code, language, minutes)), ct);
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            // Rolled back with the transaction: a failed send does not count against the user's limits.
            logger.LogError(error, "The SMS provider did not take the code for {Phone}", PhoneNumbers.Mask(phone));
            throw new ApiProblemException(StatusCodes.Status503ServiceUnavailable, OtpRules.Unavailable);
        }

        await transaction.CommitAsync(ct);
        if (global + 1 == (int)Math.Ceiling(Settings.GlobalDailyCap * 0.8))
        {
            logger.LogWarning("SMS codes in the last 24 hours reached 80% of Otp:GlobalDailyCap ({Count}/{Cap})", global + 1, Settings.GlobalDailyCap);
        }

        return new OtpChallengeDto(
            challenge.Id.ToString(),
            PhoneNumbers.Mask(phone)!,
            Settings.LifetimeSeconds,
            Settings.ResendSeconds,
            Settings.ExposeDemoCode ? code : null);
    }

    /// <summary>
    /// Checks a typed code: <c>{ ok: true }</c>, or ProblemDetails <c>otp.wrong-code</c> (with <c>attemptsLeft</c>),
    /// <c>otp.too-many-attempts</c> (<c>attemptsLeft: 0</c>) or <c>otp.expired</c> (also for an unknown or used
    /// challenge). A verified challenge answers ok again for the right code, so a retried request does no harm.
    /// </summary>
    public async Task VerifyAsync(string challengeIdInput, string codeInput, CancellationToken ct)
    {
        if (!Guid.TryParse(challengeIdInput, out var id))
        {
            throw ApiProblemException.BadRequest(AccountErrors.Expired);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var challenge = await LockAsync(id, ct);
        var now = clock.GetUtcNow();
        if (challenge is null || challenge.ConsumedAt is not null || (challenge.VerifiedAt is null && challenge.ExpiresAt <= now))
        {
            throw ApiProblemException.BadRequest(AccountErrors.Expired);
        }

        if (challenge.Attempts >= Settings.MaxAttempts)
        {
            throw AttemptsLeft(AccountErrors.TooManyAttempts, 0);
        }

        var code = codeInput.Trim();
        if (OtpRules.IsWellFormed(code, Settings.CodeLength) && hash.OtpCodeMatches(challenge.Id, code, challenge.CodeHash))
        {
            challenge.VerifiedAt ??= now;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return;
        }

        challenge.Attempts++;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        var left = Settings.MaxAttempts - challenge.Attempts;
        throw left > 0 ? AttemptsLeft(AccountErrors.WrongCode, left) : AttemptsLeft(AccountErrors.TooManyAttempts, 0);
    }

    /// <summary>
    /// Uses a verified challenge as proof of its phone number, once: inside the caller's transaction, which must save
    /// and commit. Refused (<c>400 otp.not-verified</c>) unless it is verified, unused, of <paramref name="purpose"/>,
    /// verified less than <c>Otp:VerifiedLifetimeSeconds</c> ago and, when given, for <paramref name="phone"/>.
    /// The row stays locked until the caller's transaction ends, so two requests cannot both use it.
    /// </summary>
    public async Task<OtpChallenge> ConsumeAsync(string challengeIdInput, OtpPurpose purpose, string? phone, CancellationToken ct)
    {
        var challenge = Guid.TryParse(challengeIdInput, out var id) ? await LockAsync(id, ct) : null;
        var now = clock.GetUtcNow();
        var usable = challenge is { ConsumedAt: null, VerifiedAt: { } verified }
            && challenge.Purpose == purpose
            && verified.AddSeconds(Settings.VerifiedLifetimeSeconds) > now
            && (phone is null || challenge.Phone == phone);
        if (!usable)
        {
            throw ApiProblemException.BadRequest(AccountErrors.NotVerified);
        }

        challenge!.ConsumedAt = now;
        return challenge;
    }

    private Task<OtpChallenge?> LockAsync(Guid id, CancellationToken ct) =>
        db.OtpChallenges.FromSql($"SELECT * FROM otp_challenges WHERE id = {id} FOR UPDATE").FirstOrDefaultAsync(ct);

    private static ApiProblemException AttemptsLeft(string code, int left) =>
        ApiProblemException.BadRequest(code, new Dictionary<string, object> { ["attemptsLeft"] = left });

    private ApiProblemException Refused(OtpRefusal refusal, int global)
    {
        if (refusal.Code == OtpRules.Unavailable)
        {
            logger.LogError("SMS codes refused: Otp:GlobalDailyCap reached ({Count} in the last 24 hours, cap {Cap})", global, Settings.GlobalDailyCap);
            return new ApiProblemException(StatusCodes.Status503ServiceUnavailable, refusal.Code);
        }

        return new ApiProblemException(StatusCodes.Status429TooManyRequests, refusal.Code, retryAfter: refusal.RetryAfter);
    }
}
