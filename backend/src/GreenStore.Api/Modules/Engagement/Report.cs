using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Şikayət et» on a listing, a service or a seller (DATABASE.md §3.7). The target is one of two foreign keys, never
/// both, so a report can only name something that exists. Guests may report too: then only the IP's hash is kept.
/// Staff handle it in /admin/reports (open → investigating → resolved, with a resolution).
/// </summary>
public sealed class Report
{
    public Guid Id { get; set; }

    public ReportTarget TargetKind { get; set; }

    /// <summary>The listing or service (services are listings).</summary>
    public Guid? ListingId { get; set; }

    public Listing? Listing { get; set; }

    public Guid? SellerId { get; set; }

    public Seller? Seller { get; set; }

    public ReportReason ReasonCode { get; set; }

    /// <summary>The reporter's own words; required for <see cref="ReportReason.Other"/>.</summary>
    public string? Comment { get; set; }

    /// <summary>Null for a guest.</summary>
    public Guid? ReporterUserId { get; set; }

    public User? Reporter { get; set; }

    /// <summary>HMAC of the reporter's IP (<c>ServerHash.Ip</c>): tells repeated reports of one guest apart.</summary>
    public byte[]? ReporterIpHash { get; set; }

    public ReportStatus Status { get; set; }

    /// <summary>Set when resolved.</summary>
    public ReportResolution? Resolution { get; set; }

    /// <summary>The staff member who changed it last.</summary>
    public Guid? HandledBy { get; set; }

    public User? Handler { get; set; }

    public DateTimeOffset? HandledAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary><c>ReportTarget</c> of src/types.</summary>
public enum ReportTarget
{
    Listing,
    Seller,
    Service,
}

/// <summary>
/// Why it is reported (backend-contract.md 4.1, <c>ReportReason</c>): a code, the UI words it in its language. Which
/// codes a target allows: <see cref="ReportRules.ReasonsFor"/>.
/// </summary>
public enum ReportReason
{
    /// <summary>«Satılıb və ya aktual deyil».</summary>
    Sold,

    /// <summary>«Qiymət düzgün deyil».</summary>
    WrongPrice,

    /// <summary>«Şəkillər bu bitki deyil».</summary>
    WrongPhotos,

    /// <summary>«Məlumat düzgün deyil».</summary>
    WrongInfo,

    /// <summary>«Satıcı ilə əlaqə saxlamaq olmur».</summary>
    Unreachable,

    /// <summary>«Təkrar elan».</summary>
    Duplicate,

    /// <summary>«Dələduzluq şübhəsi».</summary>
    Fraud,

    /// <summary>«Uyğun olmayan davranış» (a seller).</summary>
    Misconduct,

    /// <summary>«Xidmət göstərilmir» (a service).</summary>
    NotProvided,

    /// <summary>«Şəkillər başqasının işidir» (a service).</summary>
    StolenPhotos,

    /// <summary>«Digər səbəb»: needs a comment.</summary>
    Other,
}

/// <summary><c>ComplaintStatus</c> of the admin pages: «Açıq», «Araşdırılır», «Həll olunub».</summary>
public enum ReportStatus
{
    Open,
    Investigating,
    Resolved,
}

/// <summary>How a resolved report ended.</summary>
public enum ReportResolution
{
    /// <summary>Something was done: the listing changed or went, the account was blocked, ….</summary>
    ActionTaken,

    /// <summary>Checked, nothing wrong.</summary>
    NoViolation,
}

internal sealed class ReportConfiguration : IEntityTypeConfiguration<Report>
{
    public void Configure(EntityTypeBuilder<Report> report)
    {
        report.ToTable("reports", t =>
        {
            t.HasCheckConstraint("ck_reports_target_kind", ColumnMapping.In<ReportTarget>("target_kind"));
            t.HasCheckConstraint("ck_reports_reason_code", ColumnMapping.In<ReportReason>("reason_code"));
            t.HasCheckConstraint("ck_reports_comment", $"char_length(comment) <= {ReportRules.MaxCommentLength}");
            t.HasCheckConstraint("ck_reports_status", ColumnMapping.In<ReportStatus>("status"));
            t.HasCheckConstraint("ck_reports_resolution", ColumnMapping.In<ReportResolution>("resolution"));
            // Exactly one target, and the seller column is the one of a seller report.
            t.HasCheckConstraint("ck_reports_one_target", "num_nonnulls(listing_id, seller_id) = 1");
            t.HasCheckConstraint("ck_reports_seller_target", "(target_kind = 'seller') = (seller_id IS NOT NULL)");
            t.HasCheckConstraint("ck_reports_other_has_comment", "reason_code <> 'other' OR comment IS NOT NULL");
            t.HasCheckConstraint("ck_reports_resolved_has_resolution", "status <> 'resolved' OR resolution IS NOT NULL");
        });

        report.Property(r => r.Id).ValueGeneratedNever();
        report.Property(r => r.TargetKind).IsKebabCase();
        report.HasOne(r => r.Listing).WithMany().HasForeignKey(r => r.ListingId).OnDelete(DeleteBehavior.NoAction);
        report.HasOne(r => r.Seller).WithMany().HasForeignKey(r => r.SellerId).OnDelete(DeleteBehavior.NoAction);
        report.HasOne(r => r.Reporter).WithMany().HasForeignKey(r => r.ReporterUserId).OnDelete(DeleteBehavior.NoAction);
        report.HasOne(r => r.Handler).WithMany().HasForeignKey(r => r.HandledBy).OnDelete(DeleteBehavior.NoAction);
        report.Property(r => r.ReasonCode).IsKebabCase();
        report.Property(r => r.Status).IsKebabCase().HasDefaultValueSql("'open'").HasSentinel(ReportStatus.Open);
        report.Property(r => r.Resolution).IsKebabCase();
        report.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
        report.HasIndex(r => r.CreatedAt).HasDatabaseName("ix_reports_open").HasFilter("status <> 'resolved'");
        report.HasIndex(r => r.ListingId).HasDatabaseName("ix_reports_listing").HasFilter("listing_id IS NOT NULL");
    }
}
