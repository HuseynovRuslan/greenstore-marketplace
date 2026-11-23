using System.Text.Json;
using GreenStore.Api.Data;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace GreenStore.Api.Common.Health;

/// <summary>
/// <c>/health/live</c>: the process answers (no dependencies checked).
/// <c>/health/ready</c>: the database answers and has every migration this build expects, so a new instance gets
/// traffic only after the deploy's migration step (ARCHITECTURE.md §16). 200 when healthy, 503 otherwise.
/// </summary>
public static class HealthSetup
{
    public const string LivePath = "/health/live";
    public const string ReadyPath = "/health/ready";
    private const string ReadyTag = "ready";

    public static IServiceCollection AddApiHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>("database", HealthStatus.Unhealthy, [ReadyTag], TimeSpan.FromSeconds(5));
        return services;
    }

    public static IEndpointRouteBuilder MapApiHealthChecks(this IEndpointRouteBuilder app)
    {
        // Probes read; any other method is a 405 problem.
        var getOrHead = new HttpMethodMetadata([HttpMethods.Get, HttpMethods.Head]);
        app.MapHealthChecks(LivePath, new HealthCheckOptions { Predicate = _ => false, ResponseWriter = WriteAsync })
            .WithMetadata(getOrHead);
        app.MapHealthChecks(ReadyPath, new HealthCheckOptions { Predicate = c => c.Tags.Contains(ReadyTag), ResponseWriter = WriteAsync })
            .WithMetadata(getOrHead);
        return app;
    }

    /// <summary><c>{"status":"healthy","checks":{"database":"healthy"}}</c>; no exception details.</summary>
    private static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";
        context.Response.Headers.CacheControl = "no-store";
        var body = new
        {
            status = Name(report.Status),
            checks = report.Entries.ToDictionary(e => e.Key, e => Name(e.Value.Status)),
        };
        return JsonSerializer.SerializeAsync(context.Response.Body, body, cancellationToken: context.RequestAborted);
    }

    private static string Name(HealthStatus status) => status switch
    {
        HealthStatus.Healthy => "healthy",
        HealthStatus.Degraded => "degraded",
        _ => "unhealthy",
    };
}

internal sealed class DatabaseHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!await db.Database.CanConnectAsync(cancellationToken))
            {
                return HealthCheckResult.Unhealthy("database unreachable");
            }

            // A database that has never been migrated has no history table yet. EF's pending-migrations check would
            // read it anyway (the provider swallows the "undefined table" error) and log that read at Error level on
            // every probe. Without the table, every migration of this build is pending.
            var pending = await HistoryTableExistsAsync(cancellationToken)
                ? await db.Database.GetPendingMigrationsAsync(cancellationToken)
                : db.Database.GetMigrations();
            return pending.Any()
                ? HealthCheckResult.Unhealthy("pending migrations")
                : HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("database check failed", exception);
        }
    }

    /// <summary>Looks the table up (on the search path, as EF does) without reading it; a probe never writes.</summary>
    private Task<bool> HistoryTableExistsAsync(CancellationToken cancellationToken) =>
        db.Database
            .SqlQuery<bool>($"SELECT to_regclass({DatabaseSetup.MigrationsHistoryTable}) IS NOT NULL AS \"Value\"")
            .SingleAsync(cancellationToken);
}
