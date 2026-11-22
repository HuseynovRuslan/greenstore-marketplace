using GreenStore.Api.Data;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

public sealed class MigrationTests(PostgresDatabase database)
{
    [Fact]
    public async Task Every_migration_is_applied_to_the_test_database()
    {
        await using var db = database.CreateDbContext();

        Assert.Empty(await db.Database.GetPendingMigrationsAsync(Ct));
        Assert.Contains(await db.Database.GetAppliedMigrationsAsync(Ct), m => m.EndsWith("_Initial", StringComparison.Ordinal));
    }

    [Fact]
    public void The_model_has_no_changes_missing_a_migration()
    {
        // Fails when an entity changed without "dotnet ef migrations add".
        using var db = database.CreateDbContext();
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task Pg_trgm_is_installed() =>
        Assert.Equal(1L, await database.ScalarAsync<long>("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'"));

    [Fact]
    public async Task Migration_history_uses_snake_case()
    {
        Assert.Equal(1L, await database.ScalarAsync<long>(
            "SELECT count(*) FROM information_schema.columns WHERE table_name = '__ef_migrations_history' AND column_name = 'migration_id'"));
    }

    [Fact]
    public async Task Test_database_is_utf8_with_a_unicode_aware_locale()
    {
        // pg_trgm needs a Unicode-aware locale (C.UTF-8 or ICU) to treat Cyrillic and Azerbaijani letters as word
        // characters (DATABASE.md §2). In the C locale both checks below fail: no trigrams, similarity 0.
        Assert.Equal("UTF8", await database.ScalarAsync<string>("SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()"));
        Assert.True(await database.ScalarAsync<bool>("SELECT similarity('Москва', 'МОСКВА') = 1"));
        Assert.True(await database.ScalarAsync<bool>("SELECT cardinality(show_trgm('ə')) > 0"));
    }

    [Fact]
    public async Task Migrating_a_new_database_logs_no_errors()
    {
        // EF used to log its first read of the not-yet-created history table as a failed command (Error level).
        await using var scratch = await database.CreateScratchDatabaseAsync("fresh");
        var log = new ErrorLog();
        await using var services = new ServiceCollection()
            .AddLogging(logging => logging.AddProvider(log))
            .AddDbContext<AppDbContext>(options => DatabaseSetup.Configure(options, scratch.ConnectionString))
            .BuildServiceProvider();

        await MigrationRunner.MigrateAsync(services, Ct);

        Assert.Empty(log.Errors);
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(Ct));
        Assert.Empty(log.Errors);
    }

    [Fact]
    public async Task Every_migration_rolls_back_to_an_empty_database()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync("down");
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch.ConnectionString);
        await using var db = new AppDbContext(options.Options);
        await db.Database.MigrateAsync(Ct);

        await db.GetService<IMigrator>().MigrateAsync(Migration.InitialDatabase, cancellationToken: Ct);

        Assert.Empty(await db.Database.GetAppliedMigrationsAsync(Ct));
        // Nothing but the (now empty) history table is left.
        var tables = await db.Database
            .SqlQuery<string>($"SELECT tablename AS \"Value\" FROM pg_tables WHERE schemaname = 'public'")
            .ToListAsync(Ct);
        Assert.Equal([DatabaseSetup.MigrationsHistoryTable], tables);
    }

    [Fact]
    public async Task Migrating_again_changes_nothing()
    {
        var services = new ServiceCollection()
            .AddLogging()
            .AddScoped(_ => database.CreateDbContext())
            .BuildServiceProvider();

        await MigrationRunner.MigrateAsync(services, Ct);

        await using var db = database.CreateDbContext();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(Ct));
    }
}
