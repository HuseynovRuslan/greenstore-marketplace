namespace GreenStore.Api.Common.Errors;

/// <summary>
/// Collects the field errors of a request body, so one 400 <c>validation</c> names every bad field
/// (<c>errors: { "password": ["too-weak"], "email": ["invalid"] }</c>). The first error of a field is kept.
/// </summary>
public sealed class FieldErrors
{
    /* The field error codes every module uses; module-specific ones live next to their module. */

    public const string Required = "required";
    public const string Invalid = "invalid";
    public const string TooShort = "too-short";
    public const string TooLong = "too-long";

    private readonly Dictionary<string, string[]> errors = new(StringComparer.Ordinal);

    public bool Any => errors.Count > 0;

    /// <summary>Records <paramref name="code"/> for <paramref name="field"/>; a null code is no error.</summary>
    public void Add(string field, string? code)
    {
        if (code is not null && !errors.ContainsKey(field))
        {
            errors[field] = [code];
        }
    }

    public void ThrowIfAny()
    {
        if (errors.Count > 0)
        {
            throw ApiProblemException.Validation(errors);
        }
    }
}
