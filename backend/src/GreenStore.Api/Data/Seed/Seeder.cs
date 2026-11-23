using GreenStore.Api.Common;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Data.Seed;

/// <summary>
/// Writes the seed data (DATABASE.md §7) after the migrations: reference data (categories with sub-categories, cities,
/// promotion packages with their options) in every environment, demo data (users, sellers, listings, services) only when <c>Seed:Demo</c> is true
/// (Development by default, Staging when configured). Insert-if-missing only: a row that exists is never changed,
/// so an admin's edit survives the next deploy. <c>Seed:DevAccounts</c> adds a moderator and an admin with dev-only
/// passwords (<see cref="DevAccountsSeeder"/>). Runs in one transaction under an advisory lock, so two processes
/// seeding at once do not collide.
/// </summary>
public static class Seeder
{
    /// <summary>Key of the advisory lock held while seeding (any constant both processes agree on).</summary>
    private const long LockKey = 0x67_73_65_65_64; // "gseed"

    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var provider = scope.ServiceProvider;
        var options = provider.GetRequiredService<IOptions<SeedOptions>>().Value;
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(Seeder));
        await SeedAsync(
            provider.GetRequiredService<AppDbContext>(),
            options,
            provider.GetRequiredService<TimeProvider>(),
            logger,
            cancellationToken);
    }

    public static async Task<SeedResult> SeedAsync(
        AppDbContext db,
        SeedOptions options,
        TimeProvider clock,
        ILogger logger,
        CancellationToken cancellationToken = default)
    {
        if (!options.Reference && !options.Demo && !options.DevAccounts)
        {
            return new SeedResult(0, 0);
        }

        var directory = string.IsNullOrWhiteSpace(options.Directory) ? SeedFiles.DefaultDirectory : options.Directory;
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock({LockKey})", cancellationToken);

        var reference = options.Reference ? await ReferenceSeeder.SeedAsync(db, directory, cancellationToken) : 0;
        var demo = 0;
        if (options.Demo)
        {
            var taxonomy = await TaxonomySnapshot.LoadAsync(db, cancellationToken);
            demo = await DemoSeeder.SeedAsync(db, directory, taxonomy, clock, cancellationToken);
        }

        var devAccounts = options.DevAccounts ? await DevAccountsSeeder.SeedAsync(db, clock, cancellationToken) : 0;

        await transaction.CommitAsync(cancellationToken);
        logger.LogInformation(
            "Seed: {Reference} reference row(s), {Demo} demo row(s) and {DevAccounts} dev account(s) added",
            reference,
            demo,
            devAccounts);
        return new SeedResult(reference, demo, devAccounts);
    }
}

/// <summary>How many rows a seeding run added.</summary>
public sealed record SeedResult(int ReferenceRows, int DemoRows, int DevAccountRows = 0);
