using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// A signed-in device (DATABASE.md §3.2). The client holds a random token (the site: Next.js in the httpOnly
/// <c>gs_session</c> cookie; the app: the phone's secure storage); the database holds only its SHA-256 hash. The
/// session slides: every use (written at most every 5 minutes) extends it to 30 days from then
/// (<see cref="SessionPolicy"/>). Revoked by signing out, «bu cihazdan çıx», or a password change or reset.
/// </summary>
public sealed class Session
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User? User { get; set; }

    /// <summary>SHA-256 of the token (<see cref="SessionTokens.Hash"/>).</summary>
    public required byte[] TokenHash { get; set; }

    public SessionClient Client { get; set; }

    /// <summary>«Chrome, Windows», «iPhone 15»: what «Aktiv cihazlar» shows.</summary>
    public string? DeviceName { get; set; }

    /// <summary>HMAC of the IP it signed in from (<see cref="Common.Security.ServerHash.Ip"/>).</summary>
    public byte[]? IpHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? RevokedAt { get; set; }
}

/// <summary>Where a session signed in: the website (through Next.js) or the mobile app.</summary>
public enum SessionClient
{
    Web,
    Ios,
    Android,
}

internal sealed class SessionConfiguration : IEntityTypeConfiguration<Session>
{
    public void Configure(EntityTypeBuilder<Session> session)
    {
        session.ToTable("sessions", t =>
        {
            t.HasCheckConstraint("ck_sessions_client", ColumnMapping.In<SessionClient>("client"));
            t.HasCheckConstraint("ck_sessions_device_name", "char_length(device_name) <= 80");
        });

        session.Property(s => s.Id).ValueGeneratedNever();
        session.HasOne(s => s.User).WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        session.HasIndex(s => s.UserId).HasDatabaseName("ix_sessions_user");
        session.HasIndex(s => s.TokenHash).IsUnique().HasDatabaseName("ux_sessions_token_hash");
        session.Property(s => s.Client).IsKebabCase();
        session.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
        session.Property(s => s.LastSeenAt).HasDefaultValueSql("now()");
    }
}
