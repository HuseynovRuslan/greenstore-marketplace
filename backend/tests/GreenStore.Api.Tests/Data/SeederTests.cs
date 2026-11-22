using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>The seeder (DATABASE.md §7) on databases of their own: reference data always, demo data on request, never overwriting.</summary>
public sealed class SeederTests(PostgresDatabase database)
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 8, 0, 0, TimeSpan.Zero);

    private const int ReferenceRows = 29 + 7 + 3 + 8; // categories with sub-categories, cities, promotion packages and options
    private const int DemoRows = 23 + 4 + 59; // users, sellers, listings and services

    private static AppDbContext Db(ScratchDatabase scratch)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch.ConnectionString);
        options.AddInterceptors(new UpdatedAtInterceptor(new ManualTimeProvider(Now)));
        return new AppDbContext(options.Options);
    }

    private static async Task<SeedResult> SeedAsync(ScratchDatabase scratch, bool demo)
    {
        await using var db = Db(scratch);
        return await Seeder.SeedAsync(db, new SeedOptions { Reference = true, Demo = demo }, new ManualTimeProvider(Now), NullLogger.Instance, Ct);
    }

    private async Task<ScratchDatabase> MigratedAsync(string name)
    {
        var scratch = await database.CreateScratchDatabaseAsync(name);
        await using var db = Db(scratch);
        await db.Database.MigrateAsync(Ct);
        return scratch;
    }

    [Fact]
    public async Task Reference_data_is_added_once_and_an_admins_edit_survives_the_next_deploy()
    {
        await using var scratch = await MigratedAsync("seed_reference");

        Assert.Equal(new SeedResult(ReferenceRows, 0), await SeedAsync(scratch, demo: false));
        await using (var db = Db(scratch))
        {
            Assert.Equal(6, await db.Categories.CountAsync(c => c.ParentId == null, Ct));
            Assert.Equal(23, await db.Categories.CountAsync(c => c.ParentId != null, Ct));
            Assert.Empty(await db.Users.ToListAsync(Ct));
            Assert.Empty(await db.Listings.ToListAsync(Ct));

            var trees = await db.Categories.SingleAsync(c => c.Id == "agaclar", Ct);
            Assert.Equal(new LocalizedText("Ağaclar", "Деревья", "Trees"), trees.Name);
            Assert.Equal([new GreenStore.Api.Modules.Taxonomy.CategoryFilter("rootSystem", true)], trees.Filters);
            Assert.Equal(GreenStore.Api.Modules.Taxonomy.CategoryForm.Plant, trees.Form);
            var fruit = await db.Categories.SingleAsync(c => c.Id == "agaclar-meyve", Ct);
            Assert.Equal(("agaclar", (GreenStore.Api.Modules.Taxonomy.CategoryForm?)null), (fruit.ParentId, fruit.Form));

            // The promotion packages of src/data/promotions.ts, in three languages, with their options and prices.
            var packages = await db.PromotionPackages.OrderBy(p => p.SortOrder).ToListAsync(Ct);
            Assert.Equal(["ireli-cek", "one-cixar", "paket"], packages.Select(p => p.Id));
            Assert.Equal(new LocalizedText("Önə çıxar", "Вывести в топ", "Feature"), packages[1].Name);
            Assert.All(packages, p => Assert.Equal(3, p.Benefits.Count(b => b.Ru is not null && b.En is not null)));
            var week = await db.PromotionOptions.SingleAsync(o => o.Id == "one-cixar-7", Ct);
            Assert.Equal(("one-cixar", 9m, (short?)7, (short?)null), (week.PackageId, week.Price, week.Days, week.Bumps));
            Assert.Equal(new LocalizedText("7 gün", "7 дней", "7 days"), week.Label);
            var bundle = await db.PromotionOptions.SingleAsync(o => o.Id == "paket-15", Ct);
            Assert.Equal((22m, (short?)15, (short?)15), (bundle.Price, bundle.Days, bundle.Bumps));

            // The admin renames a category, hides a city, removes a sub-category and changes a price.
            trees.Name = new LocalizedText("Ağaclar və tinglər", "Деревья и саженцы");
            (await db.Cities.SingleAsync(c => c.Id == "quba", Ct)).IsActive = false;
            db.Categories.Remove(await db.Categories.SingleAsync(c => c.Id == "guller-movsumi", Ct));
            week.Price = 11;
            await db.SaveChangesAsync(Ct);
        }

        // Missing rows come back; existing rows are left as the admin made them.
        Assert.Equal(new SeedResult(1, 0), await SeedAsync(scratch, demo: false));
        Assert.Equal(new SeedResult(0, 0), await SeedAsync(scratch, demo: false));
        await using (var db = Db(scratch))
        {
            Assert.Equal(new LocalizedText("Ağaclar və tinglər", "Деревья и саженцы"), (await db.Categories.SingleAsync(c => c.Id == "agaclar", Ct)).Name);
            Assert.False((await db.Cities.SingleAsync(c => c.Id == "quba", Ct)).IsActive);
            Assert.True(await db.Categories.AnyAsync(c => c.Id == "guller-movsumi", Ct));
            Assert.Equal(11m, (await db.PromotionOptions.SingleAsync(o => o.Id == "one-cixar-7", Ct)).Price);
        }
    }

    [Fact]
    public async Task Nothing_is_written_when_both_switches_are_off()
    {
        await using var scratch = await MigratedAsync("seed_off");
        await using var db = Db(scratch);

        var result = await Seeder.SeedAsync(db, new SeedOptions { Reference = false, Demo = false }, new ManualTimeProvider(Now), NullLogger.Instance, Ct);

        Assert.Equal(new SeedResult(0, 0), result);
        Assert.Empty(await db.Categories.ToListAsync(Ct));
    }

    [Fact]
    public async Task Demo_data_becomes_users_sellers_and_listings_once()
    {
        await using var scratch = await MigratedAsync("seed_demo");

        Assert.Equal(new SeedResult(ReferenceRows, DemoRows), await SeedAsync(scratch, demo: true));

        await using (var db = Db(scratch))
        {
            var listings = await db.Listings.AsNoTracking().Include(l => l.Photos).ThenInclude(p => p.Photo).Include(l => l.Counter).ToListAsync(Ct);
            Assert.Equal(53, listings.Count(l => l.Kind == GreenStore.Api.Modules.Taxonomy.CategoryKind.Product));
            Assert.Equal(6, listings.Count(l => l.Kind == GreenStore.Api.Modules.Taxonomy.CategoryKind.Service));
            Assert.All(listings, l =>
            {
                // «<title in ASCII>-<number>», e.g. zeytun-agaci-olea-europaea-10482.
                Assert.Equal(ListingSlug.Create(l.Title, l.Number), l.Slug);
                Assert.Matches("^[a-z0-9]+(-[a-z0-9]+)*-[0-9]+$", l.Slug);
                Assert.NotEmpty(l.SearchText);
                Assert.Equal(SearchText.Normalize(l.SearchText), l.SearchText);
                Assert.NotEmpty(l.Photos);
                Assert.All(l.Photos, p => Assert.StartsWith("/images/", p.Photo!.StorageKey));
                Assert.All(l.Photos, p => Assert.Equal(PhotoStatus.Ready, p.Photo!.Status));
                Assert.NotNull(l.Counter);
                Assert.NotNull(PhoneNumbers.Mask(l.ContactPhone));
                if (l.Status == ListingStatus.Active)
                {
                    Assert.True(l.ExpiresAt > Now, $"{l.Slug} expires at {l.ExpiresAt}");
                    Assert.Equal(l.PublishedAt, l.SortAt);
                }
            });

            var olive = listings.Single(l => l.Number == 10482);
            Assert.Equal("zeytun-agaci-olea-europaea-10482", olive.Slug);
            Assert.Equal(("agaclar", "agaclar-meyve", 248), (olive.CategoryId, olive.SubcategoryId, olive.Counter!.Views));
            foreach (var word in new[] { "zeytun", "olea", "деревья", "trees", "плодовые", "апшерон", "absheron", "mehemmedi", "dibcekde", "в контейнере" })
            {
                Assert.True(ListingSearchText.Matches(olive.SearchText, word), $"«{word}» should find the olive tree: {olive.SearchText}");
            }

            var design = listings.Single(l => l.Number == 20316);
            Assert.Equal(("landsaft-xidmetleri", "landsaft-dizayni"), (design.CategoryId, design.SubcategoryId));
            Assert.Equal(["baki", "abseron", "sumqayit"], design.ServiceCityIds);
            Assert.True(ListingSearchText.Matches(design.SearchText, "Yaşıl Məkan suvarma"));

            var rejected = listings.Single(l => l.Number == 10531);
            Assert.Equal((ListingStatus.Rejected, (DateTimeOffset?)null), (rejected.Status, rejected.PublishedAt));
            Assert.NotNull(rejected.RejectionReasonCode);

            var users = await db.Users.AsNoTracking().ToListAsync(Ct);
            Assert.Equal(23, users.Count);
            Assert.All(users, u => Assert.Equal(DemoAccounts.NoPassword, u.PasswordHash));
            Assert.Equal(4, await db.Sellers.CountAsync(Ct));

            // New listings continue after the highest seeded number.
            var next = await db.Database.SqlQuery<long>($"SELECT nextval('listing_number_seq') AS \"Value\"").SingleAsync(Ct);
            Assert.True(next > listings.Max(l => l.Number), $"next number {next}");

            // An edit of a demo row (by an admin, say) survives the next run.
            await db.Database.ExecuteSqlAsync($"UPDATE listings SET title = 'Zeytun ağacı (redaktə)' WHERE number = 10482", Ct);
        }

        Assert.Equal(new SeedResult(0, 0), await SeedAsync(scratch, demo: true));
        await using (var db = Db(scratch))
        {
            Assert.Equal("Zeytun ağacı (redaktə)", await db.Listings.Where(l => l.Number == 10482).Select(l => l.Title).SingleAsync(Ct));
            Assert.Equal(59, await db.Listings.CountAsync(Ct));
        }
    }

    [Fact]
    public void Demo_data_is_off_unless_the_environment_turns_it_on()
    {
        var root = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        var development = Path.Combine(AppContext.BaseDirectory, "appsettings.Development.json");
        using var production = System.Text.Json.JsonDocument.Parse(File.ReadAllText(root));
        using var dev = System.Text.Json.JsonDocument.Parse(File.ReadAllText(development));

        Assert.False(production.RootElement.GetProperty("Seed").GetProperty("Demo").GetBoolean());
        Assert.True(production.RootElement.GetProperty("Seed").GetProperty("Reference").GetBoolean());
        Assert.True(dev.RootElement.GetProperty("Seed").GetProperty("Demo").GetBoolean());
        Assert.False(new SeedOptions().Demo);
    }

    [Fact]
    public async Task The_dev_staff_accounts_are_added_once_with_their_roles_and_hashed_passwords()
    {
        await using var scratch = await MigratedAsync("seed_staff");
        var options = new SeedOptions { Reference = false, Demo = false, DevAccounts = true };
        await using (var db = Db(scratch))
        {
            Assert.Equal(new SeedResult(0, 0, 2), await Seeder.SeedAsync(db, options, new ManualTimeProvider(Now), NullLogger.Instance, Ct));
        }

        await using (var db = Db(scratch))
        {
            var staff = await db.Users.OrderBy(u => u.Phone).ToListAsync(Ct);
            Assert.Equal([UserRole.Admin, UserRole.Moderator], staff.Select(u => u.Role));
            Assert.Equal(DevAccountsSeeder.Accounts.Select(a => a.Email), staff.Select(u => u.Email));
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            Assert.All(staff.Zip(DevAccountsSeeder.Accounts), pair => Assert.NotEqual(
                Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed,
                hasher.VerifyHashedPassword(pair.First, pair.First.PasswordHash!, pair.Second.Password)));

            // A changed password is not reset by the next run.
            staff[0].PasswordHash = hasher.HashPassword(staff[0], "Changed-2026");
            await db.SaveChangesAsync(Ct);
        }

        await using (var db = Db(scratch))
        {
            Assert.Equal(new SeedResult(0, 0, 0), await Seeder.SeedAsync(db, options, new ManualTimeProvider(Now), NullLogger.Instance, Ct));
            var admin = await db.Users.SingleAsync(u => u.Role == UserRole.Admin, Ct);
            Assert.NotEqual(
                Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed,
                new Microsoft.AspNetCore.Identity.PasswordHasher<User>().VerifyHashedPassword(admin, admin.PasswordHash!, "Changed-2026"));
        }
    }

    [Fact]
    public void The_dev_staff_accounts_are_on_in_development_only()
    {
        using var production = System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "appsettings.json")));
        using var dev = System.Text.Json.JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "appsettings.Development.json")));

        Assert.False(production.RootElement.GetProperty("Seed").GetProperty("DevAccounts").GetBoolean());
        Assert.True(dev.RootElement.GetProperty("Seed").GetProperty("DevAccounts").GetBoolean());
        Assert.False(new SeedOptions().DevAccounts);
        Assert.All(DevAccountsSeeder.Accounts, a => Assert.True(GreenStore.Api.Common.PhoneNumbers.IsMobile(a.Phone)));
    }
}
