using System.Diagnostics;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Common.Errors;

/// <summary>
/// Writes a problem as <c>application/problem+json</c> whatever the request's <c>Accept</c> header says.
/// <para>
/// ASP.NET Core's own writer runs first and answers clients that accept JSON or send no <c>Accept</c>. It refuses the
/// rest (a browser's or crawler's <c>text/html</c>, <c>application/xml</c>): without this writer they got an empty
/// body (no <c>code</c>), a text/plain status page, or a 500 for a 404 thrown from an endpoint. JSON is the API's only
/// representation, so errors are sent in it anyway (RFC 9110 §12.5.1 lets a server disregard <c>Accept</c>). The body
/// is the one the built-in writer would produce: the same defaults, <see cref="ProblemDetailsSetup"/>'s
/// customisation and the API's JSON options.
/// </para>
/// </summary>
internal sealed class ProblemJsonWriter(IOptions<ProblemDetailsOptions> problemOptions, IOptions<JsonOptions> jsonOptions)
    : IProblemDetailsWriter
{
    public const string ContentType = "application/problem+json";

    public bool CanWrite(ProblemDetailsContext context) => true;

    public ValueTask WriteAsync(ProblemDetailsContext context)
    {
        var http = context.HttpContext;
        var problem = context.ProblemDetails;
        problem.Status ??= http.Response.StatusCode;

        // What the built-in writer does before it customises: the framework's default type and title for the status
        // (TypedResults.Problem fills them into this instance), then the trace id. ProblemDetailsTests checks that
        // both writers produce the same body, key order included.
        _ = TypedResults.Problem(problem);
        problem.Extensions[ProblemDetailsSetup.TraceIdKey] = Activity.Current?.Id ?? http.TraceIdentifier;
        problemOptions.Value.CustomizeProblemDetails?.Invoke(context);

        return new ValueTask(http.Response.WriteAsJsonAsync(
            problem,
            problem.GetType(),
            jsonOptions.Value.SerializerOptions,
            ContentType,
            http.RequestAborted));
    }
}
