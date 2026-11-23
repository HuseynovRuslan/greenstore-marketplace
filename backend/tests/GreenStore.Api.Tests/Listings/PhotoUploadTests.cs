using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>
/// <c>POST /photos</c> and the one-time upload address (ARCHITECTURE.md §11): what is declared, what is sent, the
/// token's one use and 10 minutes, CORS for the site's origin, and the limit on photos waiting for a listing.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class PhotoUploadTests(LifecycleApi api)
{
    [Fact]
    public async Task Asking_for_an_upload_address_needs_a_session() =>
        await ProblemAsync(
            await api.Client().PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct),
            HttpStatusCode.Unauthorized,
            "unauthorized");

    [Theory]
    [InlineData("image/heic", 1000, "contentType", PhotoRules.UnsupportedType)]
    [InlineData("image/jpeg", 10 * 1024 * 1024 + 1, "bytes", PhotoRules.TooLarge)]
    [InlineData("image/jpeg", 0, "bytes", PhotoRules.Empty)]
    public async Task What_is_declared_is_checked(string contentType, long bytes, string field, string code)
    {
        var owner = await api.RegisterAsync();

        var response = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/photos", new { contentType, bytes }, Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.BadRequest, "validation");
        Assert.Equal(code, problem.GetProperty("errors").GetProperty(field)[0].GetString());
    }

    [Fact]
    public async Task The_upload_address_is_one_use_and_points_at_the_api()
    {
        var owner = await api.RegisterAsync();
        var file = TestImages.Jpeg(900, 700);
        var created = await JsonAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/photos", new { fileName = "a.jpg", contentType = "image/jpeg", bytes = file.Length }, Ct));
        var uploadUrl = created.GetProperty("uploadUrl").GetString()!;

        Assert.Matches("^http://localhost/api/v1/photo-uploads/[A-Za-z0-9_-]{43}$", uploadUrl);
        Assert.Equal(api.Clock.Now.AddMinutes(10), created.GetProperty("expiresAt").GetDateTimeOffset());

        var first = await api.PutFileAsync(uploadUrl, file);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var ready = await JsonAsync(first);
        Assert.Equal("ready", ready.GetProperty("status").GetString());
        Assert.Equal(created.GetProperty("photoId").GetString(), ready.GetProperty("photoId").GetString());
        Assert.Equal((900, 700), (ready.GetProperty("width").GetInt32(), ready.GetProperty("height").GetInt32()));
        Assert.EndsWith("/1280.webp", ready.GetProperty("url").GetString(), StringComparison.Ordinal);

        await ProblemAsync(await api.PutFileAsync(uploadUrl, file), HttpStatusCode.NotFound, PhotoRules.UploadNotFound);
        await ProblemAsync(await api.PutFileAsync("http://localhost/api/v1/photo-uploads/not-a-token", file), HttpStatusCode.NotFound, PhotoRules.UploadNotFound);
    }

    [Fact]
    public async Task The_address_lasts_ten_minutes()
    {
        var owner = await api.RegisterAsync();
        var file = TestImages.Jpeg(900, 700);
        var created = await JsonAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = file.Length }, Ct));
        api.Clock.Advance(TimeSpan.FromMinutes(10).Add(TimeSpan.FromSeconds(1)));

        await ProblemAsync(await api.PutFileAsync(created.GetProperty("uploadUrl").GetString()!, file), HttpStatusCode.Gone, PhotoRules.UploadExpired);
    }

    public static TheoryData<string, byte[], HttpStatusCode, string> RefusedFiles() => new()
    {
        { "a PDF", "%PDF-1.7 not an image at all"u8.ToArray(), HttpStatusCode.UnsupportedMediaType, PhotoRules.UnsupportedType },
        { "a small photo", TestImages.Jpeg(500, 400), HttpStatusCode.UnprocessableEntity, PhotoRules.TooSmall },
        { "a broken JPEG", [0xFF, 0xD8, 0xFF, 0xE0, .. Enumerable.Repeat((byte)0x41, 2000)], HttpStatusCode.UnprocessableEntity, PhotoRules.Unreadable },
        { "nothing", [], HttpStatusCode.BadRequest, PhotoRules.Empty },
    };

    [Theory]
    [MemberData(nameof(RefusedFiles))]
    public async Task A_file_that_is_not_a_usable_photo_is_refused_and_the_photo_marked_failed(string what, byte[] file, HttpStatusCode status, string code)
    {
        _ = what;
        var owner = await api.RegisterAsync();
        var created = await JsonAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct));

        await ProblemAsync(await api.PutFileAsync(created.GetProperty("uploadUrl").GetString()!, file), status, code);

        await using var db = api.CreateDbContext();
        var photo = await db.Photos.SingleAsync(p => p.Id == Guid.Parse(created.GetProperty("photoId").GetString()!), Ct);
        Assert.Equal(PhotoStatus.Failed, photo.Status);
        Assert.Equal(code, photo.Error);
        Assert.Null(photo.UploadTokenHash);
    }

    [Fact]
    public async Task A_file_over_the_limit_is_refused_while_it_is_read()
    {
        await using var small = api.Variant(new Dictionary<string, string?> { ["Media:MaxBytes"] = "20000" });
        var owner = await api.RegisterAsync();
        var created = await JsonAsync(await api.Client(owner.Token, factory: small).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/png", bytes = 10_000 }, Ct));

        var response = await api.PutFileAsync(created.GetProperty("uploadUrl").GetString()!, new byte[30_000], "image/png", small);

        await ProblemAsync(response, HttpStatusCode.RequestEntityTooLarge, PhotoRules.TooLarge);
    }

    [Fact]
    public async Task The_site_may_upload_from_the_browser_and_other_origins_may_not()
    {
        await using var site = api.Variant(new Dictionary<string, string?>
        {
            ["Frontend:BaseUrl"] = "https://greenstore.az",
            ["Media:UploadOrigins:0"] = "http://localhost:3100",
        });

        foreach (var origin in new[] { "https://greenstore.az", "http://localhost:3100" })
        {
            var allowed = await PreflightAsync(site, origin);
            Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);
            Assert.Equal(origin, allowed.Headers.GetValues("Access-Control-Allow-Origin").Single());
            Assert.Contains("PUT", allowed.Headers.GetValues("Access-Control-Allow-Methods").Single(), StringComparison.Ordinal);
        }

        var refused = await PreflightAsync(site, "https://evil.example");
        Assert.False(refused.Headers.Contains("Access-Control-Allow-Origin"));

        // Nothing else of the API answers CORS: the site's server calls it, not the browser.
        using var other = new HttpRequestMessage(HttpMethod.Get, "/api/v1/categories");
        other.Headers.Add("Origin", "https://greenstore.az");
        var read = await api.RawClient(site).SendAsync(other, Ct);
        Assert.False(read.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task An_account_has_a_limited_number_of_photos_waiting_for_a_listing()
    {
        await using var few = api.Variant(new Dictionary<string, string?> { ["Media:MaxUnattachedPerUser"] = "2" });
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token, factory: few);
        for (var i = 0; i < 2; i++)
        {
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct)).StatusCode);
        }

        var refused = await client.PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct);
        await ProblemAsync(refused, HttpStatusCode.TooManyRequests, PhotoRules.TooManyPending);
        Assert.NotNull(refused.Headers.RetryAfter);

        // A day later they no longer count (and the clean-up deletes them).
        api.Clock.Advance(TimeSpan.FromHours(25));
        Assert.Equal(HttpStatusCode.Created, (await api.Client(owner.Token, factory: few).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct)).StatusCode);
    }

    [Fact]
    public async Task The_upload_address_can_be_the_apis_public_origin()
    {
        await using var behindProxy = api.Variant(new Dictionary<string, string?> { ["Media:UploadBaseUrl"] = "https://api.greenstore.az/" });
        var owner = await api.RegisterAsync();

        var created = await JsonAsync(await api.Client(owner.Token, factory: behindProxy).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/webp", bytes = 1000 }, Ct));

        Assert.StartsWith("https://api.greenstore.az/api/v1/photo-uploads/", created.GetProperty("uploadUrl").GetString(), StringComparison.Ordinal);
    }

    private async Task<HttpResponseMessage> PreflightAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory, string origin)
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/v1/photo-uploads/abc");
        preflight.Headers.Add("Origin", origin);
        preflight.Headers.Add("Access-Control-Request-Method", "PUT");
        preflight.Headers.Add("Access-Control-Request-Headers", "content-type");
        return await api.RawClient(factory).SendAsync(preflight, Ct);
    }
}
