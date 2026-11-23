using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Admin;

/// <summary>
/// Who may use the staff endpoints (ARCHITECTURE.md §14): moderators and admins see moderation, reports and the admin
/// home; categories, verification and blocking are for admins. Every /admin route is listed here with its policy.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class AdminAccessTests(LifecycleApi api)
{
    private const string AnyId = "019a8b4e-0000-7000-8000-000000000001";

    /// <summary>Method, route template, policy.</summary>
    public static TheoryData<string, string, string> AdminRoutes() => new()
    {
        { "GET", "/api/v1/admin/overview", Access.StaffPolicy },
        { "GET", "/api/v1/admin/moderation", Access.StaffPolicy },
        { "GET", "/api/v1/admin/moderation/{listingId:guid}", Access.StaffPolicy },
        { "POST", "/api/v1/admin/moderation/{listingId:guid}/decision", Access.StaffPolicy },
        { "GET", "/api/v1/admin/reports", Access.StaffPolicy },
        { "GET", "/api/v1/admin/reports/{id:guid}", Access.StaffPolicy },
        { "PATCH", "/api/v1/admin/reports/{id:guid}", Access.StaffPolicy },
        { "GET", "/api/v1/admin/categories", Access.AdminPolicy },
        { "GET", "/api/v1/admin/categories/{id}", Access.AdminPolicy },
        { "POST", "/api/v1/admin/categories", Access.AdminPolicy },
        { "PATCH", "/api/v1/admin/categories/{id}", Access.AdminPolicy },
        { "DELETE", "/api/v1/admin/categories/{id}", Access.AdminPolicy },
        { "POST", "/api/v1/admin/sellers/{id:guid}/verify", Access.AdminPolicy },
        { "POST", "/api/v1/admin/users/{id:guid}/block", Access.AdminPolicy },
    };

    [Fact]
    public void Every_admin_route_of_the_api_is_in_that_list_with_its_policy()
    {
        using var factory = api.Variant();
        var routes = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1/admin", StringComparison.Ordinal) == true)
            .SelectMany(e => e.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Select(m => (
                Route: $"{m} {e.RoutePattern.RawText!.TrimEnd('/')}",
                Policies: e.Metadata.GetOrderedMetadata<IAuthorizeData>().Select(a => a.Policy).OfType<string>().ToList())))
            .ToList();

        Assert.Equal(
            AdminRoutes().Select(r => $"{r.Data.Item1} {r.Data.Item2}").Order(),
            routes.Select(r => r.Route).Order());
        foreach (var row in AdminRoutes())
        {
            var (method, template, policy) = row.Data;
            Assert.Equal([policy], routes.Single(r => r.Route == $"{method} {template}").Policies);
        }
    }

    [Theory]
    [MemberData(nameof(AdminRoutes))]
    public async Task Nobody_else_gets_in(string method, string template, string policy)
    {
        var user = await api.RegisterAsync();
        var moderator = await api.ModeratorTokenAsync();
        var path = template.Replace("{listingId:guid}", AnyId, StringComparison.Ordinal).Replace("{id:guid}", AnyId, StringComparison.Ordinal).Replace("{id}", "agaclar", StringComparison.Ordinal);
        HttpRequestMessage Request() => new(new HttpMethod(method), path) { Content = method is "POST" or "PATCH" ? JsonContent.Create(new { }) : null };

        await ProblemAsync(await api.Client().SendAsync(Request(), Ct), HttpStatusCode.Unauthorized, "unauthorized");
        await ProblemAsync(await api.Client(user.Token).SendAsync(Request(), Ct), HttpStatusCode.Forbidden, "forbidden");
        if (policy == Access.AdminPolicy)
        {
            await ProblemAsync(await api.Client(moderator).SendAsync(Request(), Ct), HttpStatusCode.Forbidden, "forbidden");
        }
    }

    [Fact]
    public async Task The_admin_home_has_the_numbers_of_every_section()
    {
        foreach (var token in new[] { await api.ModeratorTokenAsync(), await api.AdminTokenAsync() })
        {
            var overview = await api.GetAsync("/api/v1/admin/overview", token);

            Assert.Equal(
                ["categories", "listings", "moderation", "reports", "sellers", "serviceRequests", "support", "users"],
                overview.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.Equal(["approved", "pending", "recheck", "rejected"], overview.GetProperty("moderation").EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.Equal(["blocked", "business", "individual", "newThisWeek", "staff", "total"], overview.GetProperty("users").EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.True(overview.GetProperty("listings").GetProperty("active").GetInt32() > 0);
            Assert.True(overview.GetProperty("users").GetProperty("staff").GetInt32() >= 2);
            Assert.True(overview.GetProperty("categories").GetProperty("subcategories").GetInt32() > 0);

            // The same numbers as the moderation queue's header.
            var queue = await api.GetAsync("/api/v1/admin/moderation?pageSize=1", token);
            Assert.Equal(queue.GetProperty("totals").ToString(), overview.GetProperty("moderation").ToString());
        }
    }
}
