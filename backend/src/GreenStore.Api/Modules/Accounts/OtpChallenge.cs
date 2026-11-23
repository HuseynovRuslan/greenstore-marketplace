using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// One SMS code (DATABASE.md §3.2). The code itself is never stored: only its HMAC with the server key
/// (<see cref="Common.Security.ServerHash.OtpCode"/>). A challenge is verified once the right code is entered, then
/// consumed once by what it proves (registration, sign-in, a password reset, a new phone number).
/// </summary>
public sealed class OtpChallenge
{
    public Guid Id { get; set; }

    /// <summary>E.164; the number the code was sent to.</summary>
    public required string Phone { get; set; }

    public OtpPurpose Purpose { get; set; }

    public required byte[] CodeHash { get; set; }

    /// <summary>Wrong codes entered so far.</summary>
    public short Attempts { get; set; }

    /// <summary>HMAC of the client IP that asked for it (per-IP limits).</summary>
    public byte[]? IpHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>The code can be entered until then (5 minutes).</summary>
    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? VerifiedAt { get; set; }

    public DateTimeOffset? ConsumedAt { get; set; }
}

/// <summary><c>OtpPurpose</c> in src/types.</summary>
public enum OtpPurpose
{
    Register,
    Login,
    ResetPassword,
    ChangePhone,
}

internal sealed class OtpChallengeConfiguration : IEntityTypeConfiguration<OtpChallenge>
{
    public void Configure(EntityTypeBuilder<OtpChallenge> otp)
    {
        otp.ToTable("otp_challenges", t =>
        {
            t.HasCheckConstraint("ck_otp_challenges_purpose", ColumnMapping.In<OtpPurpose>("purpose"));
            t.HasCheckConstraint("ck_otp_challenges_attempts", $"attempts <= {Common.OtpOptions.AttemptsLimit}");
        });

        otp.Property(o => o.Id).ValueGeneratedNever();
        otp.Property(o => o.Purpose).IsKebabCase();
        otp.Property(o => o.Attempts).HasDefaultValue((short)0);
        otp.Property(o => o.CreatedAt).HasDefaultValueSql("now()");
        // «5 an hour, 10 a day» per number and per IP: the newest first.
        otp.HasIndex(o => new { o.Phone, o.CreatedAt }).IsDescending(false, true).HasDatabaseName("ix_otp_phone");
        otp.HasIndex(o => new { o.IpHash, o.CreatedAt }).IsDescending(false, true).HasDatabaseName("ix_otp_ip");
        // The platform's daily cap (every request counts the last 24 hours) and the 7-day clean-up.
        otp.HasIndex(o => o.CreatedAt).HasDatabaseName("ix_otp_created");
    }
}
