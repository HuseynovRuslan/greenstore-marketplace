using GreenStore.Api.Data;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Listings;

/// <summary><c>listings</c> with its constraints and indexes, exactly as DATABASE.md §3.4.</summary>
internal sealed class ListingConfiguration : IEntityTypeConfiguration<Listing>
{
    public const string NumberSequence = "listing_number_seq";

    /// <summary>The predicate of the public indexes: what buyers may see.</summary>
    public const string PublicFilter = "status = 'active' AND deleted_at IS NULL";

    public void Configure(EntityTypeBuilder<Listing> listing)
    {
        listing.ToTable("listings", t =>
        {
            t.HasCheckConstraint("ck_listings_kind", ColumnMapping.In<CategoryKind>("kind"));
            t.HasCheckConstraint("ck_listings_status", ColumnMapping.In<ListingStatus>("status"));
            t.HasCheckConstraint("ck_listings_title", "char_length(title) BETWEEN 3 AND 80");
            t.HasCheckConstraint("ck_listings_description", "char_length(description) <= 3000");
            t.HasCheckConstraint("ck_listings_price_type", ColumnMapping.In<PriceType>("price_type"));
            t.HasCheckConstraint("ck_listings_price", "price >= 0");
            t.HasCheckConstraint("ck_listings_price_unit", ColumnMapping.In<PriceUnit>("price_unit"));
            t.HasCheckConstraint("ck_listings_wholesale_price", "wholesale_price > 0");
            t.HasCheckConstraint("ck_listings_wholesale_min_qty", "wholesale_min_qty >= 2");
            t.HasCheckConstraint("ck_listings_quantity_available", "quantity_available >= 0");
            t.HasCheckConstraint("ck_listings_availability", ColumnMapping.In<Availability>("availability"));
            t.HasCheckConstraint("ck_listings_area", "char_length(area) <= 80");
            t.HasCheckConstraint("ck_listings_delivery_areas", "char_length(delivery_areas) <= 120");
            t.HasCheckConstraint("ck_listings_contact_name", "char_length(contact_name) BETWEEN 1 AND 60");
            t.HasCheckConstraint("ck_listings_contact_phone", @"contact_phone ~ '^\+994[0-9]{9}$'");
            t.HasCheckConstraint("ck_listings_species", "char_length(species) <= 60");
            t.HasCheckConstraint("ck_listings_height_min_cm", "height_min_cm > 0");
            t.HasCheckConstraint("ck_listings_age_years", "age_years >= 0");
            t.HasCheckConstraint("ck_listings_root_system", ColumnMapping.In<RootSystem>("root_system"));
            t.HasCheckConstraint("ck_listings_rejection_reason_code", ColumnMapping.In<RejectionReason>("rejection_reason_code"));
            t.HasCheckConstraint("ck_listings_rejection_note", "char_length(rejection_note) <= 500");

            // Rules across columns.
            t.HasCheckConstraint("ck_listings_price_given", "price_type = 'agreement' OR price IS NOT NULL");
            t.HasCheckConstraint("ck_listings_agreement_has_no_price", "price_type <> 'agreement' OR price IS NULL");
            t.HasCheckConstraint("ck_listings_wholesale_pair", "(wholesale_price IS NULL) = (wholesale_min_qty IS NULL)");
            t.HasCheckConstraint("ck_listings_height_range", "height_max_cm IS NULL OR height_max_cm >= height_min_cm");
            // A hidden number leaves buyers WhatsApp only.
            t.HasCheckConstraint("ck_listings_hidden_phone_has_whatsapp", "NOT phone_hidden OR whatsapp");
            t.HasCheckConstraint(
                "ck_listings_active_dates",
                "status <> 'active' OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND sort_at IS NOT NULL)");
            t.HasCheckConstraint("ck_listings_rejected_reason", "status <> 'rejected' OR rejection_reason_code IS NOT NULL");
            t.HasCheckConstraint("ck_listings_service_fields", "kind = 'service' OR (cardinality(service_city_ids) = 0 AND cardinality(includes) = 0)");
        });

        listing.Property(l => l.Id).ValueGeneratedNever();
        listing.Property(l => l.Number).HasDefaultValueSql($"nextval('{NumberSequence}')");
        listing.HasIndex(l => l.Number).IsUnique().HasDatabaseName("ux_listings_number");
        listing.HasIndex(l => l.Slug).IsUnique().HasDatabaseName("ux_listings_slug");
        listing.Property(l => l.Kind).IsKebabCase();
        listing.HasOne(l => l.Owner).WithMany().HasForeignKey(l => l.OwnerUserId).OnDelete(DeleteBehavior.NoAction);
        listing.HasOne(l => l.Seller).WithMany().HasForeignKey(l => l.SellerId).OnDelete(DeleteBehavior.NoAction);
        listing.HasOne(l => l.Category).WithMany().HasForeignKey(l => l.CategoryId).OnDelete(DeleteBehavior.NoAction);
        listing.HasOne(l => l.Subcategory).WithMany().HasForeignKey(l => l.SubcategoryId).OnDelete(DeleteBehavior.NoAction);
        listing.Property(l => l.Status).IsKebabCase();
        listing.Property(l => l.Description).HasDefaultValue(string.Empty);

        listing.Property(l => l.PriceType).IsKebabCase();
        listing.Property(l => l.Price).HasPrecision(10, 2);
        listing.Property(l => l.PriceUnit).IsKebabCase();
        listing.Property(l => l.WholesalePrice).HasPrecision(10, 2);
        listing.Property(l => l.Availability).IsKebabCase();

        listing.HasOne(l => l.City).WithMany().HasForeignKey(l => l.CityId).OnDelete(DeleteBehavior.NoAction);
        listing.Property(l => l.DeliveryAvailable).HasDefaultValue(false);
        listing.Property(l => l.PlantingAvailable).HasDefaultValue(false);
        listing.Property(l => l.Whatsapp).HasDefaultValue(false);
        listing.Property(l => l.PhoneHidden).HasDefaultValue(false);

        listing.Property(l => l.RootSystem).IsKebabCase();
        listing.Property(l => l.Plant).IsJson();
        listing.Property(l => l.Attributes).IsJson().HasDefaultValueSql("'{}'::jsonb");
        listing.Property(l => l.CareTips).HasColumnType("text[]").HasDefaultValueSql("'{}'::text[]");
        listing.Property(l => l.ServiceCityIds).HasColumnType("text[]").HasDefaultValueSql("'{}'::text[]");
        listing.Property(l => l.Includes).HasColumnType("text[]").HasDefaultValueSql("'{}'::text[]");

        listing.Property(l => l.SearchText).HasDefaultValue(string.Empty);
        listing.Property(l => l.IsPromoted).HasDefaultValue(false);
        listing.Property(l => l.RejectionReasonCode).IsKebabCase();
        listing.Property(l => l.CreatedAt).HasDefaultValueSql("now()");

        listing.HasMany(l => l.Photos).WithOne().HasForeignKey(p => p.ListingId).OnDelete(DeleteBehavior.Cascade);
        listing.HasOne(l => l.Counter).WithOne().HasForeignKey<ListingCounter>(c => c.ListingId).OnDelete(DeleteBehavior.Cascade);
        listing.HasXminRowVersion();

        // Public queries (active listings only).
        listing.HasIndex(l => new { l.Kind, l.IsPromoted, l.SortAt })
            .HasDatabaseName("ix_listings_feed")
            .IsDescending(false, true, true)
            .HasFilter(PublicFilter);
        listing.HasIndex(l => new { l.CategoryId, l.SortAt })
            .HasDatabaseName("ix_listings_category")
            .IsDescending(false, true)
            .HasFilter(PublicFilter);
        listing.HasIndex(l => l.SearchText)
            .HasDatabaseName("ix_listings_search")
            .HasMethod("gin")
            .HasOperators("gin_trgm_ops")
            .HasFilter(PublicFilter);

        // Cabinet, seller page, moderation, background jobs.
        listing.HasIndex(l => new { l.OwnerUserId, l.Status }).HasDatabaseName("ix_listings_owner").HasFilter("deleted_at IS NULL");
        listing.HasIndex(l => l.SellerId).HasDatabaseName("ix_listings_seller").HasFilter("seller_id IS NOT NULL AND deleted_at IS NULL");
        listing.HasIndex(l => l.SubmittedAt).HasDatabaseName("ix_listings_moderation").HasFilter("status = 'pending' AND deleted_at IS NULL");
        listing.HasIndex(l => l.ExpiresAt).HasDatabaseName("ix_listings_expiry").HasFilter(PublicFilter);
    }
}

internal sealed class ListingPhotoConfiguration : IEntityTypeConfiguration<ListingPhoto>
{
    public void Configure(EntityTypeBuilder<ListingPhoto> photo)
    {
        photo.ToTable("listing_photos", t => t.HasCheckConstraint("ck_listing_photos_position", "position BETWEEN 0 AND 11"));
        photo.HasKey(p => new { p.ListingId, p.Position });
        photo.HasOne(p => p.Photo).WithMany().HasForeignKey(p => p.PhotoId).OnDelete(DeleteBehavior.NoAction);
        photo.HasIndex(p => p.PhotoId).IsUnique().HasDatabaseName("ux_listing_photos_photo_id");
    }
}

internal sealed class ListingCounterConfiguration : IEntityTypeConfiguration<ListingCounter>
{
    public void Configure(EntityTypeBuilder<ListingCounter> counter)
    {
        counter.ToTable("listing_counters");
        counter.HasKey(c => c.ListingId);
        counter.Property(c => c.Views).HasDefaultValue(0);
        counter.Property(c => c.PhoneReveals).HasDefaultValue(0);
        counter.Property(c => c.Favourites).HasDefaultValue(0);
    }
}
