using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary>Who may call what: sessions for /me, roles for staff endpoints, limits for anonymous POSTs.</summary>
[Collection(AccountsCollection.Name)]
public sealed class AuthorizationTests(AccountsApi api)
{
    public static TheoryData<string, string> SignedInEndpoints() => new()
    {
        { "GET", "/api/v1/me" },
        { "PATCH", "/api/v1/me" },
        { "POST", "/api/v1/me/password" },
        { "POST", "/api/v1/me/phone" },
        { "GET", "/api/v1/me/sessions" },
        { "DELETE", "/api/v1/me/sessions/019a8b4e-0000-7000-8000-000000000001" },
        { "GET", "/api/v1/me/seller" },
        { "PATCH", "/api/v1/me/seller" },
        { "GET", "/api/v1/me/favorites" },
        { "GET", "/api/v1/me/favorites/items" },
        { "PUT", "/api/v1/me/favorites/listing/019a8b4e-0000-7000-8000-000000000001" },
        { "DELETE", "/api/v1/me/favorites/listing/019a8b4e-0000-7000-8000-000000000001" },
        { "POST", "/api/v1/me/favorites/merge" },
        { "GET", "/api/v1/me/saved-searches" },
        { "POST", "/api/v1/me/saved-searches" },
        { "PATCH", "/api/v1/me/saved-searches/019a8b4e-0000-7000-8000-000000000001" },
        { "POST", "/api/v1/me/saved-searches/019a8b4e-0000-7000-8000-000000000001/opened" },
        { "DELETE", "/api/v1/me/saved-searches/019a8b4e-0000-7000-8000-000000000001" },
        { "GET", "/api/v1/me/listings" },
        { "GET", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001" },
        { "PUT", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001" },
        { "POST", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001/renew" },
        { "POST", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001/deactivate" },
        { "POST", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001/activate" },
        { "DELETE", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001" },
        { "GET", "/api/v1/me/listings/019a8b4e-0000-7000-8000-000000000001/stats" },
        { "GET", "/api/v1/me/drafts" },
        { "POST", "/api/v1/me/drafts" },
        { "GET", "/api/v1/me/drafts/019a8b4e-0000-7000-8000-000000000001" },
        { "PUT", "/api/v1/me/drafts/019a8b4e-0000-7000-8000-000000000001" },
        { "DELETE", "/api/v1/me/drafts/019a8b4e-0000-7000-8000-000000000001" },
    };

    [Theory]
    [MemberData(nameof(SignedInEndpoints))]
    public async Task Every_me_endpoint_needs_a_session(string method, string path)
    {
        var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (method is "POST" or "PATCH" or "PUT")
        {
            request.Content = JsonContent.Create(new { });
        }

        var response = await api.Client().SendAsync(request, Ct);

        await ProblemAsync(response, HttpStatusCode.Unauthorized, "unauthorized");
    }

    [Fact]
    public void Every_me_endpoint_of_the_api_is_in_that_list()
    {
        using var factory = api.Variant();
        var sources = factory.Services.GetRequiredService<EndpointDataSource>();
        var me = sources.Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1/me", StringComparison.Ordinal) == true)
            .SelectMany(e => e.Metadata.GetMetadata<HttpMethodMetadata>()!.HttpMethods.Select(m => $"{m} {e.RoutePattern.RawText}"))
            .Order()
            .ToList();

        Assert.Equal(SignedInEndpoints().Count, me.Count);
        Assert.All(sources.Endpoints.OfType<RouteEndpoint>().Where(e => e.RoutePattern.RawText?.StartsWith("/api/v1/me", StringComparison.Ordinal) == true),
            e => Assert.NotEmpty(e.Metadata.GetOrderedMetadata<Microsoft.AspNetCore.Authorization.IAuthorizeData>()));
    }

    [Fact]
    public async Task Every_anonymous_post_is_rate_limited_per_ip()
    {
        await using var factory = api.Variant();
        var sources = factory.Services.GetRequiredService<EndpointDataSource>();
        var posts = sources.Endpoints.OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText is { } route
                && (route.StartsWith("/api/v1/auth", StringComparison.Ordinal) || route.StartsWith("/api/v1/accounts", StringComparison.Ordinal))
                && e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.Contains("POST") == true)
            .ToList();

        Assert.Equal(7, posts.Count);
        foreach (var post in posts.Where(p => p.RoutePattern.RawText != "/api/v1/auth/logout"))
        {
            Assert.Equal(RateLimitPolicies.AnonymousWrites, post.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName);
        }

        await using var limited = api.Variant(new Dictionary<string, string?> { ["RateLimiting:AnonymousWrites:PermitLimit"] = "2" });
        var ip = AccountsApi.NewIp();
        for (var i = 0; i < 2; i++)
        {
            var allowed = await api.Client(ip: ip, factory: limited).PostAsJsonAsync("/api/v1/auth/login", new { login = "x@y.az", password = "Wrong-pass-1" }, Ct);
            Assert.Equal(HttpStatusCode.Unauthorized, allowed.StatusCode);
        }

        var refused = await api.Client(ip: ip, factory: limited).PostAsJsonAsync("/api/v1/auth/otp", new { phone = "+994551234567", purpose = "register" }, Ct);
        await ProblemAsync(refused, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.NotNull(refused.Headers.RetryAfter);
    }

    [Fact]
    public async Task Staff_endpoints_need_their_role()
    {
        var user = await api.RegisterAsync();
        var moderator = await SignInAsync(DevAccountsSeeder.Accounts[1]);
        var admin = await SignInAsync(DevAccountsSeeder.Accounts[0]);

        await ProblemAsync(await api.Client().GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct), HttpStatusCode.Unauthorized, "unauthorized");
        await ProblemAsync(await api.Client(user.Token).GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct), HttpStatusCode.Forbidden, "forbidden");
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(moderator).GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(admin).GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct)).StatusCode);

        await ProblemAsync(await api.Client(user.Token).GetAsync($"{TestEndpoints.Prefix}/admin-only", Ct), HttpStatusCode.Forbidden, "forbidden");
        await ProblemAsync(await api.Client(moderator).GetAsync($"{TestEndpoints.Prefix}/admin-only", Ct), HttpStatusCode.Forbidden, "forbidden");
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(admin).GetAsync($"{TestEndpoints.Prefix}/admin-only", Ct)).StatusCode);
    }

    [Fact]
    public async Task A_role_change_takes_effect_on_the_next_request()
    {
        var user = await api.RegisterAsync();
        await ProblemAsync(await api.Client(user.Token).GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct), HttpStatusCode.Forbidden, "forbidden");
        await using (var db = api.CreateDbContext())
        {
            var row = await db.Users.FindAsync([user.Id], Ct);
            row!.Role = GreenStore.Api.Modules.Accounts.UserRole.Moderator;
            await db.SaveChangesAsync(Ct);
        }

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(user.Token).GetAsync($"{TestEndpoints.Prefix}/staff-only", Ct)).StatusCode);
        Assert.Equal("moderator", (await api.GetAsync("/api/v1/me", user.Token)).GetProperty("role").GetString());
    }

    private async Task<string> SignInAsync(DevAccount account)
    {
        var response = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("session").GetProperty("token").GetString()!;
    }
}
