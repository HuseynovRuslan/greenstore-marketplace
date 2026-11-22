using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace GreenStore.Api.Data;

/// <summary>
/// Applies EF Core migrations. Runs only when asked: <c>dotnet run -- migrate</c> (the deploy step), or at startup in
/// Development (<c>Database:MigrateOnStartup</c>). Never implicitly in Staging or Production (DATABASE.md §6).
/// </summary>
public static class MigrationRunner
{
    public const string Command = "migrate";

    public static async Task MigrateAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(MigrationRunner));

        // On a new database EF reads the history table before creating it and logs that read as a failed command at
        // Error level, although the migration then succeeds. Creating the table first (IF NOT EXISTS, which Migrate
        // does anyway) keeps the deploy log free of false errors.
        await db.GetService<IHistoryRepository>().CreateIfNotExistsAsync(cancellationToken);

        var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).ToList();
        if (pending.Count == 0)
        {
            logger.LogInformation("Database is up to date");
            return;
        }

        logger.LogInformation("Applying {Count} migration(s): {Migrations}", pending.Count, string.Join(", ", pending));
        await db.Database.MigrateAsync(cancellationToken);
        logger.LogInformation("Migrations applied");
    }

    /// <summary>True when the API should migrate as it starts: Development only, and only when configured.</summary>
    public static bool ShouldMigrateOnStartup(IHostEnvironment environment, IConfiguration configuration) =>
        environment.IsDevelopment() && configuration.GetValue<bool>("Database:MigrateOnStartup");
}
