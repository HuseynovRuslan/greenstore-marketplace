using System.Text.Json.Serialization;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// A business profile (DATABASE.md §3.3): one per user (decision 1). Individuals have none; their listings carry the
/// contact. <c>Seller.kind</c> («Tingçilik təsərrüfatı · Bağ mərkəzi») is not stored: the API names the
/// <see cref="BusinessKinds"/> in the request's language.
/// </summary>
public sealed class Seller : IHasUpdatedAt, IHasRowVersion
{
    public Guid Id { get; set; }

    public Guid OwnerUserId { get; set; }

    public User? Owner { get; set; }

    public required string Slug { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// <see cref="BusinessKind"/> codes (kebab-case): one or more, each once, in the enum's order (<see cref="BusinessKindCodes"/>).
    /// A nursery can be a garden centre too.
    /// </summary>
    public List<string> BusinessKinds { get; set; } = [];

    public required string CityId { get; set; }

    public City? City { get; set; }

    public string? Address { get; set; }

    public decimal? Lat { get; set; }

    public decimal? Lng { get; set; }

    /// <summary>In the language the seller wrote it.</summary>
    public string? About { get; set; }

    public string? Terms { get; set; }

    public List<OpeningHours>? Hours { get; set; }

    /// <summary><c>SellerOffer</c> codes (kebab-case), e.g. ["delivery", "planting"].</summary>
    public List<string> Offers { get; set; } = [];

    /// <summary>The business's number (E.164); the owner's number when empty. Never in public responses.</summary>
    public string? Phone { get; set; }

    public bool Whatsapp { get; set; }

    public string? Email { get; set; }

    public string? ContactPerson { get; set; }

    public string? Instagram { get; set; }

    public string? Website { get; set; }

    public int? ResponseMinutes { get; set; }

    public Guid? LogoPhotoId { get; set; }

    public Photo? LogoPhoto { get; set; }

    public Guid? CoverPhotoId { get; set; }

    public Photo? CoverPhoto { get; set; }

    /// <summary>«Təsdiqlənmiş satıcı» since; null = not verified.</summary>
    public DateTimeOffset? VerifiedAt { get; set; }

    public Guid? VerifiedBy { get; set; }

    /// <summary>«2021-dən GreenStore-da» comes from this.</summary>
    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public uint Version { get; set; }
}

/// <summary><c>BusinessKind</c> in src/types. The declaration order is the order a seller's kinds are kept and shown in.</summary>
public enum BusinessKind
{
    Nursery,
    GardenCentre,
    Landscaping,
}

/// <summary>A business's kinds as <see cref="Seller.BusinessKinds"/> stores them: kebab-case, each once, in the enum's order.</summary>
public static class BusinessKindCodes
{
    public static List<string> From(IEnumerable<BusinessKind> kinds) => kinds.Distinct().Order().Select(k => KebabCase.Value(k)).ToList();

    public static IReadOnlyList<BusinessKind> Parse(IEnumerable<string> codes) => codes.Select(KebabCase.Parse<BusinessKind>).Distinct().Order().ToList();
}

/// <summary><c>SellerOffer</c> in src/types.</summary>
public enum SellerOffer
{
    Delivery,
    Planting,
    Design,
    Wholesale,
    Care,
}

/// <summary>
/// <c>OpeningHours</c> in src/types: one weekday (1 = Monday … 7 = Sunday); a closed day has no times. Stored in the
/// <c>hours</c> jsonb as the same JSON the API sends.
/// </summary>
public sealed record OpeningHours(int Day, string? Open = null, string? Close = null, bool? Closed = null)
{
    [JsonIgnore]
    public bool IsOpen => Closed != true && !string.IsNullOrEmpty(Open) && !string.IsNullOrEmpty(Close);
}

internal sealed class SellerConfiguration : IEntityTypeConfiguration<Seller>
{
    public void Configure(EntityTypeBuilder<Seller> seller)
    {
        seller.ToTable("sellers", t =>
        {
            t.HasCheckConstraint("ck_sellers_slug", "slug ~ '^[a-z0-9-]{1,80}$'");
            t.HasCheckConstraint("ck_sellers_name", "char_length(name) BETWEEN 2 AND 80");
            t.HasCheckConstraint(
                "ck_sellers_business_kinds",
                $"cardinality(business_kinds) >= 1 AND business_kinds <@ ARRAY[{string.Join(", ", KebabCase.Values<BusinessKind>().Select(v => $"'{v}'"))}]::text[]");
            t.HasCheckConstraint("ck_sellers_address", "char_length(address) <= 200");
            t.HasCheckConstraint("ck_sellers_about", "char_length(about) <= 2000");
            t.HasCheckConstraint("ck_sellers_terms", "char_length(terms) <= 1000");
            t.HasCheckConstraint(
                "ck_sellers_offers",
                $"offers <@ ARRAY[{string.Join(", ", KebabCase.Values<SellerOffer>().Select(v => $"'{v}'"))}]::text[]");
            t.HasCheckConstraint("ck_sellers_phone", @"phone ~ '^\+994[0-9]{9}$'");
            t.HasCheckConstraint("ck_sellers_response_minutes", "response_minutes > 0");
            t.HasCheckConstraint("ck_sellers_location", "(lat IS NULL) = (lng IS NULL)");
        });

        seller.Property(s => s.Id).ValueGeneratedNever();
        seller.HasOne(s => s.Owner).WithOne().HasForeignKey<Seller>(s => s.OwnerUserId).OnDelete(DeleteBehavior.NoAction);
        seller.HasIndex(s => s.OwnerUserId).IsUnique().HasDatabaseName("ux_sellers_owner_user_id");
        seller.HasIndex(s => s.Slug).IsUnique().HasDatabaseName("ux_sellers_slug");
        seller.Property(s => s.BusinessKinds).HasColumnType("text[]");
        seller.HasOne(s => s.City).WithMany().HasForeignKey(s => s.CityId).OnDelete(DeleteBehavior.NoAction);
        seller.Property(s => s.Lat).HasPrecision(8, 6);
        seller.Property(s => s.Lng).HasPrecision(9, 6);
        seller.Property(s => s.Hours).IsJson();
        seller.Property(s => s.Offers).HasColumnType("text[]").HasDefaultValueSql("'{}'::text[]");
        seller.Property(s => s.Whatsapp).HasDefaultValue(false);
        seller.HasOne(s => s.LogoPhoto).WithMany().HasForeignKey(s => s.LogoPhotoId).OnDelete(DeleteBehavior.NoAction);
        seller.HasOne(s => s.CoverPhoto).WithMany().HasForeignKey(s => s.CoverPhotoId).OnDelete(DeleteBehavior.NoAction);
        seller.HasOne<User>().WithMany().HasForeignKey(s => s.VerifiedBy).OnDelete(DeleteBehavior.NoAction);
        seller.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
        seller.Property(s => s.UpdatedAt).HasDefaultValueSql("now()");
        seller.HasXminRowVersion();
    }
}
