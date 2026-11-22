using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Data;

/// <summary>The database connection: <c>ConnectionStrings:Default</c> (environment <c>ConnectionStrings__Default</c>).</summary>
public sealed class DatabaseOptions
{
    public string ConnectionString { get; set; } = string.Empty;
}

public static class DatabaseSetup
{
    public const string ConnectionStringName = "Default";

    /// <summary>EF's migration history table, snake_case like every other table.</summary>
    public const string MigrationsHistoryTable = "__ef_migrations_history";

    /// <summary>
    /// Registers <see cref="AppDbContext"/> (Npgsql, snake_case names, the updated_at interceptor). The connection
    /// string is read from configuration when the host starts, so test hosts can override it. Without one the API
    /// refuses to start (and the <c>migrate</c> command fails) instead of answering every request with a 500.
    /// </summary>
    public static IServiceCollection AddDatabase(this IServiceCollection services)
    {
        services.AddOptions<DatabaseOptions>()
            .Configure<IConfiguration>((o, configuration) =>
                o.ConnectionString = configuration.GetConnectionString(ConnectionStringName) ?? string.Empty)
            .Validate(
                o => !string.IsNullOrWhiteSpace(o.ConnectionString),
                $"ConnectionStrings:{ConnectionStringName} is not set (environment variable ConnectionStrings__{ConnectionStringName}).")
            .ValidateOnStart();

        services.AddSingleton<UpdatedAtInterceptor>();
        services.AddDbContext<AppDbContext>((provider, options) =>
        {
            Configure(options, provider.GetRequiredService<IOptions<DatabaseOptions>>().Value.ConnectionString);
            options.AddInterceptors(provider.GetRequiredService<UpdatedAtInterceptor>());
        });
        return services;
    }

    /// <summary>The provider settings every context of the API uses (also the design-time factory and tests).</summary>
    public static DbContextOptionsBuilder Configure(DbContextOptionsBuilder options, string connectionString) =>
        options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(MigrationsHistoryTable))
            .UseSnakeCaseNamingConvention();
}
