using System.Globalization;
using GreenStore.Api.Data;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;

[assembly: AssemblyFixture(typeof(PostgresDatabase))]

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// A fresh PostgreSQL database for one test run: created from template0 (UTF8, C.UTF-8 or ICU) on the server named by
/// <c>GREENSTORE_TEST_DB</c>, migrated, and dropped when the run ends. Databases left behind by crashed runs are
/// dropped after <see cref="StaleAfter"/>.
/// </summary>
public sealed class PostgresDatabase : IAsyncLifetime
{
    public const string EnvironmentVariable = "GREENSTORE_TEST_DB";
    public const string DefaultServer = "Host=localhost;Port=5432;Database=postgres;Username=greenstore;Password=greenstore_dev";
    private const string Prefix = "greenstore_test_";
    private static readonly TimeSpan StaleAfter = TimeSpan.FromHours(6);

    public PostgresDatabase()
    {
        var configured = Environment.GetEnvironmentVariable(EnvironmentVariable);
        ServerConnectionString = string.IsNullOrWhiteSpace(configured) ? DefaultServer : configured;
        DatabaseName = string.Create(
            CultureInfo.InvariantCulture,
            $"{Prefix}{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}_{Guid.NewGuid().ToString("N")[..12]}");
        ConnectionString = new NpgsqlConnectionStringBuilder(ServerConnectionString) { Database = DatabaseName }.ConnectionString;
        MediaRoot = Path.Combine(Path.GetTempPath(), "greenstore-test-media", DatabaseName);
    }

    /// <summary>The run's photo storage (Media:LocalPath of the test API), deleted at the end of the run.</summary>
    public string MediaRoot { get; }

    /// <summary>The maintenance database of the server (not migrated; used to test an un-migrated database).</summary>
    public string ServerConnectionString { get; }

    public string DatabaseName { get; }

    public string ConnectionString { get; }

    public async ValueTask InitializeAsync()
    {
        await using (var server = new NpgsqlConnection(ServerConnectionString))
        {
            await server.OpenAsync();
            await DropStaleDatabasesAsync(server);
            await CreateDatabaseAsync(server, DatabaseName);
        }

        await using var db = CreateDbContext();
        await db.Database.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (Directory.Exists(MediaRoot))
        {
            Directory.Delete(MediaRoot, recursive: true);
        }

        NpgsqlConnection.ClearAllPools();
        await using var server = new NpgsqlConnection(ServerConnectionString);
        await server.OpenAsync();
        await ExecuteAsync(server, $"DROP DATABASE IF EXISTS \"{DatabaseName}\" WITH (FORCE)");
    }

    /// <summary>A context on the test database, with the API's provider settings and updated_at interceptor.</summary>
    public AppDbContext CreateDbContext(TimeProvider? clock = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, ConnectionString);
        options.AddInterceptors(new UpdatedAtInterceptor(clock ?? TimeProvider.System));
        return new AppDbContext(options.Options);
    }

    /// <summary>Another empty database on the same server (not migrated), dropped when the result is disposed.</summary>
    public async Task<ScratchDatabase> CreateScratchDatabaseAsync(string suffix)
    {
        var name = $"{DatabaseName}_{suffix}";
        await using var server = new NpgsqlConnection(ServerConnectionString);
        await server.OpenAsync();
        await CreateDatabaseAsync(server, name);
        return new ScratchDatabase(
            new NpgsqlConnectionStringBuilder(ServerConnectionString) { Database = name }.ConnectionString,
            async () =>
            {
                NpgsqlConnection.ClearAllPools();
                await using var cleanup = new NpgsqlConnection(ServerConnectionString);
                await cleanup.OpenAsync();
                await ExecuteAsync(cleanup, $"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)");
            });
    }

    public async Task<T?> ScalarAsync<T>(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        var value = await command.ExecuteScalarAsync();
        return value is null or DBNull ? default : (T)value;
    }

    /// <summary>
    /// UTF-8 with a Unicode-aware locale, which pg_trgm needs (DATABASE.md §2): C.UTF-8 where the server's operating
    /// system has it (Linux, Docker, CI), else ICU. PostgreSQL installed locally on macOS or Windows usually has no
    /// C.UTF-8; the ICU database then takes its character classes from the server's own (UTF-8) default locale.
    /// </summary>
    private static async Task CreateDatabaseAsync(NpgsqlConnection server, string name)
    {
        try
        {
            await ExecuteAsync(server, $"CREATE DATABASE \"{name}\" TEMPLATE template0 ENCODING 'UTF8' LOCALE 'C.UTF-8'");
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.WrongObjectType)
        {
            // "invalid LC_COLLATE locale name: C.UTF-8"
            await ExecuteAsync(server, $"CREATE DATABASE \"{name}\" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'und'");
        }
    }

    private static async Task DropStaleDatabasesAsync(NpgsqlConnection server)
    {
        var stale = new List<string>();
        await using (var command = new NpgsqlCommand("SELECT datname FROM pg_database WHERE datname LIKE 'greenstore\\_test\\_%'", server))
        await using (var reader = await command.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                var name = reader.GetString(0);
                var parts = name[Prefix.Length..].Split('_');
                if (long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var created)
                    && DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(created) > StaleAfter)
                {
                    stale.Add(name);
                }
            }
        }

        foreach (var name in stale)
        {
            try
            {
                await ExecuteAsync(server, $"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)");
            }
            catch (PostgresException)
            {
                // Owned by another role or in use by another run: leave it.
            }
        }
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}

/// <summary>A database of <see cref="PostgresDatabase.CreateScratchDatabaseAsync"/>; dropped on dispose.</summary>
public sealed class ScratchDatabase(string connectionString, Func<Task> drop) : IAsyncDisposable
{
    public string ConnectionString { get; } = connectionString;

    public async ValueTask DisposeAsync() => await drop();
}
