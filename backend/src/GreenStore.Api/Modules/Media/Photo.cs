using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Media;

/// <summary>
/// An uploaded photo (DATABASE.md §3.3, <see cref="PhotosEndpoints"/>). A <see cref="StorageKey"/> that starts with "/"
/// is a file of the website itself (the demo photos under /public/images), see <see cref="PhotoUrls"/>.
/// </summary>
public sealed class Photo
{
    public Guid Id { get; set; }

    public Guid OwnerUserId { get; set; }

    public User? Owner { get; set; }

    public PhotoPurpose Purpose { get; set; }

    public PhotoStatus Status { get; set; }

    public byte[]? UploadTokenHash { get; set; }

    public DateTimeOffset? UploadExpiresAt { get; set; }

    public string? ContentType { get; set; }

    public int? Bytes { get; set; }

    public int? Width { get; set; }

    public int? Height { get; set; }

    /// <summary>"p/2026/11/&lt;id&gt;" in the file storage, or a site path like "/images/listings/zeytun-agaci-1.webp".</summary>
    public string? StorageKey { get; set; }

    /// <summary>Resized copies by width: <c>{ "320": "…/320.webp", "640": "…", "1280": "…" }</c>.</summary>
    public Dictionary<string, string>? Variants { get; set; }

    public string? Error { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>When it was attached to a listing or a profile; still null after 24 hours, it is deleted.</summary>
    public DateTimeOffset? AttachedAt { get; set; }
}

public enum PhotoPurpose
{
    Listing,
    SellerLogo,
    SellerCover,
}

public enum PhotoStatus
{
    AwaitingUpload,
    Processing,
    Ready,
    Failed,
}

internal sealed class PhotoConfiguration : IEntityTypeConfiguration<Photo>
{
    public void Configure(EntityTypeBuilder<Photo> photo)
    {
        photo.ToTable("photos", t =>
        {
            t.HasCheckConstraint("ck_photos_purpose", ColumnMapping.In<PhotoPurpose>("purpose"));
            t.HasCheckConstraint("ck_photos_status", ColumnMapping.In<PhotoStatus>("status"));
            t.HasCheckConstraint("ck_photos_bytes", "bytes <= 10485760");
        });

        photo.Property(p => p.Id).ValueGeneratedNever();
        photo.HasOne(p => p.Owner).WithMany().HasForeignKey(p => p.OwnerUserId).OnDelete(DeleteBehavior.NoAction);
        photo.Property(p => p.Purpose).IsKebabCase();
        photo.Property(p => p.Status).IsKebabCase();
        photo.Property(p => p.Variants).IsJson();
        photo.Property(p => p.CreatedAt).HasDefaultValueSql("now()");
        photo.HasIndex(p => p.CreatedAt).HasDatabaseName("ix_photos_unattached").HasFilter("attached_at IS NULL");
    }
}

/// <summary>Public URLs of photos (backend-contract.md 1.5).</summary>
public static class PhotoUrls
{
    /// <summary>
    /// The address the site shows. Demo photos keep their site path ("/images/…", served by Next from /public);
    /// uploaded photos are their largest WebP copy in the storage, behind the media URL. Null when the photo is not
    /// ready.
    /// </summary>
    public static string? Of(Photo? photo, string mediaBaseUrl)
    {
        if (photo is not { Status: PhotoStatus.Ready, StorageKey: { Length: > 0 } key })
        {
            return null;
        }

        if (key.StartsWith('/') || key.StartsWith("https://", StringComparison.Ordinal) || key.StartsWith("http://", StringComparison.Ordinal))
        {
            return key;
        }

        var file = photo.Variants?.GetValueOrDefault(PhotoRules.DisplayWidth.ToString(System.Globalization.CultureInfo.InvariantCulture)) ?? key;
        return $"{mediaBaseUrl.TrimEnd('/')}/{file}";
    }
}
