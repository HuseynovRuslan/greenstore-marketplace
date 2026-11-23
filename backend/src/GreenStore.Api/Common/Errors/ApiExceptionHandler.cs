using System.Globalization;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Common.Errors;

/// <summary>Turns exceptions into ProblemDetails. Unexpected ones become a 500 without internals.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problems, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    /// <summary>Non-standard status (nginx) for a request the client abandoned; nothing is written.</summary>
    public const int ClientClosedRequest = 499;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            httpContext.Response.StatusCode = ClientClosedRequest;
            return true;
        }

        var problem = exception switch
        {
            ApiProblemException api => ProblemDetailsSetup.Create(api.Status, api.Code, api.Errors, api.Detail, api.Extensions),
            BadHttpRequestException bad => ProblemDetailsSetup.Create(bad.StatusCode, ErrorCodes.ForStatus(bad.StatusCode)),
            DbUpdateConcurrencyException => ProblemDetailsSetup.Create(StatusCodes.Status409Conflict, ErrorCodes.ConcurrencyConflict),
            // The rules' own refusals (Modules/*): plain exceptions, worded as ProblemDetails here.
            ListingTransitionException transition => ProblemDetailsSetup.Create(
                StatusCodes.Status409Conflict,
                ListingErrors.WrongStatus,
                extensions: new Dictionary<string, object> { ["listingStatus"] = KebabCase.Value(transition.Status) }),
            PhotoRejectedException photo => ProblemDetailsSetup.Create(MediaErrors.StatusOf(photo.Code), photo.Code),
            _ => ProblemDetailsSetup.Create(StatusCodes.Status500InternalServerError, ErrorCodes.Internal),
        };

        if (problem.Status >= 500)
        {
            logger.LogError(exception, "Unhandled exception on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else if (exception is not ApiProblemException)
        {
            logger.LogInformation("{Method} {Path} answered {Status}: {Message}", httpContext.Request.Method, httpContext.Request.Path, problem.Status, exception.Message);
        }

        httpContext.Response.StatusCode = problem.Status!.Value;
        if (exception is ApiProblemException { RetryAfter: { } retryAfter })
        {
            httpContext.Response.Headers.RetryAfter = RetryAfterSeconds(retryAfter).ToString(CultureInfo.InvariantCulture);
        }

        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    /// <summary>Whole seconds, rounded up, at least 1 (a <c>Retry-After: 0</c> would invite an instant retry).</summary>
    public static int RetryAfterSeconds(TimeSpan wait) => Math.Max(1, (int)Math.Ceiling(wait.TotalSeconds));
}
