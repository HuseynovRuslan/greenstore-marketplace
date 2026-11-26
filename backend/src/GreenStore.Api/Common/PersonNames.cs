using System.Text.RegularExpressions;

namespace GreenStore.Api.Common;

/// <summary>
/// A person's name as the forms take it (src/lib/names.ts <c>isPersonName</c>): an account's <c>fullName</c>, a
/// business's <c>contactPerson</c>, a listing's <c>contactName</c>, the name on «Bizimlə əlaqə». Letters of any
/// alphabet with a space, a hyphen (Məmməd-Əli), an apostrophe or a dot (an initial) between them; it starts with a
/// letter. A name with a digit or another symbol is the field error <c>invalid</c>.
/// </summary>
public static partial class PersonNames
{
    /// <summary>Whether the trimmed name has the shape above (an empty one does not: «required» is said apart).</summary>
    public static bool IsValid(string? name) => name is not null && Shape().IsMatch(name.Trim());

    [GeneratedRegex(@"^[\p{L}\p{M}](?:[\p{L}\p{M} '’.-]*[\p{L}\p{M}.])?$")]
    private static partial Regex Shape();
}
