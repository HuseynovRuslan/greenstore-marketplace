using Microsoft.Net.Http.Headers;

namespace GreenStore.Api.Common.Localization;

/// <summary>The language chosen for the current request (from <c>Accept-Language</c>).</summary>
public sealed record RequestLanguageFeature(Language Language);

public static class RequestLanguageExtensions
{
    /// <summary>The request's language: the one resolved by <see cref="RequestLanguageMiddleware"/>, else resolved now.</summary>
    public static Language GetLanguage(this HttpContext context) =>
        context.Features.Get<RequestLanguageFeature>()?.Language
        ?? LanguageResolver.FromAcceptLanguage(context.Request.Headers.AcceptLanguage);

    public static IApplicationBuilder UseRequestLanguage(this IApplicationBuilder app) => app.UseMiddleware<RequestLanguageMiddleware>();
}

/// <summary>
/// Resolves the language once per request and, for API responses, says which one was used:
/// <c>Content-Language: ru</c> and <c>Vary: Accept-Language</c>, so caches keep one copy per language (§8.2).
/// </summary>
public sealed class RequestLanguageMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var language = LanguageResolver.FromAcceptLanguage(context.Request.Headers.AcceptLanguage);
        context.Features.Set(new RequestLanguageFeature(language));

        if (context.Request.Path.StartsWithSegments("/api"))
        {
            // OnStarting: error responses clear the headers set before them; this runs after that.
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.ContentLanguage = language.Code();
                if (!headers.Vary.Contains(HeaderNames.AcceptLanguage))
                {
                    headers.Append(HeaderNames.Vary, HeaderNames.AcceptLanguage);
                }

                return Task.CompletedTask;
            });
        }

        return next(context);
    }
}
