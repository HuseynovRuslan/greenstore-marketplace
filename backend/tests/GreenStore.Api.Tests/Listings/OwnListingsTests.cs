using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>«Elanlarım»: editing, «Yenilə», «Deaktiv et», «Aktiv et», «Sil», and whose listings one sees.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class OwnListingsTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Fact]
    public async Task The_cabinet_lists_every_status_but_deleted_newest_first()
    {
        var owner = await api.RegisterAsync();
        var first = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        api.Clock.Advance(TimeSpan.FromSeconds(1));
        var second = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        api.Clock.Advance(TimeSpan.FromSeconds(1));
        await api.ApproveAsync(first);

        var mine = await api.GetAsync("/api/v1/me/listings", owner.Token);

        Assert.Equal([first, second], mine.EnumerateArray().Select(l => l.GetProperty("id").GetString()));
        Assert.Equal(["active", "pending"], mine.EnumerateArray().Select(l => l.GetProperty("status").GetString()));
        foreach (var listing in mine.EnumerateArray())
        {
            Assert.True(Contract.CheckOwnListing(listing).Count == 0, string.Join("\n", Contract.CheckOwnListing(listing)));
        }

        // Nobody else's.
        var other = await api.RegisterAsync();
        Assert.Empty((await api.GetAsync("/api/v1/me/listings", other.Token)).EnumerateArray());
        await ProblemAsync(await api.Client(other.Token).GetAsync($"/api/v1/me/listings/{first}", Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        await ProblemAsync(await api.Client(other.Token).PostAsync($"/api/v1/me/listings/{first}/deactivate", null, Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        await ProblemAsync(await api.Client(other.Token).DeleteAsync($"/api/v1/me/listings/{first}", Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        await ProblemAsync(await api.Client(other.Token).GetAsync($"/api/v1/me/listings/{first}/stats", Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
    }

    [Fact]
    public async Task Editing_an_active_listing_hides_it_until_the_moderator_approves_again()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        var oldSlug = sent.GetProperty("slug").GetString()!;
        await api.ApproveAsync(id);
        var published = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        api.Clock.Advance(TimeSpan.FromHours(1));
        var photo = await api.UploadPhotoAsync(owner.Token);

        var edit = await api.Client(owner.Token).PutAsJsonAsync(
            $"/api/v1/me/listings/{id}",
            LifecycleApi.TreeInput([photo], owner.Phone, i => i["title"] = "Armud tingi — 150 sm"),
            Ct);

        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
        var result = await JsonAsync(edit);
        Assert.Equal("pending", result.GetProperty("status").GetString());
        var newSlug = result.GetProperty("slug").GetString()!;
        Assert.StartsWith("armud-tingi-150-sm-", newSlug, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{oldSlug}", Ct)).StatusCode);

        await using (var db = api.CreateDbContext())
        {
            var photos = await db.ListingPhotos.Where(p => p.ListingId == Guid.Parse(id)).ToListAsync(Ct);
            Assert.Equal([Guid.Parse(photo)], photos.Select(p => p.PhotoId));
            Assert.Equal(2, await db.ListingRevisions.CountAsync(r => r.ListingId == Guid.Parse(id), Ct));
            // It left the site: the site is told to drop the old page.
            Assert.Contains(await OutboxRows.WithAsync(db, $"listing:{oldSlug}"), m => m.Payload.Contains($"listing:{newSlug}", StringComparison.Ordinal));
        }

        await api.ApproveAsync(id);
        var back = await api.GetAsync($"/api/v1/listings/{oldSlug}", owner.Token);
        Assert.Equal(newSlug, back.GetProperty("slug").GetString());
        Assert.Equal(published.GetProperty("publishedAt").GetDateTimeOffset(), back.GetProperty("publishedAt").GetDateTimeOffset());
        Assert.Equal(api.Clock.Now, back.GetProperty("updatedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task The_category_of_a_published_listing_is_locked()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var photo = await api.UploadPhotoAsync(owner.Token);

        // Before publishing it may still change.
        var flowers = LifecycleApi.TreeInput([photo], owner.Phone, i =>
        {
            i["categoryId"] = "guller";
            i["subcategory"] = "Mövsümi güllər";
            i["plant"] = new System.Text.Json.Nodes.JsonObject { ["heightCm"] = new System.Text.Json.Nodes.JsonObject { ["min"] = 30 } };
        });
        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", flowers, Ct)).StatusCode);
        await api.ApproveAsync(id);

        var trees = LifecycleApi.TreeInput([photo], owner.Phone);
        var problem = await ProblemAsync(await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", trees, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(ListingInputRules.Locked, problem.GetProperty("errors").GetProperty("categoryId")[0].GetString());
        Assert.Equal("guller", (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("categoryId").GetString());
    }

    [Fact]
    public async Task A_stale_version_of_the_owners_copy_is_refused()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var photo = await api.UploadPhotoAsync(owner.Token);
        var version = (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("version").GetString();
        await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput([photo], owner.Phone), Ct);

        var stale = await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput([photo], owner.Phone, i => i["version"] = version), Ct);

        await ProblemAsync(stale, HttpStatusCode.Conflict, "concurrency-conflict");
    }

    [Fact]
    public async Task Deactivating_and_activating_take_it_off_and_put_it_back()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        var slug = sent.GetProperty("slug").GetString()!;
        await ProblemAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/deactivate", null, Ct), HttpStatusCode.Conflict, ListingErrors.WrongStatus);
        await api.ApproveAsync(id);

        var off = await JsonAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/deactivate", null, Ct));
        Assert.Equal("inactive", off.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);
        await ProblemAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/deactivate", null, Ct), HttpStatusCode.Conflict, ListingErrors.WrongStatus);

        var on = await JsonAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/activate", null, Ct));
        Assert.Equal("active", on.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);
    }

    [Fact]
    public async Task Renewing_an_expired_listing_gives_30_days_without_lifting_it()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        await api.ApproveAsync(id);
        await ProblemAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/renew", null, Ct), HttpStatusCode.Conflict, ListingErrors.WrongStatus);
        DateTimeOffset? sortAt;
        await using (var db = api.CreateDbContext())
        {
            var listing = await db.Listings.SingleAsync(l => l.Id == Guid.Parse(id), Ct);
            listing.Status = ListingStatus.Expired;
            listing.ExpiresAt = api.Clock.Now.AddDays(-1);
            sortAt = listing.SortAt;
            await db.SaveChangesAsync(Ct);
        }

        api.Clock.Advance(TimeSpan.FromMinutes(5));
        var renewed = await JsonAsync(await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/renew", null, Ct));

        Assert.Equal("active", renewed.GetProperty("status").GetString());
        Assert.Equal(api.Clock.Now.AddDays(30), renewed.GetProperty("expiresAt").GetDateTimeOffset());
        Assert.Equal(api.Clock.Now, renewed.GetProperty("updatedAt").GetDateTimeOffset());
        await using var check = api.CreateDbContext();
        Assert.Equal(sortAt, (await check.Listings.SingleAsync(l => l.Id == Guid.Parse(id), Ct)).SortAt);
    }

    [Fact]
    public async Task Deleting_removes_it_for_everyone_and_keeps_the_row()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        await api.ApproveAsync(id);
        var draft = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/me/drafts", new { data = new { version = 2 }, listingId = id }, Ct);
        Assert.Equal(HttpStatusCode.Created, draft.StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(owner.Token).DeleteAsync($"/api/v1/me/listings/{id}", Ct)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{sent.GetProperty("slug").GetString()}", Ct)).StatusCode);
        Assert.Empty((await api.GetAsync("/api/v1/me/listings", owner.Token)).EnumerateArray());
        await ProblemAsync(await api.Client(owner.Token).DeleteAsync($"/api/v1/me/listings/{id}", Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        Assert.Empty((await api.GetAsync("/api/v1/me/drafts", owner.Token)).EnumerateArray());
        await using var db = api.CreateDbContext();
        Assert.NotNull((await db.Listings.SingleAsync(l => l.Id == Guid.Parse(id), Ct)).DeletedAt);
    }

    [Fact]
    public async Task Statistics_have_14_days_oldest_first()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        await api.ApproveAsync(id);

        var stats = await api.GetAsync($"/api/v1/me/listings/{id}/stats", owner.Token);

        var days = stats.GetProperty("viewsByDay").EnumerateArray().Select(d => d.GetProperty("date").GetString()!).ToList();
        Assert.Equal(14, days.Count);
        Assert.Equal(GreenStore.Api.Common.BakuTime.Today(api.Clock.Now).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), days[^1]);
        Assert.Equal(days.Order(StringComparer.Ordinal), days);
        Assert.All(stats.GetProperty("viewsByDay").EnumerateArray(), d => Assert.Equal(0, d.GetProperty("views").GetInt32()));
        Assert.Equal(0, stats.GetProperty("views").GetInt32());
    }

    [Fact]
    public async Task Drafts_keep_the_wizards_state_as_it_is()
    {
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token);
        var data = new { version = 2, kind = "product", title = "Yarımçıq elan", attrs = new { heightMin = "150" } };

        var created = await client.PostAsJsonAsync("/api/v1/me/drafts", new { data }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var draft = await JsonAsync(created);
        var id = draft.GetProperty("id").GetString()!;
        Assert.Equal("Yarımçıq elan", draft.GetProperty("data").GetProperty("title").GetString());

        var updated = await JsonAsync(await client.PutAsJsonAsync($"/api/v1/me/drafts/{id}", new { data = new { version = 2, title = "Yeni ad" } }, Ct));
        Assert.Equal("Yeni ad", updated.GetProperty("data").GetProperty("title").GetString());
        Assert.Equal("Yeni ad", (await api.GetAsync($"/api/v1/me/drafts/{id}", owner.Token)).GetProperty("data").GetProperty("title").GetString());
        Assert.Single((await api.GetAsync("/api/v1/me/drafts", owner.Token)).EnumerateArray());

        var other = await api.RegisterAsync();
        await ProblemAsync(await api.Client(other.Token).GetAsync($"/api/v1/me/drafts/{id}", Ct), HttpStatusCode.NotFound, ListingErrors.DraftNotFound);
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/drafts", new { data = "text" }, Ct), HttpStatusCode.BadRequest, "validation");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/drafts", new { data = new { big = new string('x', 70_000) } }, Ct), HttpStatusCode.BadRequest, "validation");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/drafts", new { data, listingId = Guid.NewGuid() }, Ct), HttpStatusCode.BadRequest, "validation");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/v1/me/drafts/{id}", Ct)).StatusCode);
        Assert.Empty((await api.GetAsync("/api/v1/me/drafts", owner.Token)).EnumerateArray());
    }

    [Fact]
    public async Task An_account_keeps_a_limited_number_of_drafts()
    {
        await using var few = api.Variant(new Dictionary<string, string?> { ["Listings:MaxDraftsPerUser"] = "1" });
        var owner = await api.RegisterAsync();
        var client = api.Client(owner.Token, factory: few);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/me/drafts", new { data = new { version = 2 } }, Ct)).StatusCode);

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/drafts", new { data = new { version = 2 } }, Ct), HttpStatusCode.Conflict, ListingErrors.TooManyDrafts);
    }
}

/// <summary>Views and «Nömrəni göstər» (DATABASE.md §3.6, backend-contract.md 3.1).</summary>
[Collection(LifecycleCollection.Name)]
public sealed class CountersTests(LifecycleApi api)
{
    [Fact]
    public async Task A_visitor_counts_once_a_day_and_the_owner_not_at_all()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        await ProblemAsync(await api.Client().PostAsync($"/api/v1/listings/{id}/views", null, Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        await api.ApproveAsync(id);
        var visitor = api.Client();
        var signedIn = api.Client((await api.RegisterAsync()).Token);

        for (var i = 0; i < 3; i++)
        {
            Assert.Equal(HttpStatusCode.NoContent, (await visitor.PostAsync($"/api/v1/listings/{id}/views", null, Ct)).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await signedIn.PostAsync($"/api/v1/listings/{id}/views", null, Ct)).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await api.Client(owner.Token).PostAsync($"/api/v1/listings/{id}/views", null, Ct)).StatusCode);
        }

        Assert.Equal(2, (await StatsAsync(owner, id)).GetProperty("views").GetInt32());

        // The next day (Baku time) is another day.
        api.Clock.Advance(TimeSpan.FromDays(1));
        await visitor.PostAsync($"/api/v1/listings/{id}/views", null, Ct);
        var stats = await StatsAsync(owner, id);
        Assert.Equal(3, stats.GetProperty("views").GetInt32());
        var days = stats.GetProperty("viewsByDay").EnumerateArray().ToList();
        Assert.Equal([2, 1], days[^2..].Select(d => d.GetProperty("views").GetInt32()));
        // The public listing shows the total.
        Assert.Equal(3, (await api.GetAsync($"/api/v1/listings/{(await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("slug").GetString()}", owner.Token)).GetProperty("views").GetInt32());
    }

    [Fact]
    public async Task A_reveal_gives_the_number_and_counts_once_per_visitor()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner, i => i["whatsapp"] = false)).GetProperty("id").GetString()!;
        await ProblemAsync(await api.Client().PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct), HttpStatusCode.NotFound, ListingErrors.NotFound);
        await api.ApproveAsync(id);
        var visitor = api.Client();

        var first = await JsonAsync(await visitor.PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct));
        await visitor.PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct);
        await api.Client(owner.Token).PostAsync($"/api/v1/listings/{id}/phone-reveals", null, Ct);

        Assert.Equal(owner.Phone, first.GetProperty("phone").GetString());
        Assert.False(first.TryGetProperty("whatsappUrl", out _));
        Assert.Equal(1, (await StatsAsync(owner, id)).GetProperty("phoneReveals").GetInt32());
        await using var db = api.CreateDbContext();
        var today = GreenStore.Api.Common.BakuTime.Today(api.Clock.Now);
        Assert.Equal(1, (await db.ListingDailyStats.SingleAsync(s => s.ListingId == Guid.Parse(id) && s.Day == today, Ct)).PhoneReveals);
    }

    [Fact]
    public async Task A_business_page_reveals_the_business_number()
    {
        var owner = await api.RegisterBusinessAsync();
        var seller = await api.GetAsync("/api/v1/me/seller", owner.Token);
        var sellerId = seller.GetProperty("id").GetString()!;

        var ownersNumber = await JsonAsync(await api.Client().PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct));
        Assert.Equal(owner.Phone, ownersNumber.GetProperty("phone").GetString());

        var patch = await api.Client(owner.Token).PatchAsJsonAsync("/api/v1/me/seller", new { phone = "+994 12 555 00 11", whatsapp = true }, Ct);
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        var business = await JsonAsync(await api.Client().PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct));
        Assert.Equal("+994125550011", business.GetProperty("phone").GetString());
        Assert.Equal("https://wa.me/994125550011", business.GetProperty("whatsappUrl").GetString());

        await ProblemAsync(await api.Client().PostAsync($"/api/v1/sellers/{Guid.NewGuid()}/phone-reveals", null, Ct), HttpStatusCode.NotFound, "seller.not-found");

        // A blocked owner's business gives no number.
        await using (var db = api.CreateDbContext())
        {
            await db.Users.Where(u => u.Id == owner.Id).ExecuteUpdateAsync(u => u.SetProperty(x => x.Status, GreenStore.Api.Modules.Accounts.UserStatus.Blocked), Ct);
        }

        await ProblemAsync(await api.Client().PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct), HttpStatusCode.NotFound, "seller.not-found");
    }

    [Fact]
    public async Task Reveals_are_limited_per_ip()
    {
        await using var strict = api.Variant(new Dictionary<string, string?> { ["RateLimiting:PhoneReveals:PermitLimit"] = "2", ["RateLimiting:Views:PermitLimit"] = "1" });
        var owner = await api.RegisterBusinessAsync();
        var sellerId = (await api.GetAsync("/api/v1/me/seller", owner.Token)).GetProperty("id").GetString()!;
        var ip = AccountsApi.NewIp();
        var scraper = api.Client(ip: ip, factory: strict);

        Assert.Equal(HttpStatusCode.OK, (await scraper.PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await scraper.PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct)).StatusCode);
        var refused = await scraper.PostAsync($"/api/v1/sellers/{sellerId}/phone-reveals", null, Ct);
        await ProblemAsync(refused, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.NotNull(refused.Headers.RetryAfter);

        var any = Guid.NewGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await scraper.PostAsync($"/api/v1/listings/{any}/views", null, Ct)).StatusCode);
        await ProblemAsync(await scraper.PostAsync($"/api/v1/listings/{any}/views", null, Ct), HttpStatusCode.TooManyRequests, "rate-limited");
    }

    [Fact]
    public async Task Favourites_count_on_the_day_they_are_added()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        await api.ApproveAsync(id);
        var fan = await api.RegisterAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(fan.Token).PutAsync($"/api/v1/me/favorites/listing/{id}", null, Ct)).StatusCode);

        Assert.Equal(1, (await StatsAsync(owner, id)).GetProperty("favourites").GetInt32());
        await using var db = api.CreateDbContext();
        Assert.Equal(1, (await db.ListingDailyStats.SingleAsync(s => s.ListingId == Guid.Parse(id), Ct)).Favourites);
    }

    private async Task<JsonElement> StatsAsync(Account owner, string id) => await api.GetAsync($"/api/v1/me/listings/{id}/stats", owner.Token);
}
