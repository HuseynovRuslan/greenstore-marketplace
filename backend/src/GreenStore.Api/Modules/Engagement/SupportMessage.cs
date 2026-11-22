using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Bizimlə əlaqə» (DATABASE.md §3.8): a message to support, with a ticket number the visitor can quote. A phone
/// contact is stored in E.164, an e-mail as typed.
/// </summary>
public sealed class SupportMessage
{
    public Guid Id { get; set; }

    public long Ticket { get; set; }

    public SupportTopic Topic { get; set; }

    public required string Name { get; set; }

    /// <summary>A phone (E.164) or an e-mail.</summary>
    public required string Contact { get; set; }

    public required string Message { get; set; }

    /// <summary>«Elan №», when the question is about a listing.</summary>
    public long? ListingNumber { get; set; }

    /// <summary>The account, when signed in.</summary>
    public Guid? UserId { get; set; }

    public SupportStatus Status { get; set; }

    public byte[]? IpHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary><c>SupportMessageInput.topic</c> of src/types.</summary>
public enum SupportTopic
{
    Listing,
    Account,
    Payment,
    Complaint,
    Other,
}

public enum SupportStatus
{
    New,
    Answered,
    Closed,
}

internal sealed class SupportMessageConfiguration : IEntityTypeConfiguration<SupportMessage>
{
    public const string TicketSequence = "support_ticket_seq";

    public void Configure(EntityTypeBuilder<SupportMessage> message)
    {
        message.ToTable("support_messages", t =>
        {
            t.HasCheckConstraint("ck_support_messages_topic", ColumnMapping.In<SupportTopic>("topic"));
            t.HasCheckConstraint("ck_support_messages_name", $"char_length(name) <= {SupportRules.MaxNameLength}");
            t.HasCheckConstraint("ck_support_messages_contact", $"char_length(contact) <= {SupportRules.MaxContactLength}");
            t.HasCheckConstraint("ck_support_messages_message", $"char_length(message) <= {SupportRules.MaxMessageLength}");
            t.HasCheckConstraint("ck_support_messages_status", ColumnMapping.In<SupportStatus>("status"));
        });

        message.Property(m => m.Id).ValueGeneratedNever();
        message.Property(m => m.Ticket).HasDefaultValueSql($"nextval('{TicketSequence}')");
        message.HasIndex(m => m.Ticket).IsUnique().HasDatabaseName("ux_support_messages_ticket");
        message.Property(m => m.Topic).IsKebabCase();
        message.HasOne<User>().WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.NoAction);
        message.Property(m => m.Status).IsKebabCase().HasDefaultValueSql("'new'").HasSentinel(SupportStatus.New);
        message.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
    }
}
