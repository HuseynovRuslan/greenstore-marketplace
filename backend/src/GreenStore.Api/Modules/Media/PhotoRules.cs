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
/// least 600 px on the shorter side and at most <see cref="PhotoLimits.MaxPixels"/> pixels. Pure rules, no libvips.
/// </summary>
public static class PhotoRules
{
    /* ProblemDetails codes */

    /// <summary>415: not a JPEG, PNG or WebP (HEIC from an iPhone, a PDF, a renamed file).</summary>
    public const string UnsupportedType = "photo.unsupported-type";

    /// <summary>413: over 10 MB.</summary>
    public const string TooLarge = "photo.too-large";

    /// <summary>422: the shorter side is under 600 px.</summary>
    public const string TooSmall = "photo.too-small";

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

    /// <summary>The copy whose address the API sends (<c>cover</c>, <c>images</c>): the largest.</summary>
    public static int DisplayWidth => VariantWidths[^1];

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

    /// <summary>The size rules of the decoded header (the orientation does not matter: the shorter side is the shorter side).</summary>
    public static string? CheckDimensions(int width, int height, PhotoLimits limits)
    {
        if ((long)width * height > limits.MaxPixels)
        {
            return TooManyPixels;
        }

        return Math.Min(width, height) < limits.MinSide ? TooSmall : null;
    }

    /// <summary>Where a photo's files go: <c>p/2026/11/&lt;id&gt;</c>, then <c>/320.webp</c> and the other widths.</summary>
    public static string StorageKey(Guid id, DateTimeOffset createdAt) =>
        string.Create(CultureInfo.InvariantCulture, $"p/{createdAt.UtcDateTime:yyyy}/{createdAt.UtcDateTime:MM}/{id:N}");

    public static string VariantKey(string storageKey, int width) =>
        string.Create(CultureInfo.InvariantCulture, $"{storageKey}/{width}.webp");

    private static ReadOnlySpan<byte> PngSignature => [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
}
