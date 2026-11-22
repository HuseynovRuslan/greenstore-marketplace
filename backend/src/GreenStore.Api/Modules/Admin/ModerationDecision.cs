using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Admin;

/// <summary>A moderator's approval or rejection of one revision of a listing (DATABASE.md §3.5).</summary>
public sealed class ModerationDecision
{
    public Guid Id { get; set; }

    public Guid ListingId { get; set; }

    public int Revision { get; set; }

    public Guid ModeratorId { get; set; }

    public ModerationVerdict Decision { get; set; }

    public RejectionReason? ReasonCode { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>What the moderator decided (<c>decision</c> of <c>POST /admin/moderation/{id}/decision</c>).</summary>
public enum ModerationVerdict
{
    Approve,
    Reject,
}

internal sealed class ModerationDecisionConfiguration : IEntityTypeConfiguration<ModerationDecision>
{
    public void Configure(EntityTypeBuilder<ModerationDecision> decision)
    {
        decision.ToTable("moderation_decisions", t =>
        {
            t.HasCheckConstraint("ck_moderation_decisions_decision", ColumnMapping.In<ModerationVerdict>("decision"));
            t.HasCheckConstraint("ck_moderation_decisions_reason_code", ColumnMapping.In<RejectionReason>("reason_code"));
            t.HasCheckConstraint("ck_moderation_decisions_note", "char_length(note) <= 500");
            // A rejection always says why.
            t.HasCheckConstraint("ck_moderation_decisions_reject_reason", "decision = 'approve' OR reason_code IS NOT NULL");
        });

        decision.Property(d => d.Id).ValueGeneratedNever();
        decision.HasOne<ListingRevision>().WithMany()
            .HasForeignKey(d => new { d.ListingId, d.Revision })
            .HasConstraintName("fk_moderation_decisions_listing_revisions")
            .OnDelete(DeleteBehavior.NoAction);
        decision.HasOne<User>().WithMany().HasForeignKey(d => d.ModeratorId).OnDelete(DeleteBehavior.NoAction);
        decision.Property(d => d.Decision).IsKebabCase();
        decision.Property(d => d.ReasonCode).IsKebabCase();
        decision.Property(d => d.CreatedAt).HasDefaultValueSql("now()");
        decision.HasIndex(d => new { d.ListingId, d.CreatedAt })
            .HasDatabaseName("ix_decisions_listing")
            .IsDescending(false, true);
    }
}
