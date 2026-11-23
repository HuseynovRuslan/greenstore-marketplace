namespace GreenStore.Api.Common.Errors;

/// <summary>
/// Stable error codes sent in the "code" field of every ProblemDetails response. Clients (the Next.js site, the
/// mobile app) choose the message text by code, so a code never changes once released. Module-specific codes use a
/// "module.reason" form (e.g. "otp.wrong-code", "listing.not-editable") and live next to their module.
/// </summary>
public static class ErrorCodes
{
    public const string Validation = "validation";
    public const string BadRequest = "bad-request";
    public const string Unauthorized = "unauthorized";
    public const string Forbidden = "forbidden";
    public const string NotFound = "not-found";
    public const string MethodNotAllowed = "method-not-allowed";
    public const string NotAcceptable = "not-acceptable";
    public const string Conflict = "conflict";
    public const string ConcurrencyConflict = "concurrency-conflict";
    public const string PayloadTooLarge = "payload-too-large";
    public const string UnsupportedMediaType = "unsupported-media-type";
    public const string RateLimited = "rate-limited";
    public const string Internal = "internal-error";
    public const string Unavailable = "unavailable";
    public const string Error = "error";

    /// <summary>The generic code for a status when the endpoint did not set a more specific one.</summary>
    public static string ForStatus(int status) => status switch
    {
        400 => BadRequest,
        401 => Unauthorized,
        403 => Forbidden,
        404 => NotFound,
        405 => MethodNotAllowed,
        406 => NotAcceptable,
        409 => Conflict,
        413 => PayloadTooLarge,
        415 => UnsupportedMediaType,
        422 => Validation,
        429 => RateLimited,
        500 => Internal,
        503 => Unavailable,
        _ => Error,
    };
}
