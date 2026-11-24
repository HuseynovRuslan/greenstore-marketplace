using NetVips;

namespace GreenStore.Api.Modules.Media;

/// <summary>A processed upload: its size (upright) and the WebP copies by width.</summary>
public sealed record ProcessedPhoto(ImageFormat Format, int Width, int Height, IReadOnlyDictionary<int, byte[]> Variants);

/// <summary>
/// Turns an uploaded file into the stored copies with libvips (NetVips): checks it is what its first bytes say, reads
/// only the header to check its size before decoding anything (so a small file hiding a huge image is refused cheaply),
/// then makes WebP copies of the purpose's widths (a listing photo 320, 640 and 1280 px wide; a logo and a cover their
/// own), turned upright, in sRGB, with every metadata block removed (EXIF can carry the GPS position of the seller's
/// home).
/// </summary>
public sealed class PhotoProcessor
{
    private const int WebpQuality = 82;

    /// <summary>Taller than any photo: the copies are bounded by width only.</summary>
    private const int AnyHeight = 100_000;

    static PhotoProcessor()
    {
        // Only libvips' own loaders: no ImageMagick, PDF or SVG fallbacks for a file that only pretends to be an image.
        NetVips.NetVips.BlockUntrusted = true;
        // Uploads are processed once; libvips' operation cache would only keep their buffers alive.
        Cache.Max = 0;
        // A damaged file is refused through the exception below; libvips' own warnings about it would only reach
        // stderr, outside the API's log.
        Log.SetLogHandler("VIPS", Enums.LogLevelFlags.Warning, static (_, _, _) => { });
    }

    public ProcessedPhoto Process(byte[] file, PhotoLimits limits, PhotoPurpose purpose = PhotoPurpose.Listing)
    {
        if (file.Length == 0)
        {
            throw new PhotoRejectedException(PhotoRules.Empty);
        }

        if (file.Length > limits.MaxBytes)
        {
            throw new PhotoRejectedException(PhotoRules.TooLarge);
        }

        var format = PhotoRules.Sniff(file) ?? throw new PhotoRejectedException(PhotoRules.UnsupportedType);
        int width;
        int height;
        try
        {
            // The loader of the sniffed format only; lazy, so this reads the header and nothing else.
            using var header = Load(file, format, Enums.FailOn.Error);
            using var upright = header.Autorot();
            width = upright.Width;
            height = upright.Height;
        }
        catch (VipsException)
        {
            throw new PhotoRejectedException(PhotoRules.Unreadable);
        }

        if (PhotoRules.CheckDimensions(width, height, limits, purpose) is { } problem)
        {
            throw new PhotoRejectedException(problem);
        }

        var variants = new Dictionary<int, byte[]>();
        try
        {
            // The whole file is decoded once, streaming, so a cut-off or damaged upload is refused rather than stored
            // half grey: the copies below decode it shrunk, which does not notice a missing end.
            using (var full = Load(file, format, Enums.FailOn.Truncated))
            {
                _ = full.Avg();
            }

            foreach (var target in PhotoRules.VariantWidthsFor(purpose))
            {
                using var copy = Image.ThumbnailBuffer(
                    file,
                    target,
                    height: AnyHeight,
                    size: Enums.Size.Down,
                    outputProfile: "srgb",
                    failOn: Enums.FailOn.Error);
                variants[target] = copy.WebpsaveBuffer(q: WebpQuality, keep: Enums.ForeignKeep.None);
            }
        }
        catch (VipsException)
        {
            throw new PhotoRejectedException(PhotoRules.Unreadable);
        }

        return new ProcessedPhoto(format, width, height, variants);
    }

    /// <summary>The loader of the sniffed format only, sequential (lazy: nothing is decoded until pixels are read).</summary>
    private static Image Load(byte[] file, ImageFormat format, Enums.FailOn failOn) => format switch
    {
        ImageFormat.Jpeg => Image.JpegloadBuffer(file, access: Enums.Access.Sequential, failOn: failOn),
        ImageFormat.Png => Image.PngloadBuffer(file, access: Enums.Access.Sequential, failOn: failOn),
        _ => Image.WebploadBuffer(file, access: Enums.Access.Sequential, failOn: failOn),
    };
}
