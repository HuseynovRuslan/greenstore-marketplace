namespace GreenStore.Api.Common.Errors;

/// <summary>
/// An expected failure that becomes an RFC 9457 ProblemDetails response with a stable <see cref="Code"/>.
/// Thrown from services when a business rule refuses a request; <see cref="ApiExceptionHandler"/> writes it.
/// </summary>
public sealed class ApiProblemException : Exception
{
    public ApiProblemException(
        int status,
        string code,
        IReadOnlyDictionary<string, string[]>? errors = null,
        string? detail = null,
        IReadOnlyDictionary<string, object>? extensions = null,
        TimeSpan? retryAfter = null)
        : base(detail ?? code)
    {
        Status = status;
        Code = code;
        Errors = errors;
        Detail = detail;
        Extensions = extensions;
        RetryAfter = retryAfter;
    }

    public int Status { get; }

    public string Code { get; }

    /// <summary>Field errors: field name (camelCase, as in the request JSON) → error codes.</summary>
    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    /// <summary>Optional developer-facing explanation. Clients show text chosen by <see cref="Code"/>, not this.</summary>
    public string? Detail { get; }

    /// <summary>Extra members of the problem (camelCase), e.g. <c>attemptsLeft</c> of a wrong SMS code.</summary>
    public IReadOnlyDictionary<string, object>? Extensions { get; }

    /// <summary>Sent as the <c>Retry-After</c> header (whole seconds, at least 1): when trying again can succeed.</summary>
    public TimeSpan? RetryAfter { get; }

    public static ApiProblemException NotFound(string code = ErrorCodes.NotFound) => new(StatusCodes.Status404NotFound, code);

    public static ApiProblemException Conflict(string code) => new(StatusCodes.Status409Conflict, code);

    public static ApiProblemException Validation(IReadOnlyDictionary<string, string[]> errors) =>
        new(StatusCodes.Status400BadRequest, ErrorCodes.Validation, errors);

    /// <summary>One field with one error code (<c>{ "phone": ["not-mobile"] }</c>).</summary>
    public static ApiProblemException Validation(string field, string error) =>
        Validation(new Dictionary<string, string[]> { [field] = [error] });

    public static ApiProblemException BadRequest(string code, IReadOnlyDictionary<string, object>? extensions = null) =>
        new(StatusCodes.Status400BadRequest, code, extensions: extensions);
}
