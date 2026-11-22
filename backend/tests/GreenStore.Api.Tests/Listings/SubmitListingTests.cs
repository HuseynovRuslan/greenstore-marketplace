using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary><c>POST /listings</c>: what is stored, the photos, the revision, <c>Idempotency-Key</c>, and the refusals.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class SubmitListingTests(LifecycleApi api)
{
    [Fact]
    public async Task Sending_needs_a_session() =>
        await ProblemAsync(await api.Client().PostAsJsonAsync("/api/v1/listings", new { }, Ct), HttpStatusCode.Unauthorized, "unauthorized");

    [Fact]
    public async Task A_listing_is_stored_pending_with_its_photos_and_revision_one()
    {
        var owner = await api.RegisterBusinessAsync();
        var cover = await api.UploadPhotoAsync(owner.Token);
        var second = await api.UploadPhotoAsync(owner.Token, TestImages.Png(800, 800), "image/png");

        var response = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([cover, second], owner.Phone), Ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = Guid.Parse((await JsonAsync(response)).GetProperty("id").GetString()!);
        await using var db = api.CreateDbContext();
        var listing = await db.Listings.Include(l => l.Photos).Include(l => l.Counter).SingleAsync(l => l.Id == id, Ct);
        var seller = await db.Sellers.SingleAsync(s => s.OwnerUserId == owner.Id, Ct);
        Assert.Equal(ListingStatus.Pending, listing.Status);
        Assert.Equal(seller.Id, listing.SellerId);
        Assert.Equal(api.Clock.Now, listing.SubmittedAt);
        Assert.Null(listing.PublishedAt);
        Assert.True(listing.ContactPhoneVerified);
        Assert.Equal("agaclar-meyve", listing.SubcategoryId);
        Assert.Equal(Availability.InStock, listing.Availability);
        Assert.Contains("alma", listing.SearchText, StringComparison.Ordinal);
        Assert.Contains("деревья", listing.SearchText, StringComparison.Ordinal);
        Assert.Equal([Guid.Parse(cover), Guid.Parse(second)], listing.Photos.OrderBy(p => p.Position).Select(p => p.PhotoId));
        Assert.NotNull(listing.Counter);
        Assert.All(await db.Photos.Where(p => p.Id == Guid.Parse(cover) || p.Id == Guid.Parse(second)).ToListAsync(Ct), p => Assert.Equal(api.Clock.Now, p.AttachedAt));

        var revision = await db.ListingRevisions.SingleAsync(r => r.ListingId == id, Ct);
        Assert.Equal(1, revision.Revision);
        Assert.Equal("Alma tingi Golden — 150 sm", revision.Data.Title);
        Assert.Equal([Guid.Parse(cover), Guid.Parse(second)], revision.Data.PhotoIds);
        // Nothing is public yet, so the site's cache has nothing to refresh.
        Assert.Empty(await OutboxRows.WithAsync(db, id.ToString()));
    }

    [Fact]
    public async Task Another_contact_number_is_marked_unverified_for_the_moderator()
    {
        var owner = await api.RegisterAsync();

        var sent = await api.SubmitAsync(owner, input => input["contactPhone"] = "+994 12 498 00 00");

        var own = await api.GetAsync($"/api/v1/me/listings/{sent.GetProperty("id").GetString()}", owner.Token);
        Assert.False(own.GetProperty("contactPhoneVerified").GetBoolean());
        Assert.Equal("+994124980000", own.GetProperty("contactPhone").GetString());
        Assert.False(own.TryGetProperty("sellerId", out _));
    }

    [Fact]
    public async Task The_same_idempotency_key_gives_the_same_listing_and_another_body_is_refused()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        var input = LifecycleApi.TreeInput([photo], owner.Phone);
        var client = api.Client(owner.Token);
        client.DefaultRequestHeaders.Add(IdempotentRequests.Header, "post-1");

        var first = await client.PostAsJsonAsync("/api/v1/listings", input, Ct);
        var again = await client.PostAsJsonAsync("/api/v1/listings", input, Ct);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);
        var a = await JsonAsync(first);
        var b = await JsonAsync(again);
        Assert.Equal(a.GetProperty("id").GetString(), b.GetProperty("id").GetString());
        Assert.Equal(a.GetProperty("number").GetInt64(), b.GetProperty("number").GetInt64());
        await using (var db = api.CreateDbContext())
        {
            Assert.Equal(1, await db.Listings.CountAsync(l => l.OwnerUserId == owner.Id, Ct));
        }

        var changed = LifecycleApi.TreeInput([photo], owner.Phone, i => i["price"] = 30);
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/listings", changed, Ct), HttpStatusCode.UnprocessableEntity, IdempotentRequests.KeyReused);

        // Another user's key of the same name is another key.
        var other = await api.RegisterAsync();
        var otherPhoto = await api.UploadPhotoAsync(other.Token);
        var otherClient = api.Client(other.Token);
        otherClient.DefaultRequestHeaders.Add(IdempotentRequests.Header, "post-1");
        Assert.Equal(HttpStatusCode.Created, (await otherClient.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([otherPhoto], other.Phone), Ct)).StatusCode);
    }

    [Fact]
    public async Task Two_presses_at_once_with_one_key_make_one_listing()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        var input = LifecycleApi.TreeInput([photo], owner.Phone);

        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(async _ =>
        {
            var client = api.Client(owner.Token);
            client.DefaultRequestHeaders.Add(IdempotentRequests.Header, "double-click");
            return await client.PostAsJsonAsync("/api/v1/listings", input, Ct);
        }));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var ids = await Task.WhenAll(responses.Select(async r => (await JsonAsync(r)).GetProperty("id").GetString()));
        Assert.Single(ids.Distinct());
        await using var db = api.CreateDbContext();
        Assert.Equal(1, await db.Listings.CountAsync(l => l.OwnerUserId == owner.Id, Ct));
    }

    [Fact]
    public async Task A_refused_request_leaves_its_key_free_for_the_corrected_one()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        var client = api.Client(owner.Token);
        client.DefaultRequestHeaders.Add(IdempotentRequests.Header, "fix-and-retry");

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone, i => i["title"] = "Alma"), Ct), HttpStatusCode.BadRequest, "validation");

        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone), Ct)).StatusCode);
    }

    [Fact]
    public async Task Without_a_key_each_press_is_a_listing()
    {
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token);

        for (var i = 0; i < 2; i++)
        {
            var photo = await api.UploadPhotoAsync(owner.Token);
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone), Ct)).StatusCode);
        }

        await using var db = api.CreateDbContext();
        Assert.Equal(2, await db.Listings.CountAsync(l => l.OwnerUserId == owner.Id, Ct));
    }

    [Fact]
    public async Task A_malformed_key_is_refused() =>
        await ProblemAsync(await KeyedAsync(new string('k', 81)), HttpStatusCode.BadRequest, "validation");

    [Fact]
    public async Task Invalid_fields_are_named_together()
    {
        var owner = await api.RegisterAsync();
        var input = LifecycleApi.TreeInput([], owner.Phone, i =>
        {
            i["title"] = "Ağ";
            i["price"] = -1;
            i["cityId"] = "mars";
        });

        var problem = await ProblemAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", input, Ct), HttpStatusCode.BadRequest, "validation");

        var errors = problem.GetProperty("errors");
        Assert.Equal("too-short", errors.GetProperty("title")[0].GetString());
        Assert.Equal("out-of-range", errors.GetProperty("price")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("cityId")[0].GetString());
        Assert.Equal("required", errors.GetProperty("photoIds")[0].GetString());
    }

    [Fact]
    public async Task A_body_of_the_wrong_shape_is_a_bad_request()
    {
        var owner = await api.RegisterAsync();
        var input = LifecycleApi.TreeInput([], owner.Phone, i => i["priceType"] = "cheap");

        await ProblemAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", input, Ct), HttpStatusCode.BadRequest, "bad-request");
    }

    [Fact]
    public async Task Photos_must_be_the_senders_ready_unused_ones()
    {
        var owner = await api.RegisterAsync();
        var stranger = await api.RegisterAsync();
        var theirs = await api.UploadPhotoAsync(stranger.Token);
        var waiting = await JsonAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/photos", new { contentType = "image/jpeg", bytes = 1000 }, Ct));
        var used = await api.SubmitAsync(owner);
        string usedPhoto;
        await using (var db = api.CreateDbContext())
        {
            usedPhoto = (await db.ListingPhotos.FirstAsync(p => p.ListingId == Guid.Parse(used.GetProperty("id").GetString()!), Ct)).PhotoId.ToString();
        }

        foreach (var (photo, code) in new[]
        {
            (theirs, ListingErrors.PhotoNotFound),
            (Guid.NewGuid().ToString(), ListingErrors.PhotoNotFound),
            (waiting.GetProperty("photoId").GetString()!, ListingErrors.PhotoNotReady),
            (usedPhoto, ListingErrors.PhotoInUse),
        })
        {
            var problem = await ProblemAsync(
                await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone), Ct),
                HttpStatusCode.BadRequest,
                "validation");
            Assert.Equal(code, problem.GetProperty("errors").GetProperty("photoIds")[0].GetString());
        }
    }

    [Fact]
    public async Task A_service_is_posted_like_a_listing()
    {
        var owner = await api.RegisterBusinessAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        var service = new JsonObject
        {
            ["kind"] = "service",
            ["categoryId"] = "landsaft-xidmetleri",
            ["subcategory"] = "Landşaft dizaynı",
            ["title"] = "Həyətyanı sahənin dizaynı",
            ["description"] = "Layihə, bitki seçimi və əkin. Bakı və Abşeronda işləyirik.",
            ["attributes"] = new JsonObject { ["areas"] = "baki,abseron" },
            ["priceType"] = "fixed",
            ["price"] = 350,
            ["priceUnit"] = "job",
            ["cityId"] = "baki",
            ["deliveryAvailable"] = false,
            ["plantingAvailable"] = true,
            ["contactName"] = "Nigar",
            ["contactPhone"] = owner.Phone,
            ["whatsapp"] = true,
            ["phoneHidden"] = true,
            ["photoIds"] = new JsonArray(photo),
        };

        var response = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", service, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = (await JsonAsync(response)).GetProperty("id").GetString()!;
        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal("service", own.GetProperty("kind").GetString());
        Assert.Equal(["Bakı", "Abşeron"], Json.Strings(own.GetProperty("attributes")));

        await api.ApproveAsync(id);
        var page = await api.GetAsync($"/api/v1/services/{own.GetProperty("slug").GetString()}", owner.Token);
        Assert.Equal("landsaft-dizayni", page.GetProperty("categoryId").GetString());
        Assert.Equal(["Bakı", "Abşeron"], Json.Strings(page.GetProperty("areas")));
        Assert.Equal("350 ₼/işdən", page.GetProperty("priceLabel").GetString());

        // The number is hidden: buyers get WhatsApp only.
        var reveal = await JsonAsync(await api.Client().PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct));
        Assert.False(reveal.TryGetProperty("phone", out _));
        Assert.Equal($"https://wa.me/{owner.Phone.TrimStart('+')}", reveal.GetProperty("whatsappUrl").GetString());
    }

    [Fact]
    public async Task An_account_sends_a_limited_number_of_listings_a_day()
    {
        await using var strict = api.Variant(new Dictionary<string, string?> { ["Listings:MaxSubmissionsPerDay"] = "1" });
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token, factory: strict);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([await api.UploadPhotoAsync(owner.Token)], owner.Phone), Ct)).StatusCode);

        var refused = await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([await api.UploadPhotoAsync(owner.Token)], owner.Phone), Ct);

        await ProblemAsync(refused, HttpStatusCode.TooManyRequests, ListingErrors.DailyLimit);
    }

    [Fact]
    public async Task Photo_processing_keeps_its_copies_in_the_storage()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        await using var db = api.CreateDbContext();
        var row = await db.Photos.SingleAsync(p => p.Id == Guid.Parse(photo), Ct);

        Assert.Equal(PhotoStatus.Ready, row.Status);
        Assert.Equal(["1280", "320", "640"], row.Variants!.Keys.Order());
        await using var factory = api.Variant();
        var root = ((LocalDiskStorage)factory.Services.GetRequiredService<IFileStorage>()).RootPath;
        Assert.All(row.Variants.Values, key => Assert.True(File.Exists(Path.Combine(root, key)), key));
    }

    private async Task<HttpResponseMessage> KeyedAsync(string key)
    {
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token);
        client.DefaultRequestHeaders.TryAddWithoutValidation(IdempotentRequests.Header, key);
        return await client.PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([], owner.Phone), Ct);
    }
}
