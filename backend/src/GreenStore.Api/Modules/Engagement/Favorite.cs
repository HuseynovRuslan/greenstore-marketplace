using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Seçilmişlər» of an account (DATABASE.md §3.7): a listing or a service (services are listings too). Guests keep
/// theirs in the browser; after signing in, the site merges them into the account (<c>POST /me/favorites/merge</c>).
/// </summary>
public sealed class Favorite
{
    public Guid UserId { get; set; }

    public Guid ListingId { get; set; }

    public Listing? Listing { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class FavoriteConfiguration : IEntityTypeConfiguration<Favorite>
{
    public void Configure(EntityTypeBuilder<Favorite> favorite)
    {
        favorite.ToTable("favorites");
        favorite.HasKey(f => new { f.UserId, f.ListingId });
        favorite.HasOne<User>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        favorite.HasOne(f => f.Listing).WithMany().HasForeignKey(f => f.ListingId).OnDelete(DeleteBehavior.Cascade);
        favorite.HasIndex(f => f.ListingId).HasDatabaseName("ix_favorites_listing");
        favorite.Property(f => f.CreatedAt).HasDefaultValueSql("now()");
    }
}
