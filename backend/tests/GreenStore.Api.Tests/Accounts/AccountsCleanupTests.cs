using GreenStore.Api.Data;
using GreenStore.Api.Jobs;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary>
/// The daily clean-up of account data (DATABASE.md §5): SMS codes after 7 days, sessions 30 days after they ended. On a
/// database of its own, since it deletes by date.
/// </summary>
public sealed class AccountsCleanupTests(PostgresDatabase database) : IAsyncLifetime
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 3, 0, 0, TimeSpan.Zero);

    private ScratchDatabase? scratch;

    public async ValueTask InitializeAsync()
    {
        scratch = await database.CreateScratchDatabaseAsync("cleanup");
        await using var db = CreateDbContext();
        await db.Database.MigrateAsync(Ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (scratch is not null)
        {
            await scratch.DisposeAsync();
        }
    }

    [Fact]
    public void Codes_are_kept_a_week_and_ended_sessions_a_month()
    {
        Assert.Equal(Now.AddDays(-7), AccountsRetention.OtpCutoff(Now));
        Assert.Equal(Now.AddDays(-30), AccountsRetention.SessionCutoff(Now));
    }

    [Fact]
    public async Task Deletes_old_codes_and_long_ended_sessions_only()
    {
        Guid oldCode, freshCode, active, recentlyRevoked, revokedLongAgo, expiredLongAgo;
        await using (var db = CreateDbContext())
        {
            var user = new User { Id = Guid.CreateVersion7(), FullName = "Test", Phone = "+994551112233", PasswordHash = "not-a-hash", CreatedAt = Now.AddDays(-90) };
            db.Users.Add(user);
            oldCode = AddCode(db, Now.AddDays(-7).AddMinutes(-1));
            freshCode = AddCode(db, Now.AddDays(-6));
            active = AddSession(db, user, expiresAt: Now.AddDays(20), revokedAt: null);
            recentlyRevoked = AddSession(db, user, expiresAt: Now.AddDays(20), revokedAt: Now.AddDays(-29));
            revokedLongAgo = AddSession(db, user, expiresAt: Now.AddDays(20), revokedAt: Now.AddDays(-31));
            expiredLongAgo = AddSession(db, user, expiresAt: Now.AddDays(-31), revokedAt: null);
            await db.SaveChangesAsync(Ct);
        }

        await using (var db = CreateDbContext())
        {
            var result = await new AccountsCleanup(db, new ManualTimeProvider(Now)).RunAsync(Ct);

            Assert.Equal(new AccountsCleanupResult(1, 2), result);
        }

        await using (var db = CreateDbContext())
        {
            Assert.Equal([freshCode], await db.OtpChallenges.Select(o => o.Id).ToListAsync(Ct));
            Assert.Equal(
                new[] { active, recentlyRevoked }.Order(),
                (await db.Sessions.Select(s => s.Id).ToListAsync(Ct)).Order());
            Assert.DoesNotContain(oldCode, await db.OtpChallenges.Select(o => o.Id).ToListAsync(Ct));
            Assert.DoesNotContain(revokedLongAgo, await db.Sessions.Select(s => s.Id).ToListAsync(Ct));
            Assert.DoesNotContain(expiredLongAgo, await db.Sessions.Select(s => s.Id).ToListAsync(Ct));
        }
    }

    [Fact]
    public async Task Only_one_instance_cleans_at_a_time()
    {
        await using var first = CreateDbContext();
        await using var transaction = await first.Database.BeginTransactionAsync(Ct);
        await first.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended('cleanup:accounts', 0))", Ct);

        await using var second = CreateDbContext();
        Assert.Null(await new AccountsCleanup(second, new ManualTimeProvider(Now)).RunAsync(Ct));
    }

    [Fact]
    public void The_api_runs_it_as_a_background_job()
    {
        using var api = new ApiFactory(database);

        // The daily Cleanup job runs this and the listing side's clean-up (Jobs/Cleanup.cs).
        Assert.Contains(api.Services.GetServices<IHostedService>(), s => s is CleanupJob);
        using var scope = api.Services.CreateScope();
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<Cleanup>());
    }

    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch!.ConnectionString);
        return new AppDbContext(options.Options);
    }

    private static Guid AddCode(AppDbContext db, DateTimeOffset createdAt)
    {
        var code = new OtpChallenge
        {
            Id = Guid.CreateVersion7(),
            Phone = "+994551112233",
            Purpose = OtpPurpose.Login,
            CodeHash = [1],
            CreatedAt = createdAt,
            ExpiresAt = createdAt.AddMinutes(5),
        };
        db.OtpChallenges.Add(code);
        return code.Id;
    }

    private static Guid AddSession(AppDbContext db, User user, DateTimeOffset expiresAt, DateTimeOffset? revokedAt)
    {
        var session = new Session
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            TokenHash = Guid.NewGuid().ToByteArray(),
            Client = SessionClient.Web,
            CreatedAt = Now.AddDays(-60),
            LastSeenAt = Now.AddDays(-40),
            ExpiresAt = expiresAt,
            RevokedAt = revokedAt,
        };
        db.Sessions.Add(session);
        return session.Id;
    }
}
