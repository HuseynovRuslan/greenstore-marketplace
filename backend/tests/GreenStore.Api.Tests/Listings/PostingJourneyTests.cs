using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>
/// The phase's acceptance path on the API: a signed-in individual and a business each post a listing with a photo; it
/// waits in the cabinet as pending; the dev moderator approves it; it is in the catalogue, on its page and (for the
/// business) on the seller page; «Nömrəni göstər» gives the number and the owner's statistics count it.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class PostingJourneyTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Theory]
    [InlineData("individual")]
    [InlineData("business")]
    public async Task A_listing_goes_from_posting_through_moderation_to_the_site(string accountType)
    {
        var owner = accountType == "business" ? await api.RegisterBusinessAsync() : await api.RegisterAsync();
        var title = $"Gilas tingi {Guid.NewGuid().ToString("N")[..6]} — 120 sm";

        // Posting: a photo, then the listing.
        var sent = await api.SubmitAsync(owner, input => input["title"] = title);
        NoProblems(Contract.Check(sent, "ListingSubmitResult"));
        Assert.Equal("pending", sent.GetProperty("status").GetString());
        var id = sent.GetProperty("id").GetString()!;
        var slug = sent.GetProperty("slug").GetString()!;
        Assert.EndsWith("-" + sent.GetProperty("number").GetInt64(), slug, StringComparison.Ordinal);

        // «Elanlarım»: pending («Yoxlamada»), not on the site yet.
        var mine = await api.GetAsync("/api/v1/me/listings", owner.Token);
        var own = Assert.Single(mine.EnumerateArray(), l => l.GetProperty("id").GetString() == id);
        Assert.Equal("pending", own.GetProperty("status").GetString());
        Assert.True(own.GetProperty("contactPhoneVerified").GetBoolean());
        Assert.Equal(owner.Phone, own.GetProperty("contactPhone").GetString());
        NoProblems(Contract.CheckOwnListing(own));
        Assert.StartsWith("/media/p/", own.GetProperty("cover").GetString(), StringComparison.Ordinal);
        // The photos' ids, in the order of the images: an edit sends them back without uploading again.
        Assert.Equal(own.GetProperty("images").GetArrayLength(), own.GetProperty("photoIds").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);

        // The moderator finds it and approves it.
        var moderator = await api.ModeratorTokenAsync();
        var queue = await api.GetAsync("/api/v1/admin/moderation?sort=newest&pageSize=60", moderator);
        NoProblems(Contract.Check(queue, "ModerationQueue"));
        var item = Assert.Single(Json.Items(queue), i => i.GetProperty("id").GetString() == id);
        Assert.Equal("new", item.GetProperty("kind").GetString());
        Assert.Equal("pending", item.GetProperty("status").GetString());
        Assert.Equal(owner.Phone, item.GetProperty("listing").GetProperty("contactPhone").GetString());
        Assert.Equal(accountType, item.GetProperty("seller").GetProperty("accountType").GetString());
        var approved = await api.ApproveAsync(id, moderator);
        NoProblems(Contract.Check(approved, "ModerationDecisionResult"));
        Assert.Equal("active", approved.GetProperty("status").GetString());

        // On the site: the catalogue, its page, and the seller page of a business.
        var page = await api.GetAsync($"/api/v1/listings/{slug}", owner.Token);
        NoProblems(Contract.Check(page, "Listing"));
        Assert.Equal("active", page.GetProperty("status").GetString());
        Assert.False(page.TryGetProperty("contactPhone", out _));
        var found = await api.GetAsync($"/api/v1/listings?q={Uri.EscapeDataString(title)}", owner.Token);
        Assert.Equal([id], Json.Items(found).Select(l => l.GetProperty("id").GetString()));
        if (accountType == "business")
        {
            var seller = await api.GetAsync("/api/v1/me/seller", owner.Token);
            var sellerId = seller.GetProperty("id").GetString()!;
            Assert.Equal(sellerId, page.GetProperty("sellerId").GetString());
            var sellerPage = await api.GetAsync($"/api/v1/sellers/{seller.GetProperty("slug").GetString()}", owner.Token);
            Assert.Equal(1, sellerPage.GetProperty("activeListings").GetInt32());
            var sellerListings = await api.GetAsync($"/api/v1/listings?sellerId={sellerId}", owner.Token);
            Assert.Equal([id], Json.Items(sellerListings).Select(l => l.GetProperty("id").GetString()));
        }
        else
        {
            Assert.False(page.TryGetProperty("sellerId", out _));
        }

        // A buyer reveals the number; the owner's statistics count the view and the reveal.
        var buyer = api.Client();
        Assert.Equal(HttpStatusCode.NoContent, (await buyer.PostAsync($"/api/v1/listings/{id}/views", null, Ct)).StatusCode);
        var reveal = await buyer.PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct);
        Assert.Equal(HttpStatusCode.OK, reveal.StatusCode);
        var contact = await JsonAsync(reveal);
        NoProblems(Contract.Check(contact, "ContactReveal"));
        Assert.Equal(owner.Phone, contact.GetProperty("phone").GetString());
        Assert.Equal($"https://wa.me/{owner.Phone.TrimStart('+')}", contact.GetProperty("whatsappUrl").GetString());

        var stats = await api.GetAsync($"/api/v1/me/listings/{id}/stats", owner.Token);
        NoProblems(Contract.Check(stats, "ListingStats"));
        Assert.Equal(1, stats.GetProperty("views").GetInt32());
        Assert.Equal(1, stats.GetProperty("phoneReveals").GetInt32());
        Assert.Equal(1, stats.GetProperty("viewsByDay").EnumerateArray().Last().GetProperty("views").GetInt32());

        // The cabinet shows it active with its term.
        var after = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal("active", after.GetProperty("status").GetString());
        Assert.Equal(api.Clock.Now.AddDays(30), after.GetProperty("expiresAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task The_photo_and_its_copies_are_served_under_media()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token, TestImages.Jpeg(1600, 1200, orientation: 6));
        await using var db = api.CreateDbContext();
        var row = await db.Photos.SingleAsync(p => p.Id == Guid.Parse(photo), Ct);

        Assert.Equal(GreenStore.Api.Modules.Media.PhotoStatus.Ready, row.Status);
        Assert.Equal((1200, 1600), (row.Width, row.Height));
        Assert.Null(row.AttachedAt);
        foreach (var variant in row.Variants!.Values)
        {
            var response = await api.RawClient().GetAsync($"/media/{variant}", Ct);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("image/webp", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal("public, max-age=31536000, immutable", response.Headers.CacheControl?.ToString());
        }
    }

    private static void NoProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));
}

/// <summary>JSON helpers of the lifecycle tests.</summary>
internal static class LifecycleJson
{
    public static async Task<JsonElement> PostAsync(this HttpClient client, string path, object? body)
    {
        var response = body is null ? await client.PostAsync(path, null, Ct) : await client.PostAsJsonAsync(path, body, Ct);
        return await JsonAsync(response);
    }
}
