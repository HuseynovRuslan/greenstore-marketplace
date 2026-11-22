using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Şikayət et» end to end (backend-contract.md 4.1): stored, seen by the staff, handled with a history.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class ReportsTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private async Task<JsonElement> FirstAsync(string path)
    {
        var response = await api.Client().GetAsync(path, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return Json.Items(await JsonAsync(response))[0];
    }

    [Fact]
    public async Task A_guest_reports_a_listing_and_the_moderator_sees_it_with_its_target()
    {
        var listing = await FirstAsync("/api/v1/listings?pageSize=1");
        var listingId = listing.GetProperty("id").GetString()!;
        var guest = api.Client();

        var sent = await guest.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listingId, reason = "wrong-price", comment = "Satıcı başqa qiymət dedi." }, Ct);

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var created = await JsonAsync(sent);
        Assert.Empty(Contract.Check(created, "{ id: string }"));
        var id = created.GetProperty("id").GetString()!;

        // Sent again by the same visitor: the same report, not a second one.
        var again = await guest.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listingId, reason = "wrong-price" }, Ct);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(id, (await JsonAsync(again)).GetProperty("id").GetString());

        var moderator = await api.ModeratorTokenAsync();
        var item = await api.GetAsync($"/api/v1/admin/reports/{id}", moderator);
        Assert.Equal("listing", item.GetProperty("target").GetString());
        Assert.Equal(listingId, item.GetProperty("targetId").GetString());
        Assert.Equal("wrong-price", item.GetProperty("reason").GetString());
        Assert.Equal("open", item.GetProperty("status").GetString());
        Assert.Equal("Satıcı başqa qiymət dedi.", item.GetProperty("comment").GetString());
        Assert.False(item.TryGetProperty("reporter", out _));
        Assert.Equal(listing.GetProperty("number").GetInt64(), item.GetProperty("listing").GetProperty("number").GetInt64());
        // Staff see the listing as its owner does, the number included.
        Assert.StartsWith("+994", item.GetProperty("listing").GetProperty("contactPhone").GetString(), StringComparison.Ordinal);
        Assert.False(string.IsNullOrEmpty(item.GetProperty("owner").GetProperty("userId").GetString()));
        Assert.Equal("active", item.GetProperty("owner").GetProperty("status").GetString());
        Assert.True(item.GetProperty("openReportsOnTarget").GetInt32() >= 1);
        Assert.Empty(item.GetProperty("history").EnumerateArray());

        var open = await api.GetAsync("/api/v1/admin/reports?status=open&target=listing&pageSize=60", moderator);
        Assert.Contains(Json.Items(open), r => r.GetProperty("id").GetString() == id);
        Assert.All(Json.Items(open), r => Assert.Equal("open", r.GetProperty("status").GetString()));
        Assert.True(open.GetProperty("totals").GetProperty("open").GetInt32() >= 1);
    }

    [Fact]
    public async Task A_signed_in_user_reports_a_seller_and_a_service()
    {
        var user = await api.RegisterAsync(fullName: "Aygün Əliyeva");
        var seller = await FirstAsync("/api/v1/sellers?pageSize=1");
        var service = await FirstAsync("/api/v1/services?pageSize=1");
        var client = api.Client(user.Token);

        var bySeller = await client.PostAsJsonAsync("/api/v1/reports", new { target = "seller", targetId = seller.GetProperty("id").GetString(), reason = "misconduct" }, Ct);
        var byService = await client.PostAsJsonAsync("/api/v1/reports", new { target = "service", targetId = service.GetProperty("id").GetString(), reason = "other", comment = "Usta gəlmədi." }, Ct);

        Assert.Equal(HttpStatusCode.Created, bySeller.StatusCode);
        Assert.Equal(HttpStatusCode.Created, byService.StatusCode);
        var moderator = await api.ModeratorTokenAsync();
        var sellerReport = await api.GetAsync($"/api/v1/admin/reports/{(await JsonAsync(bySeller)).GetProperty("id").GetString()}", moderator);
        Assert.Equal("Aygün Əliyeva", sellerReport.GetProperty("reporter").GetProperty("name").GetString());
        Assert.Equal(seller.GetProperty("slug").GetString(), sellerReport.GetProperty("seller").GetProperty("slug").GetString());
        Assert.False(sellerReport.TryGetProperty("listing", out _));
        var serviceReport = await api.GetAsync($"/api/v1/admin/reports/{(await JsonAsync(byService)).GetProperty("id").GetString()}", moderator);
        Assert.Equal("service", serviceReport.GetProperty("target").GetString());
        Assert.Equal("service", serviceReport.GetProperty("listing").GetProperty("kind").GetString());

        await using var db = api.CreateDbContext();
        var rows = await db.Reports.AsNoTracking().Where(r => r.ReporterUserId == user.Id).ToListAsync(Ct);
        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.NotNull(r.ReporterIpHash));
    }

    [Fact]
    public async Task A_report_needs_a_public_target_and_a_reason_of_it()
    {
        var listing = (await FirstAsync("/api/v1/listings?pageSize=1")).GetProperty("id").GetString();
        var client = api.Client();

        var missing = await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listing, reason = "other" }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("required", missing.GetProperty("errors").GetProperty("comment")[0].GetString());
        var wrongReason = await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listing, reason = "misconduct" }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(ReportRules.ReasonNotForTarget, wrongReason.GetProperty("errors").GetProperty("reason")[0].GetString());
        // The site's old Azerbaijani text is not a code.
        var text = await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listing, reason = "Qiymət düzgün deyil" }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("invalid", text.GetProperty("errors").GetProperty("reason")[0].GetString());

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = Guid.NewGuid(), reason = "sold" }, Ct), HttpStatusCode.NotFound, "listing.not-found");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "service", targetId = listing, reason = "fraud" }, Ct), HttpStatusCode.NotFound, "service.not-found");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/reports", new { target = "seller", targetId = Guid.NewGuid(), reason = "fraud" }, Ct), HttpStatusCode.NotFound, "seller.not-found");
    }

    [Fact]
    public async Task The_staff_move_a_report_to_resolved_and_each_step_is_in_its_history()
    {
        var listing = (await FirstAsync("/api/v1/listings?pageSize=1")).GetProperty("id").GetString();
        var sent = await api.Client().PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listing, reason = "duplicate" }, Ct);
        var id = (await JsonAsync(sent)).GetProperty("id").GetString()!;
        var moderator = await api.ModeratorTokenAsync();
        var client = api.Client(moderator);

        var investigating = await client.PatchAsJsonAsync($"/api/v1/admin/reports/{id}", new { status = "investigating", note = "Satıcıdan izah istənildi." }, Ct);
        Assert.Equal(HttpStatusCode.OK, investigating.StatusCode);
        var item = await JsonAsync(investigating);
        Assert.Equal("investigating", item.GetProperty("status").GetString());
        Assert.Equal("Satıcıdan izah istənildi.", item.GetProperty("note").GetString());
        Assert.Equal("GreenStore Moderator", item.GetProperty("handledBy").GetProperty("name").GetString());

        var noResolution = await ProblemAsync(await client.PatchAsJsonAsync($"/api/v1/admin/reports/{id}", new { status = "resolved" }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("required", noResolution.GetProperty("errors").GetProperty("resolution")[0].GetString());

        var resolved = await JsonAsync(await client.PatchAsJsonAsync($"/api/v1/admin/reports/{id}", new { status = "resolved", resolution = "action-taken" }, Ct));
        Assert.Equal("resolved", resolved.GetProperty("status").GetString());
        Assert.Equal("action-taken", resolved.GetProperty("resolution").GetString());
        var history = resolved.GetProperty("history").EnumerateArray().ToList();
        Assert.Equal(["investigating", "resolved"], history.Select(h => h.GetProperty("status").GetString()));
        Assert.Equal("Satıcıdan izah istənildi.", history[0].GetProperty("note").GetString());
        Assert.Equal("Satıcıdan izah istənildi.", resolved.GetProperty("note").GetString());

        // Reopened: the resolution goes.
        var reopened = await JsonAsync(await client.PatchAsJsonAsync($"/api/v1/admin/reports/{id}", new { status = "open" }, Ct));
        Assert.False(reopened.TryGetProperty("resolution", out _));

        await using var db = api.CreateDbContext();
        Assert.Equal(3, await db.AuditLog.CountAsync(e => e.Action == AdminReportsEndpoints.AuditAction && e.TargetId == id, Ct));
        await ProblemAsync(await client.PatchAsJsonAsync($"/api/v1/admin/reports/{Guid.NewGuid()}", new { status = "open" }, Ct), HttpStatusCode.NotFound, EngagementErrors.ReportNotFound);
        await ProblemAsync(await client.GetAsync($"/api/v1/admin/reports/{Guid.NewGuid()}", Ct), HttpStatusCode.NotFound, EngagementErrors.ReportNotFound);
    }

    [Fact]
    public async Task The_list_filters_sorts_and_refuses_unknown_values()
    {
        var moderator = await api.ModeratorTokenAsync();
        var newest = await api.GetAsync("/api/v1/admin/reports?pageSize=60", moderator);
        var oldest = await api.GetAsync("/api/v1/admin/reports?pageSize=60&sort=oldest", moderator);
        var dates = Json.Items(newest).Select(r => r.GetProperty("createdAt").GetDateTimeOffset()).ToList();
        Assert.Equal(dates.OrderDescending(), dates);
        Assert.Equal(Json.Items(newest).Count, Json.Items(oldest).Count);

        var bad = await ProblemAsync(await api.Client(moderator).GetAsync("/api/v1/admin/reports?status=closed&target=user&reason=spam", Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(["reason", "status", "target"], bad.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order());
    }
}
