using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// «Axtarışı yadda saxla» (DATABASE.md §3.7): a named catalogue search. <see cref="Query"/> is the site's query string
/// as the user saw it (<c>kateqoriya=agaclar&amp;seher=baki</c>); <see cref="Filter"/> is the same search in the API's
/// model, which <c>newCount</c> runs: the matching listings published since <see cref="LastOpenedAt"/>.
/// </summary>
public sealed class SavedSearch
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public required string Name { get; set; }

    public required string Query { get; set; }

    public required ListingFilter Filter { get; set; }

    /// <summary>Tell the user about new matches (the notifications themselves come with the outbox).</summary>
    public bool Alerts { get; set; }

    public DateTimeOffset LastOpenedAt { get; set; }

    public DateTimeOffset? LastNotifiedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class SavedSearchConfiguration : IEntityTypeConfiguration<SavedSearch>
{
    public void Configure(EntityTypeBuilder<SavedSearch> search)
    {
        search.ToTable("saved_searches", t =>
        {
            t.HasCheckConstraint("ck_saved_searches_name", "char_length(name) BETWEEN 1 AND 60");
            t.HasCheckConstraint("ck_saved_searches_query", "char_length(query) <= 500");
        });

        search.Property(s => s.Id).ValueGeneratedNever();
        search.HasOne<User>().WithMany().HasForeignKey(s => s.UserId).OnDelete(DeleteBehavior.Cascade);
        search.HasIndex(s => s.UserId).HasDatabaseName("ix_saved_searches_user");
        search.Property(s => s.Filter).IsJson();
        search.Property(s => s.Alerts).HasDefaultValue(false);
        search.Property(s => s.LastOpenedAt).HasDefaultValueSql("now()");
        search.Property(s => s.CreatedAt).HasDefaultValueSql("now()");
    }
}
