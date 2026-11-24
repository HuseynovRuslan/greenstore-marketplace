using GreenStore.Api.Modules.Media;
using GreenStore.Api.Tests.Infrastructure;
using NetVips;

namespace GreenStore.Api.Tests.Media;

/// <summary>The upload rules (ARCHITECTURE.md §11) without HTTP: magic bytes, sizes, the stored copies.</summary>
public sealed class PhotoRulesTests
{
    private static readonly PhotoLimits Limits = new(10 * 1024 * 1024, 600, 50_000_000);

    [Fact]
    public void The_format_is_read_from_the_first_bytes()
    {
        Assert.Equal(ImageFormat.Jpeg, PhotoRules.Sniff(TestImages.Jpeg(700, 700)));
        Assert.Equal(ImageFormat.Png, PhotoRules.Sniff(TestImages.Png(700, 700)));
        Assert.Equal(ImageFormat.Webp, PhotoRules.Sniff(TestImages.Webp(700, 700)));
        Assert.Null(PhotoRules.Sniff("%PDF-1.7 something"u8));
        Assert.Null(PhotoRules.Sniff("GIF89a......"u8));
        // HEIC from an iPhone: "ftypheic" after the box size.
        Assert.Null(PhotoRules.Sniff([0, 0, 0, 24, .. "ftypheic"u8, 0, 0, 0, 0]));
        Assert.Null(PhotoRules.Sniff([0xFF, 0xD8]));
        Assert.Null(PhotoRules.Sniff([]));
    }

    [Theory]
    [InlineData("image/jpeg", 1000, null)]
    [InlineData("IMAGE/PNG", 1000, null)]
    [InlineData("image/webp", 10 * 1024 * 1024, null)]
    [InlineData("image/heic", 1000, PhotoRules.UnsupportedType)]
    [InlineData("application/pdf", 1000, PhotoRules.UnsupportedType)]
    [InlineData(null, 1000, PhotoRules.UnsupportedType)]
    [InlineData("image/jpeg", 10 * 1024 * 1024 + 1, PhotoRules.TooLarge)]
    [InlineData("image/jpeg", 0, PhotoRules.Empty)]
    public void What_is_declared_is_checked_before_the_upload(string? contentType, long bytes, string? expected) =>
        Assert.Equal(expected, PhotoRules.CheckDeclared(contentType, bytes, Limits));

    [Theory]
    [InlineData(600, 600, null)]
    [InlineData(4000, 3000, null)]
    [InlineData(599, 4000, PhotoRules.TooSmall)]
    [InlineData(4000, 599, PhotoRules.TooSmall)]
    [InlineData(10_000, 5_001, PhotoRules.TooManyPixels)]
    [InlineData(100_000, 600, PhotoRules.TooManyPixels)]
    public void The_shorter_side_and_the_pixels_have_limits(int width, int height, string? expected) =>
        Assert.Equal(expected, PhotoRules.CheckDimensions(width, height, Limits));

    [Theory]
    [InlineData(PhotoPurpose.SellerLogo, 400, 400, null)]
    [InlineData(PhotoPurpose.SellerLogo, 800, 700, null)]
    [InlineData(PhotoPurpose.SellerLogo, 399, 399, PhotoRules.TooSmall)]
    [InlineData(PhotoPurpose.SellerLogo, 1000, 600, PhotoRules.WrongShape)]
    [InlineData(PhotoPurpose.SellerLogo, 600, 1000, PhotoRules.WrongShape)]
    [InlineData(PhotoPurpose.SellerCover, 1200, 300, null)]
    [InlineData(PhotoPurpose.SellerCover, 2400, 600, null)]
    [InlineData(PhotoPurpose.SellerCover, 1199, 300, PhotoRules.TooSmall)]
    [InlineData(PhotoPurpose.SellerCover, 1600, 299, PhotoRules.TooSmall)]
    [InlineData(PhotoPurpose.SellerCover, 1600, 800, PhotoRules.WrongShape)]
    [InlineData(PhotoPurpose.SellerCover, 3000, 600, PhotoRules.WrongShape)]
    [InlineData(PhotoPurpose.SellerCover, 20_000, 5_000, PhotoRules.TooManyPixels)]
    public void A_logo_and_a_cover_have_their_own_sizes_and_shapes(PhotoPurpose purpose, int width, int height, string? expected) =>
        Assert.Equal(expected, PhotoRules.CheckDimensions(width, height, Limits, purpose));

    [Theory]
    [InlineData("https://cdn.greenstore.az", "https://api.greenstore.az", 0)]
    [InlineData("http://localhost:5080/media", "http://localhost:5080", 0)]
    [InlineData("https://cdn.greenstore.az", "", 1)]
    [InlineData("/media", "https://api.greenstore.az", 1)]
    [InlineData("/media", "", 2)]
    public void A_deployment_is_warned_about_addresses_the_browser_cannot_reach(string baseUrl, string uploadBaseUrl, int warnings)
    {
        var found = new GreenStore.Api.Common.MediaOptions { BaseUrl = baseUrl, UploadBaseUrl = uploadBaseUrl }.DeployWarnings().ToList();

        Assert.Equal(warnings, found.Count);
        Assert.All(found, w => Assert.StartsWith("Media:", w, StringComparison.Ordinal));
    }

    [Fact]
    public void Files_are_kept_under_the_month_and_the_id()
    {
        var id = Guid.Parse("019a8b4e-0000-7000-8000-000000000001");
        var key = PhotoRules.StorageKey(id, new DateTimeOffset(2026, 11, 22, 23, 30, 0, TimeSpan.FromHours(-2)));

        Assert.Equal("p/2026/11/019a8b4e000070008000000000000001", key);
        Assert.Equal("p/2026/11/019a8b4e000070008000000000000001/640.webp", PhotoRules.VariantKey(key, 640));
        Assert.True(StorageKeys.IsValid(PhotoRules.VariantKey(key, 640)));
        Assert.Equal(1280, PhotoRules.DisplayWidth);
    }

    [Theory]
    [InlineData("p/2026/11/abc/640.webp", true)]
    [InlineData("../etc/passwd", false)]
    [InlineData("/etc/passwd", false)]
    [InlineData("p//x", false)]
    [InlineData("p/./x", false)]
    [InlineData("p/X.webp", false)]
    [InlineData("", false)]
    public void Storage_keys_never_leave_the_storage(string key, bool valid) => Assert.Equal(valid, StorageKeys.IsValid(key));
}

/// <summary>libvips processing: the real native library, as the API runs it.</summary>
public sealed class PhotoProcessorTests
{
    private static readonly PhotoLimits Limits = new(10 * 1024 * 1024, 600, 50_000_000);
    private readonly PhotoProcessor processor = new();

    [Fact]
    public void A_photo_becomes_three_webp_copies_without_metadata()
    {
        var file = TestImages.Jpeg(1600, 1200);
        var result = processor.Process(file, Limits);

        Assert.Equal(ImageFormat.Jpeg, result.Format);
        Assert.Equal((1600, 1200), (result.Width, result.Height));
        Assert.Equal([320, 640, 1280], result.Variants.Keys.Order());
        foreach (var (width, bytes) in result.Variants)
        {
            Assert.Equal(ImageFormat.Webp, PhotoRules.Sniff(bytes));
            using var copy = Image.NewFromBuffer(bytes);
            Assert.Equal(width, copy.Width);
            Assert.Equal(width * 3 / 4, copy.Height);
            Assert.DoesNotContain(copy.GetFields(), f => f.StartsWith("exif", StringComparison.Ordinal) || f is "xmp-data" or "iptc-data" or "icc-profile-data");
        }
    }

    [Fact]
    public void A_logo_and_a_cover_get_their_own_copies()
    {
        var logo = processor.Process(TestImages.Jpeg(800, 800), Limits, PhotoPurpose.SellerLogo);
        var cover = processor.Process(TestImages.Jpeg(2400, 600), Limits, PhotoPurpose.SellerCover);

        Assert.Equal([160, 320, 640], logo.Variants.Keys.Order());
        Assert.Equal([640, 1280, 1920], cover.Variants.Keys.Order());
        using var wide = Image.NewFromBuffer(cover.Variants[1920]);
        Assert.Equal((1920, 480), (wide.Width, wide.Height));
        Assert.Equal(PhotoRules.WrongShape, Assert.Throws<PhotoRejectedException>(() => processor.Process(TestImages.Jpeg(1600, 1200), Limits, PhotoPurpose.SellerCover)).Code);
    }

    [Fact]
    public void A_photo_taken_with_the_phone_turned_comes_out_upright()
    {
        var file = TestImages.Jpeg(1600, 1200, orientation: 6);
        using (var original = Image.NewFromBuffer(file))
        {
            Assert.Contains("exif-data", original.GetFields());
        }

        var result = processor.Process(file, Limits);

        Assert.Equal((1200, 1600), (result.Width, result.Height));
        using var copy = Image.NewFromBuffer(result.Variants[640]);
        Assert.Equal(640, copy.Width);
        Assert.InRange(copy.Height, 853, 854);
        Assert.DoesNotContain("orientation", copy.GetFields());
    }

    [Fact]
    public void A_small_photo_is_never_enlarged()
    {
        var result = processor.Process(TestImages.Png(700, 650), Limits);

        using var large = Image.NewFromBuffer(result.Variants[1280]);
        Assert.Equal(700, large.Width);
        Assert.Equal(ImageFormat.Png, result.Format);
    }

    [Theory]
    [InlineData(599, 900, PhotoRules.TooSmall)]
    [InlineData(900, 599, PhotoRules.TooSmall)]
    public void A_photo_under_600_px_is_refused(int width, int height, string code) =>
        Assert.Equal(code, Assert.Throws<PhotoRejectedException>(() => processor.Process(TestImages.Jpeg(width, height), Limits)).Code);

    [Fact]
    public void Too_many_pixels_are_refused_from_the_header_alone()
    {
        // A 9000 × 9000 PNG of one colour is a few hundred kilobytes: a decompression bomb in miniature.
        var bomb = TestImages.Png(9000, 9000);
        Assert.True(bomb.Length < 2 * 1024 * 1024);

        Assert.Equal(PhotoRules.TooManyPixels, Assert.Throws<PhotoRejectedException>(() => processor.Process(bomb, Limits)).Code);
    }

    [Fact]
    public void Files_that_are_not_photos_are_refused()
    {
        Assert.Equal(PhotoRules.UnsupportedType, Assert.Throws<PhotoRejectedException>(() => processor.Process("%PDF-1.7 not an image"u8.ToArray(), Limits)).Code);
        Assert.Equal(PhotoRules.Empty, Assert.Throws<PhotoRejectedException>(() => processor.Process([], Limits)).Code);
        Assert.Equal(PhotoRules.TooLarge, Assert.Throws<PhotoRejectedException>(() => processor.Process(new byte[1001], new PhotoLimits(1000, 600, 50_000_000))).Code);

        // JPEG magic bytes, then rubbish.
        byte[] fake = [0xFF, 0xD8, 0xFF, 0xE0, .. Enumerable.Repeat((byte)0x41, 4000)];
        Assert.Equal(PhotoRules.Unreadable, Assert.Throws<PhotoRejectedException>(() => processor.Process(fake, Limits)).Code);
    }

    [Fact]
    public void A_cut_off_upload_is_refused()
    {
        var file = TestImages.Jpeg(1200, 900);

        Assert.Equal(PhotoRules.Unreadable, Assert.Throws<PhotoRejectedException>(() => processor.Process(file[..(file.Length / 2)], Limits)).Code);
    }
}

/// <summary>The local disk storage of Development (and of the tests).</summary>
public sealed class LocalDiskStorageTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "greenstore-storage-test-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(root))
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public async Task Saves_and_deletes_files_and_their_emptied_folder()
    {
        var storage = new LocalDiskStorage(root);
        var key = "p/2026/11/abc/640.webp";

        await storage.SaveAsync(key, [1, 2, 3], "image/webp", HttpAssert.Ct);
        Assert.Equal([1, 2, 3], await File.ReadAllBytesAsync(Path.Combine(root, "p", "2026", "11", "abc", "640.webp"), HttpAssert.Ct));
        Assert.Empty(Directory.GetFiles(Path.Combine(root, "p", "2026", "11", "abc"), "*.tmp"));

        await storage.DeleteAsync(key, HttpAssert.Ct);
        Assert.False(Directory.Exists(Path.Combine(root, "p", "2026", "11", "abc")));
        // Deleting again is no error.
        await storage.DeleteAsync(key, HttpAssert.Ct);
    }

    [Theory]
    [InlineData("../outside.webp")]
    [InlineData("/etc/passwd")]
    [InlineData("p/../../x")]
    public void Refuses_keys_that_would_leave_its_folder(string key) =>
        Assert.Throws<ArgumentException>(() => new LocalDiskStorage(root).PathOf(key));
}
