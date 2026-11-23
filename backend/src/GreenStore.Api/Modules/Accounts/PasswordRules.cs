using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// What a new password must be (ARCHITECTURE.md §14 and the site's <c>newPasswordError</c>,
/// src/features/auth/validation.ts): 8–128 characters with at least one letter and one digit.
/// </summary>
public static class PasswordRules
{
    public const int MinLength = 8;
    public const int MaxLength = 128;

    /// <summary>Null when the password is acceptable, else the error code for <c>errors.password</c>.</summary>
    public static string? Check(string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return FieldErrors.Required;
        }

        if (password.Length < MinLength)
        {
            return FieldErrors.TooShort;
        }

        if (password.Length > MaxLength)
        {
            return FieldErrors.TooLong;
        }

        return password.Any(char.IsLetter) && password.Any(char.IsDigit) ? null : AccountErrors.TooWeak;
    }
}

/// <summary>
/// Locking an account after wrong passwords (ARCHITECTURE.md §14): the 5th wrong password in a row locks it for 15
/// minutes. A correct password, a sign-in with an SMS code or a password reset clears the count. While locked, the
/// password is not even checked; signing in with an SMS code still works (that is the way back in).
/// </summary>
public static class LoginLockout
{
    public const int MaxFailures = 5;

    public static readonly TimeSpan Duration = TimeSpan.FromMinutes(15);

    /// <summary>How long the account stays locked; null when it is not.</summary>
    public static TimeSpan? LockedFor(User user, DateTimeOffset now) =>
        user.LockedUntil is { } until && until > now ? until - now : null;

    /// <summary>Counts a wrong password; true when this one locked the account.</summary>
    public static bool RecordFailure(User user, DateTimeOffset now)
    {
        user.FailedLogins++;
        if (user.FailedLogins < MaxFailures)
        {
            return false;
        }

        user.FailedLogins = 0;
        user.LockedUntil = now + Duration;
        return true;
    }

    public static void RecordSuccess(User user)
    {
        user.FailedLogins = 0;
        user.LockedUntil = null;
    }
}
