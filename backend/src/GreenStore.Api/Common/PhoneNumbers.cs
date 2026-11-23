namespace GreenStore.Api.Common;

/// <summary>Azerbaijani phone numbers, stored in E.164 (<c>+994505551234</c>, DATABASE.md §2).</summary>
public static class PhoneNumbers
{
    /// <summary>
    /// Operator codes of Azerbaijani mobile numbers (Azercell 10, 50, 51; Bakcell 55, 99; Nar 70, 77; Naxtel 60).
    /// SMS codes go to these only (ARCHITECTURE.md §14); landlines (12, 2x) can be a listing's contact, not an account.
    /// </summary>
    public static readonly IReadOnlySet<string> MobilePrefixes = new HashSet<string>(StringComparer.Ordinal)
    {
        "10", "50", "51", "55", "60", "70", "77", "99",
    };

    /// <summary>
    /// The number as public responses show it before «Nömrəni göstər»: <c>+994505551234</c> → <c>+994 50 *** ** 34</c>
    /// (backend-contract.md 3.1). The whole number is only ever returned by the phone-reveal endpoints.
    /// Null for anything that is not an E.164 Azerbaijani number.
    /// </summary>
    public static string? Mask(string? e164)
    {
        if (!IsE164(e164))
        {
            return null;
        }

        return $"+994 {e164![4..6]} *** ** {e164[11..]}";
    }

    /// <summary>
    /// A typed or pasted Azerbaijani number in E.164, or null when it is not one. Spaces, dashes, dots and brackets are
    /// ignored; the number may start with +994, 994, 0 or the operator code: <c>+994 50 555 12 34</c>,
    /// <c>(050) 555-12-34</c>, <c>505551234</c> → <c>+994505551234</c> (the forms' <c>localDigits</c>, src/lib/phone.ts).
    /// </summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 30)
        {
            return null;
        }

        var digits = new System.Text.StringBuilder(value.Length);
        var trimmed = value.Trim();
        for (var i = 0; i < trimmed.Length; i++)
        {
            var ch = trimmed[i];
            if (char.IsAsciiDigit(ch))
            {
                digits.Append(ch);
            }
            else if (ch == '+' && i == 0)
            {
                continue;
            }
            else if (ch is not (' ' or '-' or '.' or '(' or ')'))
            {
                return null;
            }
        }

        var d = digits.ToString();
        if (d.Length == 12 && d.StartsWith("994", StringComparison.Ordinal))
        {
            d = d[3..];
        }
        else if (d.Length == 10 && d.StartsWith('0'))
        {
            d = d[1..];
        }

        return d.Length == 9 && d[0] != '0' ? "+994" + d : null;
    }

    /// <summary>An E.164 Azerbaijani mobile number (<see cref="MobilePrefixes"/>).</summary>
    public static bool IsMobile(string? e164) => IsE164(e164) && MobilePrefixes.Contains(e164![4..6]);

    private static bool IsE164(string? value) =>
        value is { Length: 13 } && value.StartsWith("+994", StringComparison.Ordinal) && value.AsSpan(4).ContainsOnlyDigits();

    private static bool ContainsOnlyDigits(this ReadOnlySpan<char> value)
    {
        foreach (var ch in value)
        {
            if (ch is < '0' or > '9')
            {
                return false;
            }
        }

        return true;
    }
}
