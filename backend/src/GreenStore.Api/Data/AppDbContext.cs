using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;

namespace GreenStore.Api.Data;

/// <summary>
/// The one database of the API (PostgreSQL, DATABASE.md). Table and column names are snake_case
/// (EFCore.NamingConventions). Each module keeps its entity configurations (<see cref="IEntityTypeConfiguration{T}"/>)
/// in its own folder; they are picked up from this assembly.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    /// <summary>For contexts that extend the model (tests).</summary>
    protected AppDbContext(DbContextOptions options)
        : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<City> Cities => Set<City>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Photo> Photos => Set<Photo>();

    public DbSet<Seller> Sellers => Set<Seller>();

    public DbSet<Listing> Listings => Set<Listing>();

    public DbSet<ListingPhoto> ListingPhotos => Set<ListingPhoto>();

    public DbSet<ListingCounter> ListingCounters => Set<ListingCounter>();

    public DbSet<Session> Sessions => Set<Session>();

    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();

    public DbSet<Favorite> Favorites => Set<Favorite>();

    public DbSet<SavedSearch> SavedSearches => Set<SavedSearch>();

    public DbSet<ListingDraft> ListingDrafts => Set<ListingDraft>();

    public DbSet<ListingRevision> ListingRevisions => Set<ListingRevision>();

    public DbSet<ModerationDecision> ModerationDecisions => Set<ModerationDecision>();

    public DbSet<ListingDailyStat> ListingDailyStats => Set<ListingDailyStat>();

    public DbSet<ListingSeen> ListingSeen => Set<ListingSeen>();

    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();

    public DbSet<AuditEntry> AuditLog => Set<AuditEntry>();

    public DbSet<IdempotencyKey> IdempotencyKeys => Set<IdempotencyKey>();

    public DbSet<Report> Reports => Set<Report>();

    public DbSet<ServiceRequest> ServiceRequests => Set<ServiceRequest>();

    public DbSet<ServiceRequestRecipient> ServiceRequestRecipients => Set<ServiceRequestRecipient>();

    public DbSet<SupportMessage> SupportMessages => Set<SupportMessage>();

    public DbSet<PromotionPackage> PromotionPackages => Set<PromotionPackage>();

    public DbSet<PromotionOption> PromotionOptions => Set<PromotionOption>();

    public DbSet<PromotionOrder> PromotionOrders => Set<PromotionOrder>();

    public DbSet<PaymentEvent> PaymentEvents => Set<PaymentEvent>();

    public DbSet<ListingPromotion> ListingPromotions => Set<ListingPromotion>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // EF would index every foreign key column. DATABASE.md lists each index on purpose (no city index yet, for
        // example, §3.4), so the indexes are exactly the ones the entity configurations declare.
        configurationBuilder.Conventions.Remove(typeof(ForeignKeyIndexConvention));
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Trigram index for search_text LIKE '%word%' (DATABASE.md §4).
        modelBuilder.HasPostgresExtension("pg_trgm");
        // «Elan № 10001» is the first listing number (DATABASE.md §2).
        modelBuilder.HasSequence<long>(ListingConfiguration.NumberSequence).StartsAt(10001);
        // «Sorğu № 3001» and the support ticket numbers.
        modelBuilder.HasSequence<long>(ServiceRequestConfiguration.NumberSequence).StartsAt(3001);
        modelBuilder.HasSequence<long>(SupportMessageConfiguration.TicketSequence).StartsAt(1001);
        // «Sifariş № 1001»: promotion orders.
        modelBuilder.HasSequence<long>(PromotionOrderConfiguration.NumberSequence).StartsAt(1001);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
