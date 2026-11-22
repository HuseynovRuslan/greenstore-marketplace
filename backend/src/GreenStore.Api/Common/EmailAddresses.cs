using System.Text.RegularExpressions;

namespace GreenStore.Api.Common;

/// <summary>E-mail addresses as the forms accept them (src/features/auth/validation.ts <c>EMAIL_RE</c>).</summary>
public static partial class EmailAddresses
{
    public const int MaxLength = 254;

    /// <summary>
    /// The trimmed address and the error code for it: <c>(null, null)</c> for an empty one (no e-mail),
    /// <c>"invalid"</c> or <c>"too-long"</c> for one that cannot be used.
    /// </summary>
    public static (string? Value, string? Error) Clean(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return (null, null);
        }

        if (trimmed.Length > MaxLength)
        {
            return (null, "too-long");
        }

        return Shape().IsMatch(trimmed) ? (trimmed, null) : (null, "invalid");
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")]
    private static partial Regex Shape();
}
