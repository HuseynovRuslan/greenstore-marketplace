namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// The stable codes of the accounts endpoints: the ProblemDetails <c>code</c> (<c>module.reason</c>) and the field
/// error codes in <c>errors</c>. Clients choose their message by these; a code never changes once released.
/// </summary>
public static class AccountErrors
{
    /* ProblemDetails codes */

    /// <summary>400: the code is not the one sent; <c>attemptsLeft</c> says how many tries remain.</summary>
    public const string WrongCode = "otp.wrong-code";

    /// <summary>400: the code's 5 minutes are over, or there is no such challenge (or it was already used).</summary>
    public const string Expired = "otp.expired";

    /// <summary>400: five wrong codes; a new code must be asked for. <c>attemptsLeft: 0</c>.</summary>
    public const string TooManyAttempts = "otp.too-many-attempts";

    /// <summary>400: the challenge given as proof is not a verified, unused code of this purpose (and number).</summary>
    public const string NotVerified = "otp.not-verified";

    /// <summary>409: another account has this phone number.</summary>
    public const string PhoneTaken = "account.phone-taken";

    /// <summary>409: another account has this e-mail.</summary>
    public const string EmailTaken = "account.email-taken";

    /// <summary>404: no account has this number (an SMS code for signing in or a password reset).</summary>
    public const string AccountNotFound = "account.not-found";

    /// <summary>401: the login or the password is wrong (never says which).</summary>
    public const string WrongCredentials = "auth.wrong-credentials";

    /// <summary>423: too many wrong passwords; <c>Retry-After</c> says when the account opens again.</summary>
    public const string Locked = "auth.locked";

    /// <summary>403: the account is blocked by GreenStore.</summary>
    public const string Blocked = "auth.blocked";

    /// <summary>429: too many wrong passwords from this IP; <c>Retry-After</c>.</summary>
    public const string TooManyLoginAttempts = "auth.too-many-attempts";

    /// <summary>400: the current password given to change it is wrong.</summary>
    public const string WrongPassword = "auth.wrong-password";

    public const string SessionNotFound = "session.not-found";

    /* Field error codes (errors: { field: [code] }) */

    // Also the common ones of Common.Errors.FieldErrors: required, invalid, too-short, too-long.

    /// <summary>A password without a letter or without a digit.</summary>
    public const string TooWeak = "too-weak";

    /// <summary>A number that is not an Azerbaijani mobile number (SMS codes go to mobiles only).</summary>
    public const string NotMobile = "not-mobile";
}
