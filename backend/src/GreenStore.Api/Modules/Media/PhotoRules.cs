using System.Globalization;

namespace GreenStore.Api.Modules.Media;

/// <summary>The image formats an upload may be (by its first bytes, never by its name or declared type).</summary>
public enum ImageFormat
{
    Jpeg,
    Png,
    Webp,
}

/// <summary>The limits of <see cref="PhotoRules"/> (from <see cref="Common.MediaOptions"/>).</summary>
public sealed record PhotoLimits(int MaxBytes, int MinSide, long MaxPixels);

/// <summary>A photo the API will not take; <see cref="Code"/> is the ProblemDetails code.</summary>
public sealed class PhotoRejectedException(string code) : Exception(code)
{
    public string Code { get; } = code;
}

/// <summary>
/// What an uploaded photo must be (ARCHITECTURE.md §11): JPEG, PNG or WebP by its magic bytes, at most 10 MB, at
/// least 600 px on the shorter side and at most <see cref="PhotoLimits.MaxPixels"/> pixels. A business's logo and
/// cover have their own sizes and shapes (<see cref="CheckDimensions"/>). Pure rules, no libvips.
/// </summary>
public static class PhotoRules
{
    /* ProblemDetails codes */

    /// <summary>415: not a JPEG, PNG or WebP (HEIC from an iPhone, a PDF, a renamed file).</summary>
    public const string UnsupportedType = "photo.unsupported-type";

    /// <summary>413: over 10 MB.</summary>
    public const string TooLarge = "photo.too-large";

    /// <summary>422: the shorter side is under 600 px (a logo under 400 px, a cover under 1200 × 300 px).</summary>
    public const string TooSmall = "photo.too-small";

    /// <summary>422: a logo that is not near square, or a cover that is not near 4:1 (the site crops both before upload).</summary>
    public const string WrongShape = "photo.wrong-shape";

    /* The profile photos of a business (PATCH /me/seller logoPhotoId, coverPhotoId) */

    /// <summary>A logo's shorter side, at least.</summary>
    public const int LogoMinSide = 400;

    /// <summary>A cover's width and height, at least (4:1).</summary>
    public const int CoverMinWidth = 1200;

    public const int CoverMinHeight = 300;

    /// <summary>Width over height a logo may have: square, give or take a fifth.</summary>
    public const double LogoMinRatio = 0.8;

    public const double LogoMaxRatio = 1.25;

    /// <summary>Width over height a cover may have: 4:1, give or take a little (3.5:1 to 4.5:1).</summary>
    public const double CoverMinRatio = 3.5;

    public const double CoverMaxRatio = 4.5;

    /// <summary>422: more pixels than allowed (a decompression bomb, or a giant panorama).</summary>
    public const string TooManyPixels = "photo.too-many-pixels";

    /// <summary>422: the file says it is an image but cannot be decoded.</summary>
    public const string Unreadable = "photo.unreadable";

    /// <summary>400 / 404 / 410 of the upload address.</summary>
    public const string Empty = "photo.empty";

    public const string UploadNotFound = "photo.upload-not-found";

    public const string UploadExpired = "photo.upload-expired";

    public const string NotFound = "photo.not-found";

    /// <summary>429: too many photos waiting to be attached to a listing.</summary>
    public const string TooManyPending = "photo.too-many";

    /// <summary>Content types <c>POST /photos</c> accepts (the wizard's).</summary>
    public static readonly IReadOnlyDictionary<string, ImageFormat> ContentTypes = new Dictionary<string, ImageFormat>(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ImageFormat.Jpeg,
        ["image/jpg"] = ImageFormat.Jpeg,
        ["image/png"] = ImageFormat.Png,
        ["image/webp"] = ImageFormat.Webp,
    };

    /// <summary>The widths of the stored copies, WebP each: a card, a gallery on a phone, a gallery on a desktop.</summary>
    public static readonly IReadOnlyList<int> VariantWidths = [320, 640, 1280];

    /// <summary>A logo's copies: a card avatar, the seller page, a sharp seller page on a dense screen.</summary>
    public static readonly IReadOnlyList<int> LogoVariantWidths = [160, 320, 640];

    /// <summary>A cover's copies: a phone, a laptop, a wide screen (the seller page's banner is up to 1440 px wide).</summary>
    public static readonly IReadOnlyList<int> CoverVariantWidths = [640, 1280, 1920];

    /// <summary>The copy whose address the API sends for a listing photo (<c>cover</c>, <c>images</c>): the largest.</summary>
    public static int DisplayWidth => VariantWidths[^1];

    /// <summary>The widths of the stored copies of a photo of this purpose.</summary>
    public static IReadOnlyList<int> VariantWidthsFor(PhotoPurpose purpose) => purpose switch
    {
        PhotoPurpose.SellerLogo => LogoVariantWidths,
        PhotoPurpose.SellerCover => CoverVariantWidths,
        _ => VariantWidths,
    };

    /// <summary>The format the first bytes say, or null.</summary>
    public static ImageFormat? Sniff(ReadOnlySpan<byte> head)
    {
        if (head.Length >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF)
        {
            return ImageFormat.Jpeg;
        }

        if (head.Length >= 8 && head[..8].SequenceEqual(PngSignature))
        {
            return ImageFormat.Png;
        }

        if (head.Length >= 12 && head[..4].SequenceEqual("RIFF"u8) && head[8..12].SequenceEqual("WEBP"u8))
        {
            return ImageFormat.Webp;
        }

        return null;
    }

    /// <summary>Checks what <c>POST /photos</c> declares; the upload is checked again for real.</summary>
    public static string? CheckDeclared(string? contentType, long bytes, PhotoLimits limits)
    {
        if (contentType is null || !ContentTypes.ContainsKey(contentType.Trim()))
        {
            return UnsupportedType;
        }

        return bytes switch
        {
            <= 0 => Empty,
            _ when bytes > limits.MaxBytes => TooLarge,
            _ => null,
        };
    }

    /// <summary>
    /// The size rules of the decoded header. A listing photo: the shorter side (its orientation does not matter). A
    /// logo: at least <see cref="LogoMinSide"/> and near square. A cover: at least <see cref="CoverMinWidth"/> ×
    /// <see cref="CoverMinHeight"/> and near 4:1.
    /// </summary>
    public static string? CheckDimensions(int width, int height, PhotoLimits limits, PhotoPurpose purpose = PhotoPurpose.Listing)
    {
        if ((long)width * height > limits.MaxPixels)
        {
            return TooManyPixels;
        }

        var ratio = height > 0 ? (double)width / height : 0;
        return purpose switch
        {
            PhotoPurpose.SellerLogo when Math.Min(width, height) < LogoMinSide => TooSmall,
            PhotoPurpose.SellerLogo when ratio is < LogoMinRatio or > LogoMaxRatio => WrongShape,
            PhotoPurpose.SellerLogo => null,
            PhotoPurpose.SellerCover when width < CoverMinWidth || height < CoverMinHeight => TooSmall,
            PhotoPurpose.SellerCover when ratio is < CoverMinRatio or > CoverMaxRatio => WrongShape,
            PhotoPurpose.SellerCover => null,
            _ => Math.Min(width, height) < limits.MinSide ? TooSmall : null,
        };
    }

    /// <summary>Where a photo's files go: <c>p/2026/11/&lt;id&gt;</c>, then <c>/320.webp</c> and the other widths.</summary>
    public static string StorageKey(Guid id, DateTimeOffset createdAt) =>
        string.Create(CultureInfo.InvariantCulture, $"p/{createdAt.UtcDateTime:yyyy}/{createdAt.UtcDateTime:MM}/{id:N}");

    public static string VariantKey(string storageKey, int width) =>
        string.Create(CultureInfo.InvariantCulture, $"{storageKey}/{width}.webp");

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
}
