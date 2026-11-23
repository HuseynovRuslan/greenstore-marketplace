using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Taxonomy;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Admin;

/// <summary>
/// The staff answers of phase 4 have the shapes of the frontend's types (src/types: <c>AdminOverview</c>,
/// <c>ReportQueue</c>, <c>ReportItem</c>, <c>AdminCategory</c>, <c>SellerVerification</c>, <c>BlockResult</c>), and the
/// codes they carry are the frontend's unions, so a renamed field or code on either side fails here.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class AdminContractTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static void NoProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));

    [Fact]
    public void The_report_account_and_category_codes_are_the_frontends_unions()
    {
        Assert.Equal(Contract.Unions["ReportReason"], KebabCase.Values<ReportReason>());
        Assert.Equal(Contract.Unions["ReportResolution"], KebabCase.Values<ReportResolution>());
        Assert.Equal(Contract.Unions["ComplaintStatus"], KebabCase.Values<ReportStatus>());
        Assert.Equal(Contract.Unions["AccountStatus"], KebabCase.Values<UserStatus>());
        Assert.Equal(Contract.Unions["CategoryForm"], KebabCase.Values<CategoryForm>());
        Assert.Equal(Contract.Unions["CategoryKind"], KebabCase.Values<CategoryKind>());
    }

    [Fact]
    public async Task The_overview_reports_and_categories_have_the_frontends_shapes()
    {
        var owner = await api.RegisterAsync(fullName: "Rauf Məmmədov");
        var listing = (await api.PublishAsync(owner)).GetProperty("id").GetString();
        var reporter = await api.RegisterAsync(fullName: "Aygün Əliyeva");
        var sent = await api.Client(reporter.Token).PostAsJsonAsync("/api/v1/reports", new { target = "listing", targetId = listing, reason = "wrong-info", comment = "Hündürlük düzgün deyil." }, Ct);
        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var id = (await JsonAsync(sent)).GetProperty("id").GetString();

        var moderator = await api.ModeratorTokenAsync();
        NoProblems(Contract.Check(await api.GetAsync("/api/v1/admin/overview", moderator), "AdminOverview"));
        NoProblems(Contract.Check(await api.GetAsync("/api/v1/admin/reports?pageSize=60", moderator), "ReportQueue"));

        var changed = await api.Client(moderator).PatchAsJsonAsync($"/api/v1/admin/reports/{id}", new { status = "resolved", resolution = "no-violation", note = "Yoxlandı." }, Ct);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var item = await JsonAsync(changed);
        NoProblems(Contract.Check(item, "ReportItem"));
        Assert.Single(item.GetProperty("history").EnumerateArray());
        Assert.True(item.TryGetProperty("reporter", out _));
        Assert.True(item.TryGetProperty("handledBy", out _));

        var admin = await api.AdminTokenAsync();
        NoProblems(Contract.Check(await api.GetAsync("/api/v1/admin/categories", admin), "AdminCategory[]"));
        NoProblems(Contract.Check(await api.GetAsync("/api/v1/admin/categories/agaclar", admin), "AdminCategory"));
    }

    [Fact]
    public async Task Verifying_a_seller_and_blocking_an_account_have_the_frontends_shapes()
    {
        var admin = await api.AdminTokenAsync();
        var business = await api.RegisterBusinessAsync();
        var seller = await api.GetAsync("/api/v1/me/seller", business.Token);

        var verified = await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{seller.GetProperty("id").GetString()}/verify", new { verified = true }, Ct);
        NoProblems(Contract.Check(await JsonAsync(verified), "SellerVerification"));

        var userId = business.Response.GetProperty("user").GetProperty("id").GetString();
        var blocked = await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{userId}/block", new { blocked = true }, Ct);
        NoProblems(Contract.Check(await JsonAsync(blocked), "BlockResult"));
        var unblocked = await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{userId}/block", new { blocked = false }, Ct);
        NoProblems(Contract.Check(await JsonAsync(unblocked), "BlockResult"));
    }
}
