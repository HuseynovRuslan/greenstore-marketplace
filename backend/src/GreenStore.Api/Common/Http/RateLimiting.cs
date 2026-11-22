using System.Globalization;
using System.Threading.RateLimiting;
using GreenStore.Api.Common.Errors;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Common.Http;

/// <summary>Limits from configuration (section "RateLimiting").</summary>
public sealed class RateLimitingOptions
{
    public const string Section = "RateLimiting";

    public FixedWindowLimit AnonymousWrites { get; set; } = new() { PermitLimit = 20, WindowSeconds = 60 };

    /// <summary>«Baxış» notices of listing pages, per client IP.</summary>
    public FixedWindowLimit Views { get; set; } = new() { PermitLimit = 120, WindowSeconds = 60 };

    /// <summary>«Nömrəni göstər», per client IP: low, so the numbers cannot be scraped (ARCHITECTURE.md §14).</summary>
    public FixedWindowLimit PhoneReveals { get; set; } = new() { PermitLimit = 30, WindowSeconds = 600 };
}

public sealed class FixedWindowLimit
{
    public int PermitLimit { get; set; }

    public int WindowSeconds { get; set; }
}

/// <summary>
/// Named rate-limit policies (ASP.NET Core's built-in limiter, ARCHITECTURE.md §14). Endpoints opt in with
/// <c>.RequireRateLimiting(RateLimitPolicies.AnonymousWrites)</c>. Counters are per process; with more than one API
/// instance each counts separately, which is acceptable at this size (§13).
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>POSTs a visitor can make without logging in (reports, «Usta çağır», support), per client IP.</summary>
    public const string AnonymousWrites = "anonymous-writes";

    /// <summary><c>POST /listings/{id}/views</c>, per client IP.</summary>
    public const string Views = "views";

    /// <summary>The phone-reveal endpoints, per client IP.</summary>
    public const string PhoneReveals = "phone-reveals";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddOptions<RateLimitingOptions>()
            .BindConfiguration(RateLimitingOptions.Section)
            .Validate(
                o => new[] { o.AnonymousWrites, o.Views, o.PhoneReveals }.All(l => l.PermitLimit > 0 && l.WindowSeconds > 0),
                "RateLimiting limits must be positive.")
            .ValidateOnStart();

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.OnRejected = OnRejectedAsync;
            limiter.AddPolicy(AnonymousWrites, AnonymousWritesPartition);
            limiter.AddPolicy(Views, context => PerIp(context, o => o.Views));
            limiter.AddPolicy(PhoneReveals, context => PerIp(context, o => o.PhoneReveals));
        });
        return services;
    }

    /// <summary>One fixed window per client IP (IPv6: per /64), see <see cref="ClientIpResolver.PartitionKey"/>.</summary>
    public static RateLimitPartition<string> AnonymousWritesPartition(HttpContext context) =>
        PerIp(context, o => o.AnonymousWrites);

    private static RateLimitPartition<string> PerIp(HttpContext context, Func<RateLimitingOptions, FixedWindowLimit> select)
    {
        var limit = select(context.RequestServices.GetRequiredService<IOptions<RateLimitingOptions>>().Value);
        return RateLimitPartition.GetFixedWindowLimiter(
            ClientIpResolver.PartitionKey(context.GetClientIp().Address),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = limit.PermitLimit,
                Window = TimeSpan.FromSeconds(limit.WindowSeconds),
                QueueLimit = 0,
            });
    }

    /// <summary>429 as ProblemDetails with code "rate-limited" and, when the limiter knows it, <c>Retry-After</c>.</summary>
    public static async ValueTask OnRejectedAsync(OnRejectedContext context, CancellationToken cancellationToken)
    {
        var http = context.HttpContext;
        http.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
            http.Response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
        }

        var problems = http.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = http,
            ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Extensions = { [ProblemDetailsSetup.CodeKey] = ErrorCodes.RateLimited } },
        });
    }
}
