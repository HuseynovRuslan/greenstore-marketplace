using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Media;

/// <summary>ProblemDetails status of each photo code.</summary>
public static class MediaErrors
{
    public static int StatusOf(string code) => code switch
    {
        PhotoRules.UnsupportedType => StatusCodes.Status415UnsupportedMediaType,
        PhotoRules.TooLarge => StatusCodes.Status413PayloadTooLarge,
        PhotoRules.Empty => StatusCodes.Status400BadRequest,
        PhotoRules.UploadNotFound or PhotoRules.NotFound => StatusCodes.Status404NotFound,
        PhotoRules.UploadExpired => StatusCodes.Status410Gone,
        PhotoRules.TooManyPending => StatusCodes.Status429TooManyRequests,
        _ => StatusCodes.Status422UnprocessableEntity,
    };
}

/// <summary>
/// Photo uploads (ARCHITECTURE.md §11). The site's server asks for an upload address (<c>POST /photos</c>, signed in);
/// the browser sends the file straight to it (<c>PUT /photo-uploads/{token}</c>: one use, 10 minutes, no session,
/// CORS for the site's origin). The API checks and processes it at once, so the answer says whether the photo is
/// ready. Its id then goes into <c>ListingInput.photoIds</c>, or (purpose <c>seller-logo</c>, <c>seller-cover</c>) into
/// <c>PATCH /me/seller</c>; a photo not attached within 24 hours is deleted.
/// </summary>
public static class PhotosEndpoints
{
    public const string UploadCorsPolicy = "photo-upload";

    public static RouteGroupBuilder MapPhotos(this RouteGroupBuilder api)
    {
        api.MapPost("/photos", Create).WithTags("Media").RequireAuthorization();
        api.MapPut("/photo-uploads/{token}", Upload).WithTags("Media").RequireCors(UploadCorsPolicy);
        return api;
    }

    /// <summary>
    /// <c>POST /photos</c> <c>{ fileName?, contentType, bytes, purpose? }</c> → 201 <c>{ photoId, uploadUrl, expiresAt }</c>.
    /// 400 <c>validation</c> (<c>contentType</c>: <c>photo.unsupported-type</c>; <c>bytes</c>: <c>photo.too-large</c>,
    /// <c>photo.empty</c>); 429 <c>photo.too-many</c> when the account has too many photos waiting for a listing.
    /// </summary>
    private static async Task<Created<PhotoUploadDto>> Create(
        PhotoUploadRequest body,
        CurrentUser me,
        HttpContext http,
        AppDbContext db,
        IOptions<MediaOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        var media = options.Value;
        var limits = Limits(media);
        var errors = new FieldErrors();
        var declared = PhotoRules.CheckDeclared(body.ContentType, body.Bytes, limits);
        errors.Add(declared == PhotoRules.UnsupportedType ? "contentType" : "bytes", declared);
        errors.Add("fileName", body.FileName is { Length: > 255 } ? FieldErrors.TooLong : null);
        errors.ThrowIfAny();

        var now = clock.GetUtcNow();
        var since = now - PhotoRetention.Unattached;
        var waiting = await db.Photos.CountAsync(p => p.OwnerUserId == me.UserId && p.AttachedAt == null && p.CreatedAt > since, ct);
        if (waiting >= media.MaxUnattachedPerUser)
        {
            throw new ApiProblemException(StatusCodes.Status429TooManyRequests, PhotoRules.TooManyPending, retryAfter: TimeSpan.FromHours(1));
        }

        var token = SessionTokens.New();
        var photo = new Photo
        {
            Id = Ids.New(clock),
            OwnerUserId = me.UserId,
            Purpose = body.Purpose ?? PhotoPurpose.Listing,
            Status = PhotoStatus.AwaitingUpload,
            UploadTokenHash = SessionTokens.Hash(token),
            UploadExpiresAt = now.AddMinutes(media.UploadMinutes),
            ContentType = body.ContentType!.Trim().ToLowerInvariant(),
            Bytes = (int)body.Bytes,
            CreatedAt = now,
        };
        db.Photos.Add(photo);
        await db.SaveChangesAsync(ct);

        var origin = string.IsNullOrWhiteSpace(media.UploadBaseUrl)
            ? $"{http.Request.Scheme}://{http.Request.Host}{http.Request.PathBase}"
            : media.UploadBaseUrl.TrimEnd('/');
        var uploadUrl = $"{origin}{ApiRoutes.Prefix}/photo-uploads/{token}";
        return TypedResults.Created(uploadUrl, new PhotoUploadDto(photo.Id.ToString(), uploadUrl, photo.UploadExpiresAt.Value));
    }

    /// <summary>
    /// <c>PUT /photo-uploads/{token}</c> with the file as the body → <c>{ photoId, status: "ready", width, height, url }</c>.
    /// 404 <c>photo.upload-not-found</c> (unknown or used token), 410 <c>photo.upload-expired</c>, 413
    /// <c>photo.too-large</c>, 415 <c>photo.unsupported-type</c>, 422 <c>photo.too-small</c>,
    /// <c>photo.wrong-shape</c> (a logo or a cover), <c>photo.too-many-pixels</c>, <c>photo.unreadable</c>. A refused
    /// file leaves the photo <c>failed</c>: ask for a new address to try again.
    /// </summary>
    private static async Task<Ok<UploadedPhotoDto>> Upload(
        string token,
        HttpContext http,
        AppDbContext db,
        PhotoService photos,
        IOptions<MediaOptions> options,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (!SessionTokens.IsWellFormed(token))
        {
            throw new PhotoRejectedException(PhotoRules.UploadNotFound);
        }

        var media = options.Value;
        var hash = SessionTokens.Hash(token);
        var photo = await db.Photos.FirstOrDefaultAsync(p => p.UploadTokenHash == hash && p.Status == PhotoStatus.AwaitingUpload, ct)
            ?? throw new PhotoRejectedException(PhotoRules.UploadNotFound);
        var now = clock.GetUtcNow();
        if (photo.UploadExpiresAt <= now)
        {
            throw new PhotoRejectedException(PhotoRules.UploadExpired);
        }

        // One use: taken before reading the body, so a second PUT with the same token finds nothing.
        var taken = await db.Photos
            .Where(p => p.Id == photo.Id && p.UploadTokenHash == hash && p.Status == PhotoStatus.AwaitingUpload)
            .ExecuteUpdateAsync(p => p.SetProperty(x => x.Status, PhotoStatus.Processing).SetProperty(x => x.UploadTokenHash, (byte[]?)null), ct);
        if (taken == 0)
        {
            throw new PhotoRejectedException(PhotoRules.UploadNotFound);
        }

        if (http.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } size)
        {
            size.MaxRequestBodySize = media.MaxBytes + 1;
        }

        byte[] file;
        try
        {
            file = await ReadBodyAsync(http.Request, media.MaxBytes, ct);
        }
        catch (PhotoRejectedException rejected)
        {
            await photos.FailAsync(photo.Id, rejected.Code, ct);
            throw;
        }
        catch (BadHttpRequestException tooLarge) when (tooLarge.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            await photos.FailAsync(photo.Id, PhotoRules.TooLarge, ct);
            throw new PhotoRejectedException(PhotoRules.TooLarge);
        }

        var ready = await photos.ProcessAsync(photo.Id, file, ct);
        return TypedResults.Ok(new UploadedPhotoDto(ready.Id.ToString(), ready.Status, ready.Width ?? 0, ready.Height ?? 0, PhotoUrls.Of(ready, media.BaseUrl) ?? string.Empty));
    }

    public static PhotoLimits Limits(MediaOptions media) => new(media.MaxBytes, media.MinSide, media.MaxPixels);

    /// <summary>The body, or <see cref="PhotoRules.TooLarge"/> as soon as it passes the limit (a lying Content-Length too).</summary>
    private static async Task<byte[]> ReadBodyAsync(HttpRequest request, int maxBytes, CancellationToken ct)
    {
        if (request.ContentLength > maxBytes)
        {
            throw new PhotoRejectedException(PhotoRules.TooLarge);
        }

        using var buffer = new MemoryStream(request.ContentLength is { } length and > 0 ? (int)length : 64 * 1024);
        var chunk = new byte[81920];
        int read;
        while ((read = await request.Body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > maxBytes)
            {
                throw new PhotoRejectedException(PhotoRules.TooLarge);
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }
}

public sealed record PhotoUploadRequest
{
    public string? FileName { get; init; }

    public string? ContentType { get; init; }

    public long Bytes { get; init; }

    /// <summary><c>listing</c> (the default), <c>seller-logo</c>, <c>seller-cover</c>.</summary>
    public PhotoPurpose? Purpose { get; init; }
}

/// <summary>Where to send the file: <c>{ photoId, uploadUrl, expiresAt }</c> (backend-contract.md 3.2).</summary>
public sealed record PhotoUploadDto(string PhotoId, string UploadUrl, DateTimeOffset ExpiresAt);

public sealed record UploadedPhotoDto(string PhotoId, PhotoStatus Status, int Width, int Height, string Url);

/// <summary>How long photos wait to be attached (DATABASE.md §5).</summary>
public static class PhotoRetention
{
    public static readonly TimeSpan Unattached = TimeSpan.FromHours(24);
}

/// <summary>Processing an uploaded file into its stored copies, and deleting photos nobody attached.</summary>
public sealed class PhotoService(
    AppDbContext db,
    IFileStorage storage,
    PhotoProcessor processor,
    IOptions<MediaOptions> options,
    TimeProvider clock,
    ILogger<PhotoService> logger)
{
    /// <summary>Checks and processes the file, stores the copies and marks the photo ready; a refused file marks it failed.</summary>
    public async Task<Photo> ProcessAsync(Guid photoId, byte[] file, CancellationToken ct)
    {
        var photo = await db.Photos.FirstAsync(p => p.Id == photoId, ct);
        ProcessedPhoto processed;
        try
        {
            processed = processor.Process(file, PhotosEndpoints.Limits(options.Value), photo.Purpose);
        }
        catch (PhotoRejectedException rejected)
        {
            await FailAsync(photoId, rejected.Code, ct);
            throw;
        }

        var key = PhotoRules.StorageKey(photo.Id, photo.CreatedAt);
        var variants = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (width, bytes) in processed.Variants)
        {
            var variantKey = PhotoRules.VariantKey(key, width);
            await storage.SaveAsync(variantKey, bytes, "image/webp", ct);
            variants[width.ToString(System.Globalization.CultureInfo.InvariantCulture)] = variantKey;
        }

        photo.Status = PhotoStatus.Ready;
        photo.ContentType = processed.Format switch
        {
            ImageFormat.Jpeg => "image/jpeg",
            ImageFormat.Png => "image/png",
            _ => "image/webp",
        };
        photo.Bytes = file.Length;
        photo.Width = processed.Width;
        photo.Height = processed.Height;
        photo.StorageKey = key;
        photo.Variants = variants;
        photo.Error = null;
        photo.UploadExpiresAt = null;
        await db.SaveChangesAsync(ct);
        return photo;
    }

    public async Task FailAsync(Guid photoId, string code, CancellationToken ct) =>
        await db.Photos.Where(p => p.Id == photoId)
            .ExecuteUpdateAsync(p => p.SetProperty(x => x.Status, PhotoStatus.Failed).SetProperty(x => x.Error, code), ct);

    /// <summary>
    /// Deletes the files and rows of photos that were never attached within <see cref="PhotoRetention.Unattached"/>
    /// (uploaded and abandoned, failed, or never uploaded). Returns how many.
    /// </summary>
    public async Task<int> DeleteUnattachedAsync(CancellationToken ct)
    {
        var cutoff = clock.GetUtcNow() - PhotoRetention.Unattached;
        var stale = await db.Photos.AsNoTracking()
            .Where(p => p.AttachedAt == null && p.CreatedAt < cutoff)
            .OrderBy(p => p.CreatedAt)
            .Take(1000)
            .ToListAsync(ct);
        var deleted = 0;
        foreach (var photo in stale)
        {
            try
            {
                foreach (var key in photo.Variants?.Values.ToList() ?? [])
                {
                    if (StorageKeys.IsValid(key))
                    {
                        await storage.DeleteAsync(key, ct);
                    }
                }

                // Never one that something points at after all (a profile photo attached without the stamp).
                deleted += await db.Photos
                    .Where(p => p.Id == photo.Id && p.AttachedAt == null)
                    .Where(p => !db.ListingPhotos.Any(lp => lp.PhotoId == p.Id))
                    .Where(p => !db.Sellers.Any(s => s.LogoPhotoId == p.Id || s.CoverPhotoId == p.Id))
                    .ExecuteDeleteAsync(ct);
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                logger.LogWarning(error, "Could not delete unattached photo {PhotoId}", photo.Id);
            }
        }

        return deleted;
    }
}
