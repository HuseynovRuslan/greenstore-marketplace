using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>The moderation queue and decisions (backend-contract.md 3.5): staff only, versions, reasons, audit, notices.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class ModerationTests(LifecycleApi api)
{
    [Fact]
    public async Task Only_staff_see_the_queue_and_decide()
    {
        var user = await api.RegisterAsync();
        var admin = await api.SignInAsync(GreenStore.Api.Data.Seed.DevAccountsSeeder.Accounts[0]);
        var anyId = Guid.NewGuid();

        foreach (var (method, path) in new[]
        {
            (HttpMethod.Get, "/api/v1/admin/moderation"),
            (HttpMethod.Get, $"/api/v1/admin/moderation/{anyId}"),
            (HttpMethod.Post, $"/api/v1/admin/moderation/{anyId}/decision"),
        })
        {
            HttpRequestMessage Request() => new(method, path) { Content = method == HttpMethod.Post ? JsonContent.Create(new { }) : null };
            await ProblemAsync(await api.Client().SendAsync(Request(), Ct), HttpStatusCode.Unauthorized, "unauthorized");
            await ProblemAsync(await api.Client(user.Token).SendAsync(Request(), Ct), HttpStatusCode.Forbidden, "forbidden");
        }

        Assert.Equal(HttpStatusCode.OK, (await api.Client(admin).GetAsync("/api/v1/admin/moderation", Ct)).StatusCode);
    }

    [Fact]
    public async Task The_queue_pages_filters_and_counts()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner);
        var number = sent.GetProperty("number").GetInt64();

        var queue = await api.GetAsync("/api/v1/admin/moderation?pageSize=1&sort=newest", moderator);
        Assert.Single(Json.Items(queue));
        Assert.Equal(number, Json.Items(queue)[0].GetProperty("number").GetInt64());
        var totals = queue.GetProperty("totals");
        Assert.Equal(queue.GetProperty("total").GetInt32(), totals.GetProperty("pending").GetInt32());
        Assert.True(totals.GetProperty("approved").GetInt32() > 0);
        Assert.Equal(queue.GetProperty("total").GetInt32(), queue.GetProperty("pageCount").GetInt32());

        var byNumber = await api.GetAsync($"/api/v1/admin/moderation?q={number}", moderator);
        Assert.Equal([number], Json.Numbers(Json.Items(byNumber)));
        // Past the end is the last page: the newest version is the last of «Əvvəl ən köhnələr».
        var oldest = await api.GetAsync("/api/v1/admin/moderation?sort=oldest&pageSize=60&page=999", moderator);
        Assert.Equal(number, Json.Numbers(Json.Items(oldest))[^1]);
        var rechecks = await api.GetAsync("/api/v1/admin/moderation?kind=recheck&pageSize=60", moderator);
        Assert.DoesNotContain(number, Json.Numbers(Json.Items(rechecks)));
        var approved = await api.GetAsync("/api/v1/admin/moderation?status=approved&pageSize=5", moderator);
        Assert.All(Json.Items(approved), i => Assert.Equal("approved", i.GetProperty("status").GetString()));

        var invalid = await ProblemAsync(await api.Client(moderator).GetAsync("/api/v1/admin/moderation?status=done&sort=random", Ct), HttpStatusCode.BadRequest, "validation");
        Assert.True(invalid.GetProperty("errors").TryGetProperty("status", out _));
        Assert.True(invalid.GetProperty("errors").TryGetProperty("sort", out _));
    }

    [Fact]
    public async Task Approving_publishes_the_listing_and_records_who_did_it()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterBusinessAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;

        var result = await api.ApproveAsync(id, moderator);

        Assert.Equal("active", result.GetProperty("status").GetString());
        Assert.Equal("approve", result.GetProperty("decision").GetString());
        await using var db = api.CreateDbContext();
        var listing = await db.Listings.Include(l => l.Seller).SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal(ListingStatus.Active, listing.Status);
        Assert.Equal(api.Clock.Now, listing.PublishedAt);
        Assert.Equal(api.Clock.Now, listing.SortAt);
        Assert.Equal(api.Clock.Now.AddDays(30), listing.ExpiresAt);

        var decision = await db.ModerationDecisions.SingleAsync(d => d.ListingId == listing.Id, Ct);
        Assert.Equal(ModerationVerdict.Approve, decision.Decision);
        Assert.Equal(1, decision.Revision);
        var audit = await db.AuditLog.SingleAsync(a => a.TargetId == id, Ct);
        Assert.Equal("listing.approve", audit.Action);
        Assert.Equal("listing", audit.TargetType);
        Assert.NotNull(audit.ActorUserId);

        var notice = Assert.Single(await OutboxRows.WithAsync(db, id));
        var tags = JsonSerializer.Deserialize<RevalidatePayload>(notice.Payload, GreenStore.Api.Data.ColumnMapping.StorageJson)!.Tags;
        Assert.Contains($"listing:{id}", tags);
        Assert.Contains("listings", tags);
        Assert.Contains("home", tags);
        Assert.Contains($"seller:{listing.SellerId}", tags);
        Assert.Contains($"seller:{listing.Seller!.Slug}", tags);
    }

    [Fact]
    public async Task A_rejection_needs_a_reason_and_other_needs_a_note()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var version = (await api.ModerationItemAsync(moderator, id)).GetProperty("version").GetString();

        var noReason = await ProblemAsync(await DecideAsync(moderator, id, new { decision = "reject", version }), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("required", noReason.GetProperty("errors").GetProperty("reasonCode")[0].GetString());
        var noNote = await ProblemAsync(await DecideAsync(moderator, id, new { decision = "reject", reasonCode = "other", version }), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("required", noNote.GetProperty("errors").GetProperty("note")[0].GetString());
        await ProblemAsync(await DecideAsync(moderator, id, new { decision = "approve" }), HttpStatusCode.BadRequest, "validation");
        await ProblemAsync(await DecideAsync(moderator, id, new { decision = "maybe", version }), HttpStatusCode.BadRequest, "bad-request");

        var rejected = await DecideAsync(moderator, id, new { decision = "reject", reasonCode = "bad-photos", explanation = "Şəkillər bulanıqdır", version });
        Assert.Equal(HttpStatusCode.OK, rejected.StatusCode);

        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal("rejected", own.GetProperty("status").GetString());
        Assert.Equal("bad-photos", own.GetProperty("rejectionReasonCode").GetString());
        Assert.Equal("Şəkillər bulanıqdır", own.GetProperty("rejectionNote").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{own.GetProperty("slug").GetString()}", Ct)).StatusCode);

        var item = await api.ModerationItemAsync(moderator, id);
        Assert.Equal("rejected", item.GetProperty("status").GetString());
        Assert.Equal("bad-photos", item.GetProperty("lastDecision").GetProperty("reasonCode").GetString());
        await using var db = api.CreateDbContext();
        Assert.Equal("listing.reject", (await db.AuditLog.SingleAsync(a => a.TargetId == id, Ct)).Action);
    }

    [Fact]
    public async Task A_fixed_listing_comes_back_as_a_recheck_with_what_changed()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        await api.ApproveAsync(id, moderator);
        var photo = await api.UploadPhotoAsync(owner.Token);
        var cover = (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("cover").GetString()!;
        var firstPhoto = cover.Split('/')[^2];
        var firstId = Guid.ParseExact(firstPhoto, "N").ToString();

        var edit = await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput([firstId, photo], owner.Phone, i => i["price"] = 20), Ct);
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);

        var item = await api.ModerationItemAsync(moderator, id);
        Assert.Equal("recheck", item.GetProperty("kind").GetString());
        Assert.Equal("pending", item.GetProperty("status").GetString());
        Assert.Equal(2, item.GetProperty("revision").GetInt32());
        var changes = item.GetProperty("changes").EnumerateArray().Select(c => (c.GetProperty("field").GetString(), Json.String(c, "before"), Json.String(c, "after"))).ToList();
        Assert.Equal([("price", "25", "20"), ("photos", "1", "2")], changes);
        var rechecks = await api.GetAsync("/api/v1/admin/moderation?kind=recheck&pageSize=60", moderator);
        Assert.Contains(id, Json.Items(rechecks).Select(i => i.GetProperty("id").GetString()));
    }

    [Fact]
    public async Task A_decision_on_a_version_nobody_saw_is_refused()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var seen = (await api.ModerationItemAsync(moderator, id)).GetProperty("version").GetString();

        // The owner edits it after the moderator opened it.
        var photo = await api.UploadPhotoAsync(owner.Token);
        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput([photo], owner.Phone), Ct)).StatusCode);

        await ProblemAsync(await DecideAsync(moderator, id, new { decision = "approve", version = seen }), HttpStatusCode.Conflict, "concurrency-conflict");
        Assert.Equal("pending", (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task Two_moderators_deciding_at_once_get_one_decision()
    {
        var first = await api.ModeratorTokenAsync();
        var second = await api.SignInAsync(GreenStore.Api.Data.Seed.DevAccountsSeeder.Accounts[0]);
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var version = (await api.ModerationItemAsync(first, id)).GetProperty("version").GetString();

        var answers = await Task.WhenAll(
            DecideAsync(first, id, new { decision = "approve", version }),
            DecideAsync(second, id, new { decision = "reject", reasonCode = "duplicate", version }));

        Assert.Single(answers, a => a.StatusCode == HttpStatusCode.OK);
        Assert.Single(answers, a => a.StatusCode == HttpStatusCode.Conflict);
        await using var db = api.CreateDbContext();
        Assert.Equal(1, await db.ModerationDecisions.CountAsync(d => d.ListingId == Guid.Parse(id), Ct));
    }

    [Fact]
    public async Task A_listing_that_is_not_pending_has_nothing_to_decide()
    {
        var moderator = await api.ModeratorTokenAsync();
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        var approved = await api.ApproveAsync(id, moderator);

        var again = await DecideAsync(moderator, id, new { decision = "approve", version = approved.GetProperty("version").GetString() });

        var problem = await ProblemAsync(again, HttpStatusCode.Conflict, ListingErrors.WrongStatus);
        Assert.Equal("active", problem.GetProperty("listingStatus").GetString());
        await ProblemAsync(await DecideAsync(moderator, Guid.NewGuid().ToString(), new { decision = "approve", version = "1" }), HttpStatusCode.NotFound, ListingErrors.NotFound);
    }

    [Fact]
    public async Task A_demo_listing_without_revisions_can_be_decided()
    {
        var moderator = await api.ModeratorTokenAsync();
        Guid id;
        await using (var db = api.CreateDbContext())
        {
            id = await db.Listings
                .Where(l => l.Status == ListingStatus.Pending && l.DeletedAt == null && !db.ListingRevisions.Any(r => r.ListingId == l.Id))
                .OrderBy(l => l.Number)
                .Select(l => l.Id)
                .FirstAsync(Ct);
        }

        var item = await api.ModerationItemAsync(moderator, id.ToString());
        Assert.Equal("new", item.GetProperty("kind").GetString());
        Assert.Empty(item.GetProperty("changes").EnumerateArray());

        await api.ApproveAsync(id.ToString(), moderator);

        await using var check = api.CreateDbContext();
        Assert.Equal(1, (await check.ModerationDecisions.SingleAsync(d => d.ListingId == id, Ct)).Revision);
        Assert.True(await check.ListingRevisions.AnyAsync(r => r.ListingId == id && r.Revision == 1, Ct));
    }

    private async Task<HttpResponseMessage> DecideAsync(string token, string id, object body) =>
        await api.Client(token).PostAsJsonAsync($"/api/v1/admin/moderation/{id}/decision", body, Ct);
}
