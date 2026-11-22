using GreenStore.Api.Data;
using GreenStore.Api.Modules.Listings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// The promotion and payment tables, as DATABASE.md §3.9 has them: <c>promotion_packages</c>,
/// <c>promotion_options</c>, <c>promotion_orders</c>, <c>payment_events</c> and <c>listing_promotions</c>.
/// </summary>
internal sealed class PromotionPackageConfiguration : IEntityTypeConfiguration<PromotionPackage>
{
    public void Configure(EntityTypeBuilder<PromotionPackage> package)
    {
        package.ToTable("promotion_packages", t =>
        {
            t.HasCheckConstraint("ck_promotion_packages_id", $"id IN ({string.Join(", ", PromotionPackages.All.Select(id => $"'{id}'"))})");
            t.HasCheckConstraint("ck_promotion_packages_name", LocalizedTextMapping.CheckSql("name"));
            t.HasCheckConstraint("ck_promotion_packages_summary", LocalizedTextMapping.CheckSql("summary"));
            t.HasCheckConstraint("ck_promotion_packages_benefits", "jsonb_typeof(benefits) = 'array'");
        });

        package.Property(p => p.Id).ValueGeneratedNever();
        package.Property(p => p.Name).IsLocalizedText();
        package.Property(p => p.Summary).IsLocalizedText();
        package.Property(p => p.Benefits).IsJson().HasDefaultValueSql("'[]'::jsonb");
        package.Property(p => p.SortOrder).HasDefaultValue(0);
        package.Property(p => p.IsActive).HasDefaultValue(true).HasSentinel(true);
        package.HasMany(p => p.Options).WithOne(o => o.Package).HasForeignKey(o => o.PackageId).OnDelete(DeleteBehavior.NoAction);
    }
}

internal sealed class PromotionOptionConfiguration : IEntityTypeConfiguration<PromotionOption>
{
    public void Configure(EntityTypeBuilder<PromotionOption> option)
    {
        option.ToTable("promotion_options", t =>
        {
            t.HasCheckConstraint("ck_promotion_options_id", "id ~ '^[a-z0-9-]{1,40}$'");
            t.HasCheckConstraint("ck_promotion_options_label", LocalizedTextMapping.CheckSql("label"));
            t.HasCheckConstraint("ck_promotion_options_price", "price > 0");
            t.HasCheckConstraint("ck_promotion_options_days", "days > 0");
            t.HasCheckConstraint("ck_promotion_options_bumps", "bumps > 0");
            t.HasCheckConstraint("ck_promotion_options_runs", "days IS NOT NULL OR bumps IS NOT NULL");
        });

        option.Property(o => o.Id).ValueGeneratedNever();
        option.Property(o => o.Label).IsLocalizedText();
        option.Property(o => o.Price).HasPrecision(10, 2);
        option.Property(o => o.SortOrder).HasDefaultValue(0);
        option.Property(o => o.IsActive).HasDefaultValue(true).HasSentinel(true);
    }
}

internal sealed class PromotionOrderConfiguration : IEntityTypeConfiguration<PromotionOrder>
{
    public const string NumberSequence = "promotion_order_number_seq";

    public void Configure(EntityTypeBuilder<PromotionOrder> order)
    {
        order.ToTable("promotion_orders", t =>
        {
            t.HasCheckConstraint("ck_promotion_orders_amount", "amount > 0");
            t.HasCheckConstraint("ck_promotion_orders_status", ColumnMapping.In<PromotionOrderStatus>("status"));
            t.HasCheckConstraint("ck_promotion_orders_paid_at", "status <> 'paid' OR paid_at IS NOT NULL");
        });

        order.Property(o => o.Id).ValueGeneratedNever();
        order.Property(o => o.Number).HasDefaultValueSql($"nextval('{NumberSequence}')");
        order.HasIndex(o => o.Number).IsUnique().HasDatabaseName("ux_promotion_orders_number");
        order.HasOne(o => o.Listing).WithMany().HasForeignKey(o => o.ListingId).OnDelete(DeleteBehavior.NoAction);
        order.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId).OnDelete(DeleteBehavior.NoAction);
        order.HasOne(o => o.Option).WithMany().HasForeignKey(o => o.OptionId).OnDelete(DeleteBehavior.NoAction);
        order.Property(o => o.Amount).HasPrecision(10, 2);
        order.Property(o => o.Status).IsKebabCase();
        order.Property(o => o.CreatedAt).HasDefaultValueSql("now()");
        // The same payment is never counted twice (DATABASE.md §3.9).
        order.HasIndex(o => new { o.Provider, o.ProviderRef }).IsUnique().HasDatabaseName("ux_promotion_orders_provider_ref");
        order.HasIndex(o => o.ListingId).HasDatabaseName("ix_orders_listing");
    }
}

internal sealed class PaymentEventConfiguration : IEntityTypeConfiguration<PaymentEvent>
{
    public void Configure(EntityTypeBuilder<PaymentEvent> paymentEvent)
    {
        paymentEvent.ToTable("payment_events");
        paymentEvent.Property(e => e.Id).UseIdentityAlwaysColumn();
        paymentEvent.Property(e => e.Payload).HasColumnType("jsonb");
        paymentEvent.Property(e => e.ReceivedAt).HasDefaultValueSql("now()");
    }
}

internal sealed class ListingPromotionConfiguration : IEntityTypeConfiguration<ListingPromotion>
{
    public void Configure(EntityTypeBuilder<ListingPromotion> promotion)
    {
        promotion.ToTable("listing_promotions", t =>
        {
            t.HasCheckConstraint("ck_listing_promotions_kind", ColumnMapping.In<PromotionKind>("kind"));
            t.HasCheckConstraint("ck_listing_promotions_period", "ends_at > starts_at");
            t.HasCheckConstraint("ck_listing_promotions_bumps_left", "bumps_left >= 0");
            // Only «İrəli çək» lifts the listing; a lift still to come has its time.
            t.HasCheckConstraint("ck_listing_promotions_feature_has_no_bumps", "kind = 'bump' OR (bumps_left = 0 AND next_bump_at IS NULL)");
            t.HasCheckConstraint("ck_listing_promotions_next_bump", "bumps_left = 0 OR next_bump_at IS NOT NULL");
        });

        promotion.Property(p => p.Id).ValueGeneratedNever();
        promotion.HasOne<Listing>().WithMany().HasForeignKey(p => p.ListingId).OnDelete(DeleteBehavior.NoAction);
        promotion.HasOne(p => p.Order).WithMany().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.NoAction);
        promotion.Property(p => p.Kind).IsKebabCase();
        promotion.Property(p => p.BumpsLeft).HasDefaultValue((short)0);
        promotion.HasIndex(p => new { p.ListingId, p.EndsAt }).HasDatabaseName("ix_promotions_listing");
        promotion.HasIndex(p => p.NextBumpAt).HasDatabaseName("ix_promotions_bump").HasFilter("bumps_left > 0");
        // A paid order starts its promotion once: a repeated callback cannot add a second row of the same kind.
        promotion.HasIndex(p => new { p.OrderId, p.Kind }).IsUnique().HasDatabaseName("ux_listing_promotions_order_kind");
    }
}
