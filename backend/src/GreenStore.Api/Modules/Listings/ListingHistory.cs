using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Listings;

/// <summary>
/// The unsent state of «Elan yerləşdir» (DATABASE.md §3.5), kept as the wizard has it: the server only stores it. A
/// draft of an existing listing («Redaktə et») names it in <see cref="ListingId"/>. Drafts live apart from
/// <c>listings</c>, so the listing table's checks stay strict.
/// </summary>
public sealed class ListingDraft : IHasUpdatedAt
{
    public Guid Id { get; set; }

    public Guid OwnerUserId { get; set; }

    public Guid? ListingId { get; set; }

    /// <summary>The wizard's JSON object, as it was sent.</summary>
    public required string Data { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// What the owner sent, each time (DATABASE.md §3.5, decision 4): revision 1 is the first submission, every edit adds
/// one. The moderator compares the pending revision with the last approved one.
/// </summary>
public sealed class ListingRevision
{
    public Guid ListingId { get; set; }

    public int Revision { get; set; }

    /// <summary>The normalised content and the photo ids (<see cref="ListingContent"/>).</summary>
    public required ListingContent Data { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Views, phone reveals and favourites of one listing on one day (Baku time), for the 14-day chart (DATABASE.md §3.6).</summary>
public sealed class ListingDailyStat
{
    public Guid ListingId { get; set; }

    public DateOnly Day { get; set; }

    public int Views { get; set; }

    public int PhoneReveals { get; set; }

    public int Favourites { get; set; }
}

/// <summary>
/// One visitor's view or reveal of a listing on a day, so a repeat is counted once (DATABASE.md §3.6). UNLOGGED: fast,
/// and losing it in a crash only means a few repeats count again.
/// </summary>
public sealed class ListingSeen
{
    public Guid ListingId { get; set; }

    /// <summary>HMAC of the session, else of the IP and the browser (<see cref="Common.Security.ServerHash.Visitor"/>).</summary>
    public required byte[] VisitorHash { get; set; }

    public DateOnly Day { get; set; }

    public SeenAction Action { get; set; }
}

public enum SeenAction
{
    View,
    Reveal,
}

internal sealed class ListingDraftConfiguration : IEntityTypeConfiguration<ListingDraft>
{
    public void Configure(EntityTypeBuilder<ListingDraft> draft)
    {
        draft.ToTable("listing_drafts");
        draft.Property(d => d.Id).ValueGeneratedNever();
        draft.HasOne<User>().WithMany().HasForeignKey(d => d.OwnerUserId).OnDelete(DeleteBehavior.Cascade);
        draft.HasOne<Listing>().WithMany().HasForeignKey(d => d.ListingId).OnDelete(DeleteBehavior.Cascade);
        draft.Property(d => d.Data).HasColumnType("jsonb");
        draft.Property(d => d.UpdatedAt).HasDefaultValueSql("now()");
        draft.HasIndex(d => d.OwnerUserId).HasDatabaseName("ix_drafts_owner");
    }
}

internal sealed class ListingRevisionConfiguration : IEntityTypeConfiguration<ListingRevision>
{
    public void Configure(EntityTypeBuilder<ListingRevision> revision)
    {
        revision.ToTable("listing_revisions");
        revision.HasKey(r => new { r.ListingId, r.Revision });
        revision.HasOne<Listing>().WithMany().HasForeignKey(r => r.ListingId).OnDelete(DeleteBehavior.Cascade);
        revision.Property(r => r.Data).IsJson();
        revision.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
    }
}

internal sealed class ListingDailyStatConfiguration : IEntityTypeConfiguration<ListingDailyStat>
{
    public void Configure(EntityTypeBuilder<ListingDailyStat> stat)
    {
        stat.ToTable("listing_daily_stats");
        stat.HasKey(s => new { s.ListingId, s.Day });
        stat.HasOne<Listing>().WithMany().HasForeignKey(s => s.ListingId).OnDelete(DeleteBehavior.Cascade);
        stat.Property(s => s.Views).HasDefaultValue(0);
        stat.Property(s => s.PhoneReveals).HasDefaultValue(0);
        stat.Property(s => s.Favourites).HasDefaultValue(0);
    }
}

internal sealed class ListingSeenConfiguration : IEntityTypeConfiguration<ListingSeen>
{
    public void Configure(EntityTypeBuilder<ListingSeen> seen)
    {
        seen.ToTable("listing_seen", t => t.HasCheckConstraint("ck_listing_seen_action", ColumnMapping.In<SeenAction>("action")));
        seen.IsUnlogged();
        seen.HasKey(s => new { s.ListingId, s.VisitorHash, s.Day, s.Action });
        seen.Property(s => s.Action).IsKebabCase();
    }
}
