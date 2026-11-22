using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Usta çağır» (DATABASE.md §3.8): a customer's request for a service, numbered «Sorğu № 3001». It goes to the
/// provider of the service page it came from, to a chosen provider, or to up to ten active providers of the service
/// type in the city (<see cref="Recipients"/>). Guests may send one; the number is the customer's, as typed.
/// </summary>
public sealed class ServiceRequest
{
    public Guid Id { get; set; }

    public long Number { get; set; }

    /// <summary>The service whose page it was sent from.</summary>
    public Guid? ListingId { get; set; }

    public Listing? Listing { get; set; }

    /// <summary>The service type: a service category or sub-category (<c>landsaft-dizayni</c>).</summary>
    public required string CategoryId { get; set; }

    public Category? Category { get; set; }

    public required string CityId { get; set; }

    public City? City { get; set; }

    /// <summary>«Mərdəkan».</summary>
    public string? Area { get; set; }

    public DateOnly? PreferredDate { get; set; }

    /// <summary>«120 m²».</summary>
    public string? Size { get; set; }

    public required string Description { get; set; }

    public required string CustomerName { get; set; }

    /// <summary>E.164.</summary>
    public required string CustomerPhone { get; set; }

    public Guid? CustomerUserId { get; set; }

    public ServiceRequestStatus Status { get; set; }

    public byte[]? IpHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public List<ServiceRequestRecipient> Recipients { get; set; } = [];
}

/// <summary>Where a request is.</summary>
public enum ServiceRequestStatus
{
    /// <summary>No provider got it (none in that type and city yet).</summary>
    New,

    /// <summary>Given to its providers.</summary>
    Sent,

    Closed,

    Spam,
}

/// <summary>One provider a request went to; the provider's inbox is <c>GET /me/service-requests</c>.</summary>
public sealed class ServiceRequestRecipient
{
    public Guid RequestId { get; set; }

    public ServiceRequest? Request { get; set; }

    public Guid ProviderUserId { get; set; }

    public User? Provider { get; set; }

    /// <summary>When the SMS notice went out; null while it waits, or when none was sent (the daily cap).</summary>
    public DateTimeOffset? NotifiedAt { get; set; }

    /// <summary>When the provider opened it.</summary>
    public DateTimeOffset? SeenAt { get; set; }
}

internal sealed class ServiceRequestConfiguration : IEntityTypeConfiguration<ServiceRequest>
{
    public const string NumberSequence = "service_request_number_seq";

    public void Configure(EntityTypeBuilder<ServiceRequest> request)
    {
        request.ToTable("service_requests", t =>
        {
            t.HasCheckConstraint("ck_service_requests_area", $"char_length(area) <= {ServiceRequestRules.MaxAreaLength}");
            t.HasCheckConstraint("ck_service_requests_size", $"char_length(size) <= {ServiceRequestRules.MaxSizeLength}");
            t.HasCheckConstraint("ck_service_requests_description", $"char_length(description) <= {ServiceRequestRules.MaxDescriptionLength}");
            t.HasCheckConstraint("ck_service_requests_customer_name", $"char_length(customer_name) <= {ServiceRequestRules.MaxNameLength}");
            t.HasCheckConstraint("ck_service_requests_customer_phone", @"customer_phone ~ '^\+994[0-9]{9}$'");
            t.HasCheckConstraint("ck_service_requests_status", ColumnMapping.In<ServiceRequestStatus>("status"));
        });

        request.Property(r => r.Id).ValueGeneratedNever();
        request.Property(r => r.Number).HasDefaultValueSql($"nextval('{NumberSequence}')");
        request.HasIndex(r => r.Number).IsUnique().HasDatabaseName("ux_service_requests_number");
        request.HasOne(r => r.Listing).WithMany().HasForeignKey(r => r.ListingId).OnDelete(DeleteBehavior.NoAction);
        request.HasOne(r => r.Category).WithMany().HasForeignKey(r => r.CategoryId).OnDelete(DeleteBehavior.NoAction);
        request.HasOne(r => r.City).WithMany().HasForeignKey(r => r.CityId).OnDelete(DeleteBehavior.NoAction);
        request.HasOne<User>().WithMany().HasForeignKey(r => r.CustomerUserId).OnDelete(DeleteBehavior.NoAction);
        request.Property(r => r.Status).IsKebabCase().HasDefaultValueSql("'new'").HasSentinel(ServiceRequestStatus.New);
        request.Property(r => r.CreatedAt).HasDefaultValueSql("now()");
    }
}

internal sealed class ServiceRequestRecipientConfiguration : IEntityTypeConfiguration<ServiceRequestRecipient>
{
    public void Configure(EntityTypeBuilder<ServiceRequestRecipient> recipient)
    {
        recipient.ToTable("service_request_recipients");
        recipient.HasKey(r => new { r.RequestId, r.ProviderUserId });
        recipient.HasOne(r => r.Request).WithMany(r => r.Recipients).HasForeignKey(r => r.RequestId).OnDelete(DeleteBehavior.Cascade);
        recipient.HasOne(r => r.Provider).WithMany().HasForeignKey(r => r.ProviderUserId).OnDelete(DeleteBehavior.NoAction);
    }
}
