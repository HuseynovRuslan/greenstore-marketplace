using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using GreenStore.Api.Common;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Media;

/// <summary>
/// Where photo files live (ARCHITECTURE.md §11): the API's disk in Development (<see cref="LocalDiskStorage"/>), an
/// S3-compatible bucket behind a CDN in production (<see cref="S3FileStorage"/>). Keys are relative paths like
/// <c>p/2026/11/&lt;id&gt;/640.webp</c>; a file is written once and never changed, so it can be cached for good.
/// </summary>
public interface IFileStorage
{
    Task SaveAsync(string key, byte[] content, string contentType, CancellationToken ct);

    /// <summary>Removes the file; a missing one is no error.</summary>
    Task DeleteAsync(string key, CancellationToken ct);
}

/// <summary>Files under <c>Media:LocalPath</c>, which the API serves under /media (Program.cs).</summary>
public sealed class LocalDiskStorage : IFileStorage
{
    public LocalDiskStorage(IOptions<MediaOptions> options, IHostEnvironment environment)
        : this(Root(options.Value, environment))
    {
    }

    public LocalDiskStorage(string root)
    {
        RootPath = Path.GetFullPath(root);
        Directory.CreateDirectory(RootPath);
    }

    public string RootPath { get; }

    /// <summary>The folder of the files: <c>Media:LocalPath</c>, relative to the content root.</summary>
    public static string Root(MediaOptions options, IHostEnvironment environment) =>
        Path.GetFullPath(Path.IsPathRooted(options.LocalPath) ? options.LocalPath : Path.Combine(environment.ContentRootPath, options.LocalPath));

    public async Task SaveAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        var path = PathOf(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        // Written next to its place, then moved: a reader never sees half a file.
        var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        await File.WriteAllBytesAsync(temporary, content, ct);
        File.Move(temporary, path, overwrite: true);
    }

    public Task DeleteAsync(string key, CancellationToken ct)
    {
        var path = PathOf(key);
        if (File.Exists(path))
        {
            File.Delete(path);
        }

        // An emptied photo folder goes too.
        var folder = Path.GetDirectoryName(path);
        if (folder is not null && folder != RootPath && Directory.Exists(folder) && !Directory.EnumerateFileSystemEntries(folder).Any())
        {
            Directory.Delete(folder);
        }

        return Task.CompletedTask;
    }

    /// <summary>The file of a key, refusing anything that would leave the root.</summary>
    public string PathOf(string key)
    {
        if (!StorageKeys.IsValid(key))
        {
            throw new ArgumentException($"Not a storage key: {key}", nameof(key));
        }

        var path = Path.GetFullPath(Path.Combine(RootPath, key));
        if (!path.StartsWith(RootPath + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new ArgumentException($"Not a storage key: {key}", nameof(key));
        }

        return path;
    }
}

/// <summary>
/// An S3-compatible bucket (Cloudflare R2, Hetzner Object Storage, AWS S3), section <c>Media:S3</c>. The CDN in front
/// of it is <c>Media:BaseUrl</c>. Files get a year of public caching: their keys never repeat.
/// </summary>
public sealed class S3FileStorage(IAmazonS3 client, IOptions<MediaOptions> options) : IFileStorage
{
    public const string CacheControl = "public, max-age=31536000, immutable";

    private readonly string bucket = options.Value.S3.Bucket;

    public static IAmazonS3 CreateClient(S3StorageOptions s3)
    {
        var config = new AmazonS3Config
        {
            ForcePathStyle = s3.ForcePathStyle,
            // Only the checksums a request needs: some S3-compatible providers refuse the newer default headers.
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED,
            ResponseChecksumValidation = ResponseChecksumValidation.WHEN_REQUIRED,
        };
        if (!string.IsNullOrWhiteSpace(s3.ServiceUrl))
        {
            config.ServiceURL = s3.ServiceUrl;
            config.AuthenticationRegion = s3.Region;
        }
        else
        {
            config.RegionEndpoint = RegionEndpoint.GetBySystemName(s3.Region);
        }

        return new AmazonS3Client(new BasicAWSCredentials(s3.AccessKey, s3.SecretKey), config);
    }

    public async Task SaveAsync(string key, byte[] content, string contentType, CancellationToken ct)
    {
        using var body = new MemoryStream(content, writable: false);
        var request = new PutObjectRequest
        {
            BucketName = bucket,
            Key = key,
            InputStream = body,
            ContentType = contentType,
        };
        request.Headers.CacheControl = CacheControl;
        await client.PutObjectAsync(request, ct);
    }

    public async Task DeleteAsync(string key, CancellationToken ct) =>
        await client.DeleteObjectAsync(new DeleteObjectRequest { BucketName = bucket, Key = key }, ct);
}

public static class StorageKeys
{
    /// <summary>Lower-case letters, digits, '-', '_', '.' and '/' separated segments, no "..": what the API writes.</summary>
    public static bool IsValid(string? key) =>
        !string.IsNullOrEmpty(key)
        && key.Length <= 200
        && !key.StartsWith('/')
        && key.Split('/').All(segment => segment.Length > 0 && segment != "." && segment != ".."
            && segment.All(c => c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-' or '_' or '.'));
}
