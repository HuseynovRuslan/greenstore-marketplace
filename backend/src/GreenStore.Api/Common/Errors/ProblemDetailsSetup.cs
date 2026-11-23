using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace GreenStore.Api.Common.Errors;

/// <summary>
/// Every error is an RFC 9457 ProblemDetails (<c>application/problem+json</c>) of one shape:
/// <code>
/// { "type", "title", "status", "detail"?, "instance", "code", "errors"?, "traceId" }
/// </code>
/// <c>code</c> is always present and stable (<see cref="ErrorCodes"/>); <c>errors</c> maps request fields to error
/// codes. Clients show text chosen by code, never <c>title</c> or <c>detail</c> (ARCHITECTURE.md §7).
/// </summary>
public static class ProblemDetailsSetup
{
    public const string CodeKey = "code";
    public const string ErrorsKey = "errors";
    public const string TraceIdKey = "traceId";

    /// <summary>
    /// <c>type</c> of the statuses the API answers that ASP.NET has no link for, in the framework's own form (its
    /// links point to RFC 9110 sections): the section that defines the status.
    /// </summary>
    private static readonly Dictionary<int, string> TypeLinks = new()
    {
        [StatusCodes.Status410Gone] = "https://tools.ietf.org/html/rfc9110#section-15.5.11",
        [StatusCodes.Status413PayloadTooLarge] = "https://tools.ietf.org/html/rfc9110#section-15.5.14",
        [StatusCodes.Status423Locked] = "https://tools.ietf.org/html/rfc4918#section-11.3",
        [StatusCodes.Status429TooManyRequests] = "https://tools.ietf.org/html/rfc6585#section-4",
    };

    public static IServiceCollection AddApiProblemDetails(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        {
            var problem = context.ProblemDetails;
            var http = context.HttpContext;
            problem.Status ??= http.Response.StatusCode;
            problem.Instance ??= http.Request.PathBase + http.Request.Path;
            // ASP.NET fills type and title for common statuses only (not 413, 423 or 429): the rest link to the RFC
            // that defines them too, so every error looks alike. RFC 9457 §4.2.1: "about:blank" means the problem is
            // just what the status says.
            problem.Type ??= TypeLinks.GetValueOrDefault(problem.Status.Value, "about:blank");
            problem.Title ??= ReasonPhrases.GetReasonPhrase(problem.Status.Value);

            if (!problem.Extensions.ContainsKey(CodeKey))
            {
                problem.Extensions[CodeKey] = problem is HttpValidationProblemDetails
                    ? ErrorCodes.Validation
                    : ErrorCodes.ForStatus(problem.Status.Value);
            }

            if (!problem.Extensions.ContainsKey(TraceIdKey))
            {
                problem.Extensions[TraceIdKey] = Activity.Current?.Id ?? http.TraceIdentifier;
            }
        });
        // After the built-in writer (writers are tried in registration order): it takes the requests it refuses.
        services.AddSingleton<IProblemDetailsWriter, ProblemJsonWriter>();
        services.AddExceptionHandler<ApiExceptionHandler>();
        return services;
    }

    /// <summary>
    /// A ProblemDetails with the given status and code (and field errors and extra members, when there are any).
    /// </summary>
    public static ProblemDetails Create(
        int status,
        string code,
        IReadOnlyDictionary<string, string[]>? errors = null,
        string? detail = null,
        IReadOnlyDictionary<string, object>? extensions = null)
    {
        var problem = new ProblemDetails { Status = status, Detail = detail };
        problem.Extensions[CodeKey] = code;
        if (errors is { Count: > 0 })
        {
            problem.Extensions[ErrorsKey] = errors;
        }

        foreach (var (name, value) in extensions ?? new Dictionary<string, object>())
        {
            problem.Extensions[name] = value;
        }

        return problem;
    }
}
