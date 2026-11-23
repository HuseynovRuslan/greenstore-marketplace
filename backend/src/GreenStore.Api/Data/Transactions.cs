using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace GreenStore.Api.Data;

/// <summary>
/// A transaction that is either the caller's or this code's own: code that must run in one (a listing and its
/// revision, photos and notice) joins the caller's when there is one (an <c>Idempotency-Key</c> request saves its
/// answer in the same one) and starts its own otherwise. Only the owner commits and disposes it.
/// </summary>
public sealed class OwnedTransaction(IDbContextTransaction? owned) : IAsyncDisposable
{
    public Task CommitAsync(CancellationToken ct) => owned?.CommitAsync(ct) ?? Task.CompletedTask;

    public ValueTask DisposeAsync() => owned?.DisposeAsync() ?? ValueTask.CompletedTask;
}

public static class Transactions
{
    public static async Task<OwnedTransaction> BeginOrJoinTransactionAsync(this DbContext db, CancellationToken ct) =>
        new(db.Database.CurrentTransaction is null ? await db.Database.BeginTransactionAsync(ct) : null);

    /// <summary>
    /// Takes the transaction-scoped advisory lock <paramref name="name"/> if it is free: with several API instances, one
    /// runs a background job at a time (ARCHITECTURE.md §2). False when another holds it.
    /// </summary>
    public static async Task<bool> TryAdvisoryLockAsync(this DbContext db, string name, CancellationToken ct) =>
        await db.Database
            .SqlQuery<bool>($"SELECT pg_try_advisory_xact_lock(hashtextextended({name}, 0)) AS \"Value\"")
            .SingleAsync(ct);
}
