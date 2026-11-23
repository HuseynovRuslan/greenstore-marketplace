using Amazon.S3;
using GreenStore.Api.Common;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace GreenStore.Api.Modules.Media;

public static class MediaSetup
{
    /// <summary>The URL path local photo files are served under (<c>Media:BaseUrl</c> points here in Development).</summary>
    public const string LocalRequestPath = "/media";

    public static IServiceCollection AddMedia(this IServiceCollection services)
    {
        services.AddSingleton<PhotoProcessor>();
        services.AddScoped<PhotoService>();
        services.AddSingleton<IFileStorage>(sp =>
        {
            var media = sp.GetRequiredService<IOptions<MediaOptions>>();
            return media.Value.Storage == MediaOptions.S3Storage
                ? new S3FileStorage(sp.GetRequiredService<IAmazonS3>(), media)
                : new LocalDiskStorage(media, sp.GetRequiredService<IHostEnvironment>());
        });
        services.AddSingleton<IAmazonS3>(sp => S3FileStorage.CreateClient(sp.GetRequiredService<IOptions<MediaOptions>>().Value.S3));

        // The browser uploads to the API itself (ARCHITECTURE.md §11): the site's origin may PUT a file, nothing else.
        services.AddCors();
        services.AddOptions<Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions>()
            .Configure<IOptions<MediaOptions>, IOptions<FrontendOptions>>((cors, media, frontend) =>
            {
                var origins = media.Value.UploadOrigins.Append(frontend.Value.BaseUrl)
                    .Where(o => !string.IsNullOrWhiteSpace(o))
                    .Select(o => o.TrimEnd('/'))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                cors.AddPolicy(PhotosEndpoints.UploadCorsPolicy, policy => policy
                    .WithOrigins(origins)
                    .WithMethods(HttpMethods.Put)
                    .WithHeaders(HeaderNames.ContentType)
                    .SetPreflightMaxAge(TimeSpan.FromHours(1)));
            });
        return services;
    }

    /// <summary>
    /// Local storage only: the files under /media, a year in caches (their keys never repeat), never sniffed as
    /// anything but the image they are.
    /// </summary>
    public static IApplicationBuilder UseLocalMedia(this IApplicationBuilder app)
    {
        var media = app.ApplicationServices.GetRequiredService<IOptions<MediaOptions>>().Value;
        if (media.Storage != MediaOptions.LocalStorage)
        {
            return app;
        }

        var storage = (LocalDiskStorage)app.ApplicationServices.GetRequiredService<IFileStorage>();
        return app.UseStaticFiles(new StaticFileOptions
        {
            RequestPath = LocalRequestPath,
            FileProvider = new PhysicalFileProvider(storage.RootPath),
            ServeUnknownFileTypes = false,
            OnPrepareResponse = context =>
            {
                context.Context.Response.Headers.CacheControl = S3FileStorage.CacheControl;
                context.Context.Response.Headers.XContentTypeOptions = "nosniff";
            },
        });
    }
}
