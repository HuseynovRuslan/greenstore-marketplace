using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Taxonomy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Listings;

/// <summary>What <c>POST /listings</c> and <c>PUT /me/listings/{id}</c> answer (<c>ListingSubmitResult</c> of src/types).</summary>
public sealed record ListingSubmitResultDto(string Id, string Slug, long Number, ListingStatus Status);

/// <summary>
/// The owner's writes of the listing lifecycle (ARCHITECTURE.md §6): sending a new listing, editing it, renewing,
/// deactivating, activating and deleting it. The status rules are <see cref="ListingLifecycle"/>'s; this class reads
/// and writes the rows: the listing, its photos, a revision for every version sent, and the cache notice, in one
/// transaction (the caller's, when it has one: <see cref="IdempotentRequests"/>).
/// </summary>
public sealed class ListingWriteService(AppDbContext db, TimeProvider clock, IOptions<ListingsOptions> options)
{
    /// <summary>A new listing, pending until the moderator approves it. 400 <c>validation</c>, 429 <c>listing.daily-limit</c>.</summary>
    public async Task<ListingSubmitResultDto> SubmitAsync(CurrentUser me, ListingInputDto input, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var (content, errors) = ListingInputRules.Validate(input, taxonomy);
        errors.ThrowIfAny();
        var pendingPromotion = await PendingPromotionAsync(content!.Promotion, ct);

        var since = now.AddDays(-1);
        var sent = await db.Listings.CountAsync(l => l.OwnerUserId == me.UserId && l.CreatedAt > since, ct);
        if (sent >= options.Value.MaxSubmissionsPerDay)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, ListingErrors.DailyLimit, retryAfter: TimeSpan.FromHours(1));
        }

        await using var transaction = await db.BeginOrJoinTransactionAsync(ct);
        var photos = await PhotosAsync(me.UserId, content.PhotoIds, listingId: null, ct);
        var owner = await db.Users.FirstAsync(u => u.Id == me.UserId, ct);
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.OwnerUserId == me.UserId, ct);
        var number = await db.Database.SqlQuery<long>($"SELECT nextval('listing_number_seq') AS \"Value\"").SingleAsync(ct);

        var listing = new Listing
        {
            Id = Ids.New(clock),
            Number = number,
            Slug = ListingSlug.Create(content.Title, number),
            OwnerUserId = me.UserId,
            SellerId = seller?.Id,
            CategoryId = content.CategoryId,
            Title = content.Title,
            CityId = content.CityId,
            ContactName = content.ContactName,
            ContactPhone = content.ContactPhone,
            CreatedAt = now,
            Counter = new ListingCounter(),
        };
        content.ApplyTo(listing);
        listing.PendingPromotionOptionId = pendingPromotion;
        ListingLifecycle.Submit(now).ApplyTo(listing);
        listing.ContactPhoneVerified = content.ContactPhone == owner.Phone;
        listing.SearchText = ListingSearchText.For(listing, taxonomy, seller?.Name ?? owner.FullName);
        db.Listings.Add(listing);
        AttachPhotos(listing, photos, now);
        db.ListingRevisions.Add(new ListingRevision { ListingId = listing.Id, Revision = 1, Data = content, CreatedAt = now });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new ListingSubmitResultDto(listing.Id.ToString(), listing.Slug, listing.Number, listing.Status);
    }

    /// <summary>
    /// A new version of the owner's listing: back to the moderator (an active one is hidden until approved, decision 2),
    /// the category kept once published. 400 <c>validation</c> (<c>categoryId: locked</c>), 404, 409
    /// <c>concurrency-conflict</c> when <c>version</c> is stale.
    /// </summary>
    public async Task<ListingSubmitResultDto> UpdateAsync(CurrentUser me, Guid id, ListingInputDto input, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await using var transaction = await db.BeginOrJoinTransactionAsync(ct);
        var listing = await OwnAsync(me, id, ct);
        if (input.Version is not null)
        {
            if (!RowVersion.TryParse(input.Version, out var version))
            {
                throw ApiProblemException.Validation("version", FieldErrors.Invalid);
            }

            db.SetExpectedVersion(listing, version);
        }

        var state = LifecycleState.Of(listing);
        var locked = ListingLifecycle.CategoryLocked(state) ? new LockedCategory(listing.Kind, listing.CategoryId, listing.SubcategoryId) : null;
        var taxonomy = await TaxonomySnapshot.LoadAsync(db, ct);
        var (content, errors) = ListingInputRules.Validate(input, taxonomy, locked);
        errors.ThrowIfAny();
        var pendingPromotion = await PendingPromotionAsync(content!.Promotion, ct);
        var next = ListingLifecycle.Apply(state, ListingAction.Edit, now);

        var photos = await PhotosAsync(me.UserId, content.PhotoIds, listing.Id, ct);
        var owner = await db.Users.FirstAsync(u => u.Id == me.UserId, ct);
        var seller = listing.SellerId is { } sellerId ? await db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct) : null;
        var wasPublic = listing.Status == ListingStatus.Active;
        var previousSlug = listing.Slug;
        var revision = await db.ListingRevisions.Where(r => r.ListingId == listing.Id).MaxAsync(r => (int?)r.Revision, ct) ?? 0;
        if (revision == 0)
        {
            // A listing from before revisions existed (the demo data): its current version becomes revision 1, so the
            // moderator sees what this edit changes.
            db.ListingRevisions.Add(new ListingRevision { ListingId = listing.Id, Revision = 1, Data = ListingContent.Of(listing), CreatedAt = listing.SubmittedAt ?? listing.CreatedAt });
            revision = 1;
        }

        content.ApplyTo(listing);
        // The form says what is chosen now: «Pulsuz yerləşdir» clears an earlier choice (a paid one keeps running).
        listing.PendingPromotionOptionId = pendingPromotion;
        next.ApplyTo(listing);
        listing.Slug = ListingSlug.Create(content.Title, listing.Number);
        listing.ContactPhoneVerified = content.ContactPhone == owner.Phone;
        listing.SearchText = ListingSearchText.For(listing, taxonomy, seller?.Name ?? owner.FullName);

        // The gallery is written again (DATABASE.md §3.5): the old rows go in one statement first, so a photo that
        // moved to another position never meets itself on the unique photo_id.
        foreach (var old in listing.Photos)
        {
            db.Entry(old).State = EntityState.Detached;
        }

        listing.Photos.Clear();
        await db.ListingPhotos.Where(p => p.ListingId == listing.Id).ExecuteDeleteAsync(ct);
        AttachPhotos(listing, photos, now);

        db.ListingRevisions.Add(new ListingRevision { ListingId = listing.Id, Revision = revision + 1, Data = content, CreatedAt = now });
        if (wasPublic)
        {
            Revalidation.Enqueue(db, Revalidation.TagsFor(listing, seller?.Slug, previousSlug), now);
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new ListingSubmitResultDto(listing.Id.ToString(), listing.Slug, listing.Number, listing.Status);
    }

    /// <summary>«Yenilə», «Deaktiv et», «Aktiv et», «Sil». 404; 409 <c>listing.wrong-status</c>.</summary>
    public async Task<Listing> ChangeStatusAsync(CurrentUser me, Guid id, ListingAction action, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var listing = await OwnAsync(me, id, ct);
        var wasPublic = listing.Status == ListingStatus.Active;
        ListingLifecycle.Apply(LifecycleState.Of(listing), action, now).ApplyTo(listing);
        var isPublic = listing.Status == ListingStatus.Active && listing.DeletedAt is null;
        if (wasPublic || isPublic)
        {
            var sellerSlug = listing.SellerId is { } sellerId ? await db.Sellers.Where(s => s.Id == sellerId).Select(s => s.Slug).FirstOrDefaultAsync(ct) : null;
            Revalidation.Enqueue(db, Revalidation.TagsFor(listing, sellerSlug), now);
        }

        if (action == ListingAction.Delete)
        {
            // A draft editing it has nothing left to edit.
            db.ListingDrafts.RemoveRange(await db.ListingDrafts.Where(d => d.ListingId == listing.Id).ToListAsync(ct));
        }

        await db.SaveChangesAsync(ct);
        return listing;
    }

    /// <summary>
    /// The promotion chosen in the form (<c>ListingInput.promotion</c>), as the option to pay for after approval: one on
    /// offer of the package named, or 400 <c>validation</c> (<c>promotion: invalid</c>).
    /// </summary>
    private async Task<string?> PendingPromotionAsync(PromotionChoice? choice, CancellationToken ct)
    {
        if (choice is null)
        {
            return null;
        }

        var catalogue = await PromotionCatalogue.LoadAsync(db, ct);
        return catalogue.Offered(choice.PackageId, choice.OptionId)?.Id ?? throw ApiProblemException.Validation("promotion", FieldErrors.Invalid);
    }

    /// <summary>The caller's listing (tracked, with photos), not deleted; 404 <c>listing.not-found</c> otherwise.</summary>
    public async Task<Listing> OwnAsync(CurrentUser me, Guid id, CancellationToken ct)
    {
        var listing = await db.Listings
            .Include(l => l.Photos.OrderBy(p => p.Position)).ThenInclude(p => p.Photo)
            .Include(l => l.Counter)
            .Include(l => l.Seller)
            .AsSplitQuery()
            .FirstOrDefaultAsync(l => l.Id == id && l.DeletedAt == null, ct);
        Access.EnsureCanManage(me, listing?.OwnerUserId, ListingErrors.NotFound);
        return listing!;
    }

    /// <summary>
    /// The photos, in the order given: the caller's own listing photos, ready, and not in another listing. Field
    /// errors on <c>photoIds</c> otherwise (<c>not-found</c>, <c>not-ready</c>, <c>in-use</c>).
    /// </summary>
    private async Task<List<Photo>> PhotosAsync(Guid ownerId, IReadOnlyList<Guid> ids, Guid? listingId, CancellationToken ct)
    {
        var found = await db.Photos.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var inOther = await db.ListingPhotos
            .Where(lp => ids.Contains(lp.PhotoId) && lp.ListingId != listingId)
            .Select(lp => lp.PhotoId)
            .ToListAsync(ct);
        string? problem = null;
        var photos = new List<Photo>();
        foreach (var id in ids)
        {
            if (!found.TryGetValue(id, out var photo) || photo.OwnerUserId != ownerId || photo.Purpose != PhotoPurpose.Listing)
            {
                problem = ListingErrors.PhotoNotFound;
                break;
            }

            if (photo.Status != PhotoStatus.Ready)
            {
                problem = ListingErrors.PhotoNotReady;
                break;
            }

            if (inOther.Contains(id))
            {
                problem = ListingErrors.PhotoInUse;
                break;
            }

            photos.Add(photo);
        }

        if (problem is not null)
        {
            throw ApiProblemException.Validation("photoIds", problem);
        }

        return photos;
    }

    private void AttachPhotos(Listing listing, List<Photo> photos, DateTimeOffset now)
    {
        for (var i = 0; i < photos.Count; i++)
        {
            photos[i].AttachedAt ??= now;
            var row = new ListingPhoto { ListingId = listing.Id, Position = (short)i, PhotoId = photos[i].Id, Photo = photos[i] };
            listing.Photos.Add(row);
            if (db.Entry(listing).State != EntityState.Added)
            {
                db.ListingPhotos.Add(row);
            }
        }
    }
}
