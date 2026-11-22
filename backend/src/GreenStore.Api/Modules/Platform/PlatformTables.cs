using GreenStore.Api.Modules.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Platform;

/// <summary>
/// A message to send after a change (DATABASE.md §3.10), written in the same transaction as the change, so the change
/// and its notice are saved together or not at all. The outbox job sends it (<see cref="OutboxJob"/>).
/// </summary>
public sealed class OutboxMessage
{
    public long Id { get; set; }

    /// <summary><see cref="OutboxTypes"/>: <c>revalidate</c> today; <c>email</c>, <c>push</c>, <c>sms-notice</c> later.</summary>
    public required string Type { get; set; }

    /// <summary>The message as JSON (for <c>revalidate</c>: <c>{"tags": [...]}</c>).</summary>
    public required string Payload { get; set; }

    public short Attempts { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Sent (or given up on: <see cref="LastError"/> says so); null while still due.</summary>
    public DateTimeOffset? SentAt { get; set; }
}

/// <summary>What a staff member did (DATABASE.md §3.10): <c>listing.approve</c>, <c>listing.reject</c>, ….</summary>
public sealed class AuditEntry
{
    public long Id { get; set; }

    public Guid? ActorUserId { get; set; }

    public required string Action { get; set; }

    public required string TargetType { get; set; }

    public required string TargetId { get; set; }

    /// <summary>What changed, as JSON.</summary>
    public string? Data { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// The answer to a POST sent with an <c>Idempotency-Key</c> (DATABASE.md §3.10): a second request with the same key
/// gets the same answer instead of creating a second listing.
/// </summary>
public sealed class IdempotencyKey
{
    /// <summary>Whose key: the user id (a guest's: the IP hash).</summary>
    public required string Scope { get; set; }

    public required string Key { get; set; }

    /// <summary>SHA-256 of the request body: the same key with another body is refused.</summary>
    public required byte[] RequestHash { get; set; }

    public short? ResponseStatus { get; set; }

    public string? ResponseBody { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> message)
    {
        message.ToTable("outbox");
        message.Property(m => m.Id).UseIdentityAlwaysColumn();
        message.Property(m => m.Payload).HasColumnType("jsonb");
        message.Property(m => m.Attempts).HasDefaultValue((short)0);
        message.Property(m => m.NextAttemptAt).HasDefaultValueSql("now()");
        message.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
        message.HasIndex(m => m.NextAttemptAt).HasDatabaseName("ix_outbox_due").HasFilter("sent_at IS NULL");
    }
}

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> entry)
    {
        entry.ToTable("audit_log");
        entry.Property(e => e.Id).UseIdentityAlwaysColumn();
        entry.HasOne<User>().WithMany().HasForeignKey(e => e.ActorUserId).OnDelete(DeleteBehavior.NoAction);
        entry.Property(e => e.Data).HasColumnType("jsonb");
        entry.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        entry.HasIndex(e => new { e.TargetType, e.TargetId, e.CreatedAt }).HasDatabaseName("ix_audit_target").IsDescending(false, false, true);
        entry.HasIndex(e => new { e.ActorUserId, e.CreatedAt }).HasDatabaseName("ix_audit_actor").IsDescending(false, true);
    }
}

internal sealed class IdempotencyKeyConfiguration : IEntityTypeConfiguration<IdempotencyKey>
{
    public const int MaxKeyLength = 80;

    public void Configure(EntityTypeBuilder<IdempotencyKey> key)
    {
        key.ToTable("idempotency_keys", t => t.HasCheckConstraint("ck_idempotency_keys_key", $"char_length(key) <= {MaxKeyLength}"));
        key.HasKey(k => new { k.Scope, k.Key });
        key.Property(k => k.ResponseBody).HasColumnType("jsonb");
        key.Property(k => k.CreatedAt).HasDefaultValueSql("now()");
    }
}
