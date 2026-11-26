using GreenStore.Api.Data;
using GreenStore.Api.Data.Seed;
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
    public async Task ServiceTypes_starts_every_listings_list_with_its_sub_category()
    {
        // A database as it was before the migration, with a listing that has a sub-category and one that has none.
        await using var scratch = await database.CreateScratchDatabaseAsync("service_types");
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch.ConnectionString);
        await using var db = new AppDbContext(options.Options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261124135023_MultipleBusinessKinds", cancellationToken: Ct);
        await ReferenceSeeder.SeedAsync(db, Path.Combine(AppContext.BaseDirectory, "seed"), Ct);
        await db.Database.ExecuteSqlRawAsync(
            """
            INSERT INTO users (id, phone, full_name, account_type, password_hash)
            VALUES ('019a8b4e-0000-7000-8000-0000000000aa', '+994509999998', 'Test', 'individual', 'x');
            INSERT INTO listings (id, number, slug, kind, owner_user_id, category_id, subcategory_id, city_id, status, title,
                                  price_type, price, contact_name, contact_phone, contact_phone_verified)
            VALUES (gen_random_uuid(), 1, 'alma-1', 'product', '019a8b4e-0000-7000-8000-0000000000aa', 'agaclar', 'agaclar-meyve', 'baki',
                    'pending', 'Alma tingi', 'fixed', 10, 'Test', '+994500000999', false),
                   (gen_random_uuid(), 2, 'dizayn-2', 'service', '019a8b4e-0000-7000-8000-0000000000aa', 'landsaft-xidmetleri', 'landsaft-dizayni',
                    'baki', 'pending', 'Bağın dizaynı', 'fixed', 10, 'Test', '+994500000999', false),
                   (gen_random_uuid(), 3, 'kol-3', 'product', '019a8b4e-0000-7000-8000-0000000000aa', 'agaclar', NULL, 'baki',
                    'pending', 'Ağac kolu', 'fixed', 10, 'Test', '+994500000999', false);
            """,
            Ct);

        await migrator.MigrateAsync(cancellationToken: Ct);

        var lists = await db.Database
            .SqlQuery<string>($"SELECT array_to_string(subcategory_ids, ',') AS \"Value\" FROM listings ORDER BY number")
            .ToListAsync(Ct);
        Assert.Equal(["agaclar-meyve", "landsaft-dizayni", ""], lists);
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
