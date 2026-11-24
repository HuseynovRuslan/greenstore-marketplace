using GreenStore.Api.Common;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Data.Seed;

/// <summary>
/// The sample marketplace of seed/demo (Development and Staging only): demo accounts, their business profiles, the
/// product listings in every status and the services. Rows are matched by their natural keys (a user's phone, a
/// seller's slug, a listing's number) and only missing ones are added. Photos keep their site paths ("/images/…"),
/// which Next serves from /public.
/// </summary>
public static class DemoSeeder
{
    public const string UsersFile = "demo/users.json";
    public const string SellersFile = "demo/sellers.json";
    public const string ListingsFile = "demo/listings.json";
    public const string ServicesFile = "demo/services.json";

    private const string AdvanceNumberSequenceSql = $"""
        SELECT setval('{ListingConfiguration.NumberSequence}', m)
        FROM (SELECT max(number) AS m FROM listings) AS top
        WHERE m IS NOT NULL AND m >= (SELECT last_value FROM {ListingConfiguration.NumberSequence})
        """;

    /// <summary>A listing's life before it must be renewed (ARCHITECTURE.md §6).</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(30);

    /// <returns>The number of rows added (users, sellers and listings; photos and counters not counted).</returns>
    public static async Task<int> SeedAsync(AppDbContext db, string directory, TaxonomySnapshot taxonomy, TimeProvider clock, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var users = SeedFiles.Read<UserSeed>(directory, UsersFile);
        var sellers = SeedFiles.Read<SellerSeed>(directory, SellersFile);
        var listings = SeedFiles.Read<ListingSeed>(directory, ListingsFile);
        var services = SeedFiles.Read<ListingSeed>(directory, ServicesFile);
        var added = 0;

        /* Accounts, by phone */
        var phones = users.Select(u => u.Phone).ToList();
        var accounts = await db.Users.Where(u => u.Phone != null && phones.Contains(u.Phone)).ToDictionaryAsync(u => u.Phone!, ct);
        var userByKey = new Dictionary<string, User>(StringComparer.Ordinal);
        foreach (var seed in users)
        {
            if (!accounts.TryGetValue(seed.Phone, out var user))
            {
                user = new User
                {
                    Id = Ids.New(clock),
                    Phone = seed.Phone,
                    Email = seed.Email,
                    FullName = seed.FullName,
                    AccountType = seed.AccountType,
                    PasswordHash = DemoAccounts.NoPassword,
                    CreatedAt = seed.CreatedAt,
                };
                db.Users.Add(user);
                accounts[seed.Phone] = user;
                added++;
            }

            userByKey[seed.Key] = user;
        }

        /* Business profiles, by slug */
        var slugs = sellers.Select(s => s.Slug).ToList();
        var profiles = await db.Sellers.Where(s => slugs.Contains(s.Slug)).ToDictionaryAsync(s => s.Slug, StringComparer.Ordinal, ct);
        var owners = (await db.Sellers.Select(s => s.OwnerUserId).ToListAsync(ct)).ToHashSet();
        var sellerByKey = new Dictionary<string, Seller>(StringComparer.Ordinal);
        foreach (var seed in sellers)
        {
            var owner = userByKey[seed.Owner];
            if (!profiles.TryGetValue(seed.Slug, out var seller))
            {
                if (!owners.Add(owner.Id))
                {
                    continue; // the account already has another business profile (one per account)
                }

                seller = new Seller
                {
                    Id = Ids.New(clock),
                    OwnerUserId = owner.Id,
                    Slug = seed.Slug,
                    Name = seed.Name,
                    BusinessKinds = BusinessKindCodes.From(seed.BusinessKinds),
                    CityId = seed.CityId,
                    Address = seed.Address,
                    Lat = seed.Location?.Lat,
                    Lng = seed.Location?.Lng,
                    About = seed.About,
                    Terms = seed.Terms,
                    Hours = seed.Hours,
                    Offers = seed.Offers.Select(o => KebabCase.Value(o)).ToList(),
                    Phone = seed.Phone == owner.Phone ? null : seed.Phone,
                    Whatsapp = seed.Whatsapp,
                    Email = seed.Email,
                    ContactPerson = seed.ContactPerson,
                    Instagram = seed.Instagram,
                    Website = seed.Website,
                    ResponseMinutes = seed.ResponseMinutes,
                    LogoPhoto = SitePhoto(seed.Logo, owner, PhotoPurpose.SellerLogo, seed.CreatedAt, clock),
                    CoverPhoto = SitePhoto(seed.Cover, owner, PhotoPurpose.SellerCover, seed.CreatedAt, clock),
                    VerifiedAt = seed.Verified ? seed.CreatedAt : null,
                    CreatedAt = seed.CreatedAt,
                };
                db.Sellers.Add(seller);
                profiles[seed.Slug] = seller;
                added++;
            }

            sellerByKey[seed.Key] = seller;
        }

        /* Listings and services, by number */
        var all = listings.Select(l => (Seed: l, Kind: CategoryKind.Product))
            .Concat(services.Select(s => (Seed: s, Kind: CategoryKind.Service)))
            .ToList();
        var numbers = all.Select(x => x.Seed.Number).ToList();
        var existing = (await db.Listings.Where(l => numbers.Contains(l.Number)).Select(l => l.Number).ToListAsync(ct)).ToHashSet();
        foreach (var (seed, kind) in all)
        {
            if (!existing.Add(seed.Number))
            {
                continue;
            }

            var owner = userByKey[seed.Owner];
            var seller = seed.Seller is { } key ? sellerByKey.GetValueOrDefault(key) : null;
            var listing = ToListing(seed, kind, owner, seller, now, clock);
            listing.SearchText = ListingSearchText.For(listing, taxonomy, seller?.Name ?? owner.FullName);
            db.Listings.Add(listing);
            added++;
        }

        await db.SaveChangesAsync(ct);

        // The numbers above came from the files; the sequence continues after the highest one (DATABASE.md §2).
        await db.Database.ExecuteSqlRawAsync(AdvanceNumberSequenceSql, ct);
        return added;
    }

    private static Listing ToListing(ListingSeed seed, CategoryKind kind, User owner, Seller? seller, DateTimeOffset now, TimeProvider clock)
    {
        var plant = seed.Plant;
        var active = seed.Status == ListingStatus.Active;
        var published = seed.PublishedAt;
        var listing = new Listing
        {
            Id = Ids.New(clock),
            Number = seed.Number,
            Slug = ListingSlug.Create(seed.Title, seed.Number),
            Kind = kind,
            OwnerUserId = owner.Id,
            SellerId = seller?.Id,
            CategoryId = seed.CategoryId,
            SubcategoryId = seed.SubcategoryId,
            Status = seed.Status,
            Title = seed.Title,
            Description = string.Join("\n\n", seed.Description),
            PriceType = seed.PriceType,
            Price = seed.PriceType == PriceType.Agreement ? null : seed.Price,
            PriceUnit = seed.PriceUnit,
            WholesalePrice = seed.Wholesale?.Price,
            WholesaleMinQty = seed.Wholesale?.MinQuantity,
            QuantityAvailable = seed.QuantityAvailable,
            CityId = seed.CityId,
            Area = seed.Area,
            DeliveryAvailable = seed.DeliveryAvailable,
            DeliveryAreas = seed.DeliveryAreas,
            PlantingAvailable = seed.PlantingAvailable,
            ContactName = seed.ContactName,
            ContactPhone = seed.ContactPhone,
            ContactPhoneVerified = seed.ContactPhone == owner.Phone,
            Whatsapp = seed.Whatsapp,
            PhoneHidden = seed.PhoneHidden,
            Species = plant?.Species,
            HeightMinCm = plant?.HeightCm?.Min,
            HeightMaxCm = plant?.HeightCm?.Max,
            AgeYears = plant?.AgeYears is { } age ? (short)age : null,
            RootSystem = plant?.RootSystem,
            Plant = plant is null
                ? null
                : new PlantDetails
                {
                    PotLitres = plant.PotLitres,
                    Sun = plant.Sun,
                    Water = plant.Water,
                    FrostHardinessC = plant.FrostHardinessC,
                    Foliage = plant.Foliage,
                    PlantingMonths = plant.PlantingMonths,
                },
            Attributes = seed.Attributes,
            CareTips = seed.CareTips.ToList(),
            ServiceCityIds = seed.Areas.ToList(),
            Includes = seed.Includes.ToList(),
            IsPromoted = seed.Promoted,
            // Promoted since publication: among themselves the demo's «Önə çıxan» keep the site's order (sort_at).
            PromotedAt = seed.Promoted ? published ?? seed.SubmittedAt ?? now : null,
            SortAt = published,
            RejectionReasonCode = seed.RejectionReasonCode,
            RejectionNote = seed.RejectionNote,
            CreatedAt = seed.SubmittedAt ?? published ?? now,
            EditedAt = seed.EditedAt,
            SubmittedAt = seed.SubmittedAt,
            PublishedAt = published,
            // An active demo listing stays active for a full term from seeding, so the expiry job (phase 3) does not
            // end it on the first run; other statuses keep their dates.
            ExpiresAt = active && (seed.ExpiresAt is null || seed.ExpiresAt <= now) ? now + Lifetime : seed.ExpiresAt,
            Counter = new ListingCounter { Views = seed.Views },
        };

        for (var i = 0; i < seed.Photos.Count && i < ListingPhoto.MaxPhotos; i++)
        {
            listing.Photos.Add(new ListingPhoto
            {
                Position = (short)i,
                Photo = SitePhoto(seed.Photos[i], owner, PhotoPurpose.Listing, listing.CreatedAt, clock),
            });
        }

        return listing;
    }

    /// <summary>A ready photo that is a file of the website itself ("/images/…").</summary>
    private static Photo? SitePhoto(string? path, User owner, PhotoPurpose purpose, DateTimeOffset createdAt, TimeProvider clock) =>
        string.IsNullOrEmpty(path)
            ? null
            : new Photo
            {
                Id = Ids.New(clock),
                OwnerUserId = owner.Id,
                Purpose = purpose,
                Status = PhotoStatus.Ready,
                StorageKey = path,
                CreatedAt = createdAt,
                AttachedAt = createdAt,
            };
}

/// <summary>Demo accounts (seed/demo/users.json).</summary>
public static class DemoAccounts
{
    /// <summary>
    /// The password hash of a demo account: valid Base64 that ASP.NET Core Identity's <c>PasswordHasher</c> reads as
    /// an unknown, too-short format, so no password ever matches it. Demo accounts cannot sign in with a password.
    /// </summary>
    public const string NoPassword = "AA==";
}
