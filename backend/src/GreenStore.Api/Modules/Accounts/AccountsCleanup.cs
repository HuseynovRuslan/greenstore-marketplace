using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>How long account data is kept (DATABASE.md §5).</summary>
public static class AccountsRetention
{
    /// <summary>SMS codes: a week (the limits look back 24 hours; the rest is for investigating abuse).</summary>
    public static readonly TimeSpan OtpChallenges = TimeSpan.FromDays(7);

    /// <summary>Sessions: 30 days after they ended (signed out, revoked, or expired unused).</summary>
    public static readonly TimeSpan EndedSessions = TimeSpan.FromDays(30);

    public static DateTimeOffset OtpCutoff(DateTimeOffset now) => now - OtpChallenges;

    public static DateTimeOffset SessionCutoff(DateTimeOffset now) => now - EndedSessions;
}

public sealed record AccountsCleanupResult(int OtpChallenges, int Sessions);

/// <summary>Deletes what <see cref="AccountsRetention"/> no longer keeps.</summary>
public sealed class AccountsCleanup(AppDbContext db, TimeProvider clock)
{
    /// <summary>Taken for the run, so with several API instances only one cleans at a time.</summary>
    private const string LockKey = "cleanup:accounts";

    /// <summary>What was deleted; <c>null</c> when another instance is running it.</summary>
    public async Task<AccountsCleanupResult?> RunAsync(CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await db.TryAdvisoryLockAsync(LockKey, ct))
        {
            return null;
        }

        var now = clock.GetUtcNow();
        var otpCutoff = AccountsRetention.OtpCutoff(now);
        var sessionCutoff = AccountsRetention.SessionCutoff(now);
        var otp = await db.OtpChallenges.Where(o => o.CreatedAt < otpCutoff).ExecuteDeleteAsync(ct);
        var sessions = await db.Sessions
            .Where(s => s.RevokedAt < sessionCutoff || s.ExpiresAt < sessionCutoff)
            .ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);
        return new AccountsCleanupResult(otp, sessions);
    }
}
