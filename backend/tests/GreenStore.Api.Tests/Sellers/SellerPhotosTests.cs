using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Sellers;

/// <summary>
/// A business's logo and cover (<c>PATCH /me/seller</c> <c>logoPhotoId</c>, <c>coverPhotoId</c>): uploaded like a
/// listing photo with purpose <c>seller-logo</c> or <c>seller-cover</c>, then set on the profile, which the seller page
/// and the directory show.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class SellerPhotosTests(LifecycleApi api)
{
    private static readonly byte[] Logo = TestImages.Jpeg(800, 800);
    private static readonly byte[] Cover = TestImages.Jpeg(2400, 600);

    /// <summary>Asks for an upload address of the purpose and sends the file; returns the photo id and the PUT's answer.</summary>
    private async Task<(string Id, HttpResponseMessage Upload)> UploadAsync(string token, string purpose, byte[] file)
    {
        var created = await api.Client(token).PostAsJsonAsync("/api/v1/photos", new { fileName = "foto.jpg", contentType = "image/jpeg", bytes = file.Length, purpose }, Ct);
        var body = await JsonAsync(created);
        Assert.True(created.StatusCode == HttpStatusCode.Created, $"POST /photos: {(int)created.StatusCode} {body}");
        var upload = await api.PutFileAsync(body.GetProperty("uploadUrl").GetString()!, file);
        return (body.GetProperty("photoId").GetString()!, upload);
    }

    private async Task<string> ReadyAsync(string token, string purpose, byte[] file)
    {
        var (id, upload) = await UploadAsync(token, purpose, file);
        Assert.True(upload.StatusCode == HttpStatusCode.OK, $"PUT upload: {(int)upload.StatusCode} {await upload.Content.ReadAsStringAsync(Ct)}");
        return id;
    }

    private Task<HttpResponseMessage> PatchAsync(string token, string json) =>
        api.Client(token).PatchAsync("/api/v1/me/seller", new StringContent(json, Encoding.UTF8, "application/json"), Ct);

    private async Task<JsonElement> PatchOkAsync(string token, string json)
    {
        var response = await PatchAsync(token, json);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"PATCH /me/seller: {(int)response.StatusCode} {body}");
        return body;
    }

    private static string? Url(JsonElement seller, string name) =>
        seller.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private async Task<DateTimeOffset?> AttachedAtAsync(string photoId)
    {
        await using var db = api.CreateDbContext();
        return (await db.Photos.SingleAsync(p => p.Id == Guid.Parse(photoId), Ct)).AttachedAt;
    }

    [Fact]
    public async Task A_business_sets_its_logo_and_cover_and_its_page_shows_them()
    {
        var business = await api.RegisterBusinessAsync();
        var logo = await ReadyAsync(business.Token, "seller-logo", Logo);
        var cover = await ReadyAsync(business.Token, "seller-cover", Cover);

        var own = await PatchOkAsync(business.Token, $$"""{ "logoPhotoId": "{{logo}}", "coverPhotoId": "{{cover}}" }""");

        // The widest copy of each: 640 px for a logo, 1920 px for a cover.
        Assert.EndsWith("/640.webp", Url(own, "logo"));
        Assert.EndsWith("/1920.webp", Url(own, "coverImage"));
        Assert.Equal(Url(own, "coverImage"), Url(own, "image"));
        var slug = own.GetProperty("slug").GetString();
        var page = await api.GetAsync($"/api/v1/sellers/{slug}", business.Token);
        Assert.Equal(Url(own, "logo"), Url(page, "logo"));
        Assert.Equal(Url(own, "coverImage"), Url(page, "coverImage"));
        Assert.NotNull(await AttachedAtAsync(logo));
        Assert.NotNull(await AttachedAtAsync(cover));

        // The site is told to refresh the seller's page, the directory and the home page.
        await using var db = api.CreateDbContext();
        var notices = await db.Outbox.Where(m => m.Type == OutboxTypes.Revalidate && m.SentAt == null).Select(m => m.Payload).ToListAsync(Ct);
        Assert.Contains(notices, p => p.Contains($"\"seller:{slug}\"", StringComparison.Ordinal) && p.Contains("\"sellers\"", StringComparison.Ordinal));
    }

    [Fact]
    public async Task A_new_logo_releases_the_old_one_and_null_removes_it()
    {
        var business = await api.RegisterBusinessAsync();
        var first = await ReadyAsync(business.Token, "seller-logo", Logo);
        var second = await ReadyAsync(business.Token, "seller-logo", Logo);
        await PatchOkAsync(business.Token, $$"""{ "logoPhotoId": "{{first}}" }""");

        var replaced = await PatchOkAsync(business.Token, $$"""{ "logoPhotoId": "{{second}}" }""");

        Assert.Contains(second.Replace("-", "", StringComparison.Ordinal), Url(replaced, "logo")!, StringComparison.Ordinal);
        Assert.Null(await AttachedAtAsync(first));
        Assert.NotNull(await AttachedAtAsync(second));

        // Sending the same photo again changes nothing.
        await PatchOkAsync(business.Token, $$"""{ "logoPhotoId": "{{second}}" }""");
        Assert.NotNull(await AttachedAtAsync(second));

        var removed = await PatchOkAsync(business.Token, """{ "logoPhotoId": null }""");

        Assert.Null(Url(removed, "logo"));
        Assert.Null(await AttachedAtAsync(second));
    }

    [Fact]
    public async Task Only_the_callers_own_ready_photo_of_that_purpose_is_taken()
    {
        var business = await api.RegisterBusinessAsync();
        var other = await api.RegisterBusinessAsync();
        var othersLogo = await ReadyAsync(other.Token, "seller-logo", Logo);
        var listingPhoto = await api.UploadPhotoAsync(business.Token);
        var cover = await ReadyAsync(business.Token, "seller-cover", Cover);
        var created = await api.Client(business.Token).PostAsJsonAsync("/api/v1/photos", new { fileName = "x.jpg", contentType = "image/jpeg", bytes = 1000, purpose = "seller-logo" }, Ct);
        var waiting = (await JsonAsync(created)).GetProperty("photoId").GetString();

        foreach (var (id, code) in new[] { (othersLogo, "not-found"), (listingPhoto, "not-found"), (cover, "not-found"), (waiting, "not-ready"), (Guid.NewGuid().ToString(), "not-found") })
        {
            var problem = await ProblemAsync(await PatchAsync(business.Token, $$"""{ "logoPhotoId": "{{id}}" }"""), HttpStatusCode.BadRequest, "validation");
            Assert.Equal(code, problem.GetProperty("errors").GetProperty("logoPhotoId")[0].GetString());
        }

        // A refused photo leaves the rest of the change unsaved, as any field error does.
        await ProblemAsync(await PatchAsync(business.Token, $$"""{ "name": "Yeni Ad", "coverPhotoId": "{{othersLogo}}" }"""), HttpStatusCode.BadRequest, "validation");
        var own = await api.GetAsync("/api/v1/me/seller", business.Token);
        Assert.NotEqual("Yeni Ad", own.GetProperty("name").GetString());
        Assert.Null(Url(own, "logo"));
        Assert.Null(Url(own, "coverImage"));
        Assert.Null(await AttachedAtAsync(othersLogo));
    }

    [Fact]
    public async Task A_logo_and_a_cover_have_their_own_sizes_and_shapes()
    {
        var business = await api.RegisterBusinessAsync();

        foreach (var (purpose, file, code) in new[]
        {
            ("seller-logo", TestImages.Jpeg(300, 300), PhotoRules.TooSmall),
            ("seller-logo", TestImages.Jpeg(900, 500), PhotoRules.WrongShape),
            ("seller-cover", TestImages.Jpeg(1000, 250), PhotoRules.TooSmall),
            ("seller-cover", TestImages.Jpeg(1600, 800), PhotoRules.WrongShape),
        })
        {
            var (_, upload) = await UploadAsync(business.Token, purpose, file);
            await ProblemAsync(upload, HttpStatusCode.UnprocessableEntity, code);
        }

        // A 500 px square is a fine logo, though a listing photo needs 600.
        await ReadyAsync(business.Token, "seller-logo", TestImages.Jpeg(500, 500));
    }

    [Fact]
    public async Task The_daily_cleanup_keeps_a_profile_photo_and_deletes_a_replaced_one()
    {
        var business = await api.RegisterBusinessAsync();
        var old = await ReadyAsync(business.Token, "seller-cover", Cover);
        var current = await ReadyAsync(business.Token, "seller-cover", Cover);
        await PatchOkAsync(business.Token, $$"""{ "coverPhotoId": "{{old}}" }""");
        await PatchOkAsync(business.Token, $$"""{ "coverPhotoId": "{{current}}" }""");

        await using var factory = api.Variant();
        api.Clock.Advance(TimeSpan.FromHours(25));
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<PhotoService>().DeleteUnattachedAsync(Ct);

        await using var db = api.CreateDbContext();
        Assert.False(await db.Photos.AnyAsync(p => p.Id == Guid.Parse(old), Ct));
        Assert.True(await db.Photos.AnyAsync(p => p.Id == Guid.Parse(current), Ct));
        var own = await api.GetAsync("/api/v1/me/seller", business.Token);
        Assert.NotNull(Url(own, "coverImage"));
    }
}
