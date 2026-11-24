using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Media;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// A business's logo and cover (<c>PATCH /me/seller</c> <c>logoPhotoId</c>, <c>coverPhotoId</c>). The site crops the
/// picture in the browser, uploads it like a listing photo (<c>POST /photos</c> with purpose <c>seller-logo</c> or
/// <c>seller-cover</c>, then the file), and sends its id here. The photo must be the caller's own, of that purpose and
/// ready: field errors <c>not-found</c> and <c>not-ready</c> otherwise, as for <c>photoIds</c> of a listing. A set photo
/// is stamped attached, so the daily cleanup keeps it; the photo it replaces (or a removed one) is released, and the
/// cleanup deletes it with its files once it is a day old.
/// </summary>
public static class SellerPhotos
{
    /// <summary>Not one of the caller's photos of this purpose (another account's, a listing photo, an unknown id).</summary>
    public const string NotFound = "not-found";

    /// <summary>A photo still waiting for its file, or one whose file was refused.</summary>
    public const string NotReady = "not-ready";

    /// <summary>Applies what <paramref name="patch"/> sends of the two photos; field errors go to <paramref name="errors"/>.</summary>
    public static async Task ApplyAsync(AppDbContext db, Seller seller, SellerPatch patch, DateTimeOffset now, FieldErrors errors, CancellationToken ct)
    {
        if (patch.Has(nameof(SellerPatch.LogoPhotoId)))
        {
            await SetAsync(db, seller, patch.LogoPhotoId, PhotoPurpose.SellerLogo, "logoPhotoId", now, errors, ct);
        }

        if (patch.Has(nameof(SellerPatch.CoverPhotoId)))
        {
            await SetAsync(db, seller, patch.CoverPhotoId, PhotoPurpose.SellerCover, "coverPhotoId", now, errors, ct);
        }
    }

    private static async Task SetAsync(
        AppDbContext db,
        Seller seller,
        Guid? photoId,
        PhotoPurpose purpose,
        string field,
        DateTimeOffset now,
        FieldErrors errors,
        CancellationToken ct)
    {
        var logo = purpose == PhotoPurpose.SellerLogo;
        var currentId = logo ? seller.LogoPhotoId : seller.CoverPhotoId;
        if (photoId == currentId)
        {
            return;
        }

        Photo? next = null;
        if (photoId is { } id)
        {
            next = await db.Photos.FirstOrDefaultAsync(p => p.Id == id, ct);
            var problem = next is null || next.OwnerUserId != seller.OwnerUserId || next.Purpose != purpose
                ? NotFound
                : next.Status != PhotoStatus.Ready ? NotReady : null;
            if (problem is not null)
            {
                errors.Add(field, problem);
                return;
            }

            next!.AttachedAt ??= now;
        }

        if (currentId is { } previousId)
        {
            var previous = (logo ? seller.LogoPhoto : seller.CoverPhoto) ?? await db.Photos.FirstOrDefaultAsync(p => p.Id == previousId, ct);
            if (previous is not null)
            {
                previous.AttachedAt = null;
            }
        }

        if (logo)
        {
            seller.LogoPhoto = next;
            seller.LogoPhotoId = next?.Id;
        }
        else
        {
            seller.CoverPhoto = next;
            seller.CoverPhotoId = next?.Id;
        }
    }
}
