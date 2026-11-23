using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Admin;

/// <summary>«Təsdiqlənmiş satıcı» and blocking an account, end to end.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class AdminAccountsTests(LifecycleApi api)
{
    [Fact]
    public async Task The_admin_verifies_a_business_and_the_seller_page_shows_it()
    {
        var admin = await api.AdminTokenAsync();
        var business = await api.RegisterBusinessAsync();
        var seller = await api.GetAsync("/api/v1/me/seller", business.Token);
        var id = seller.GetProperty("id").GetString();
        var slug = seller.GetProperty("slug").GetString();
        Assert.False(seller.GetProperty("verified").GetBoolean());

        var verified = await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{id}/verify", new { verified = true }, Ct);

        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        var body = await JsonAsync(verified);
        Assert.True(body.GetProperty("verified").GetBoolean());
        Assert.True(body.TryGetProperty("verifiedAt", out _));
        Assert.True((await JsonAsync(await api.Client().GetAsync($"/api/v1/sellers/{slug}", Ct))).GetProperty("verified").GetBoolean());

        // Again: nothing changes, nothing more is logged.
        await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{id}/verify", new { verified = true }, Ct);
        var unverified = await JsonAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{id}/verify", new { verified = false }, Ct));
        Assert.False(unverified.GetProperty("verified").GetBoolean());
        Assert.False((await JsonAsync(await api.Client().GetAsync($"/api/v1/sellers/{slug}", Ct))).GetProperty("verified").GetBoolean());

        await using var db = api.CreateDbContext();
        Assert.Equal(["seller.unverify", "seller.verify"], (await db.AuditLog.AsNoTracking().Where(e => e.TargetType == "seller" && e.TargetId == id).Select(e => e.Action).ToListAsync(Ct)).Order());
        var row = await db.Sellers.AsNoTracking().SingleAsync(s => s.Id == Guid.Parse(id!), Ct);
        Assert.Null(row.VerifiedBy);

        await ProblemAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{id}/verify", new { }, Ct), HttpStatusCode.BadRequest, "validation");
        await ProblemAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{Guid.NewGuid()}/verify", new { verified = true }, Ct), HttpStatusCode.NotFound, "seller.not-found");
    }

    [Fact]
    public async Task Blocking_ends_the_sessions_and_takes_the_listings_off_until_unblocked()
    {
        var admin = await api.AdminTokenAsync();
        var owner = await api.RegisterBusinessAsync();
        var listing = await api.PublishAsync(owner);
        var slug = listing.GetProperty("slug").GetString();
        var listingId = listing.GetProperty("id").GetString();
        var pending = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);

        var blocked = await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{owner.UserId}/block", new { blocked = true, reason = "Dələduzluq şikayətləri" }, Ct);

        Assert.Equal(HttpStatusCode.OK, blocked.StatusCode);
        var result = await JsonAsync(blocked);
        Assert.Equal("blocked", result.GetProperty("status").GetString());
        Assert.Equal(1, result.GetProperty("sessionsRevoked").GetInt32());
        Assert.Equal(1, result.GetProperty("listingsHidden").GetInt32());
        await ProblemAsync(await api.Client(owner.Token).GetAsync("/api/v1/me", Ct), HttpStatusCode.Unauthorized, "unauthorized");
        await ProblemAsync(await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = owner.Phone, password = owner.Password }, Ct), HttpStatusCode.Forbidden, "auth.blocked");
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().PostAsync($"/api/v1/listings/{listingId}/phone-reveals", null, Ct)).StatusCode);

        // Its pending listing cannot be published meanwhile.
        var moderator = await api.ModeratorTokenAsync();
        var version = (await api.ModerationItemAsync(moderator, pending)).GetProperty("version").GetString();
        await ProblemAsync(
            await api.Client(moderator).PostAsJsonAsync($"/api/v1/admin/moderation/{pending}/decision", new { decision = "approve", version }, Ct),
            HttpStatusCode.Conflict,
            AdminErrors.OwnerBlocked);

        // Blocking again changes nothing.
        Assert.Equal(0, (await JsonAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{owner.UserId}/block", new { blocked = true }, Ct))).GetProperty("listingsHidden").GetInt32());

        var unblocked = await JsonAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{owner.UserId}/block", new { blocked = false }, Ct));

        Assert.Equal("active", unblocked.GetProperty("status").GetString());
        Assert.Equal(1, unblocked.GetProperty("listingsRestored").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await api.Client().GetAsync($"/api/v1/listings/{slug}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = owner.Phone, password = owner.Password }, Ct)).StatusCode);
        // The old session stays ended.
        await ProblemAsync(await api.Client(owner.Token).GetAsync("/api/v1/me", Ct), HttpStatusCode.Unauthorized, "unauthorized");

        await using var db = api.CreateDbContext();
        Assert.Equal(["user.block", "user.unblock"], (await db.AuditLog.AsNoTracking().Where(e => e.TargetType == "user" && e.TargetId == owner.UserId).OrderBy(e => e.Id).Select(e => e.Action).ToListAsync(Ct)));
        Assert.Equal(UserStatus.Active, (await db.Users.AsNoTracking().SingleAsync(u => u.Id == owner.Id, Ct)).Status);
    }

    [Fact]
    public async Task Unblocking_leaves_listings_the_owner_had_taken_off_and_brings_an_expired_one_back_expired()
    {
        var admin = await api.AdminTokenAsync();
        var owner = await api.RegisterAsync();
        var offByOwner = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var expiring = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{offByOwner}/deactivate", null, Ct)).StatusCode);

        Assert.Equal(1, (await JsonAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{owner.UserId}/block", new { blocked = true }, Ct))).GetProperty("listingsHidden").GetInt32());
        await using (var db = api.CreateDbContext())
        {
            await db.Listings.Where(l => l.Id == Guid.Parse(expiring)).ExecuteUpdateAsync(l => l.SetProperty(x => x.ExpiresAt, api.Clock.Now.AddMinutes(-1)), Ct);
        }

        var unblocked = await JsonAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{owner.UserId}/block", new { blocked = false }, Ct));

        Assert.Equal(1, unblocked.GetProperty("listingsRestored").GetInt32());
        var token = await LoginAsync(owner);
        Assert.Equal("inactive", (await api.GetAsync($"/api/v1/me/listings/{offByOwner}", token)).GetProperty("status").GetString());
        Assert.Equal("expired", (await api.GetAsync($"/api/v1/me/listings/{expiring}", token)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task The_admin_cannot_block_themselves_or_an_unknown_account()
    {
        var admin = await api.AdminTokenAsync();
        await using var db = api.CreateDbContext();
        var adminId = await db.Users.Where(u => u.Phone == GreenStore.Api.Data.Seed.DevAccountsSeeder.Accounts[0].Phone).Select(u => u.Id).SingleAsync(Ct);

        await ProblemAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{adminId}/block", new { blocked = true }, Ct), HttpStatusCode.Conflict, AdminErrors.CannotBlockSelf);
        await ProblemAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{Guid.NewGuid()}/block", new { blocked = true }, Ct), HttpStatusCode.NotFound, AdminErrors.AccountNotFound);
        var problem = await ProblemAsync(await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{adminId}/block", new { reason = new string('r', 501) }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(["blocked", "reason"], problem.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order());
    }

    private async Task<string> LoginAsync(Account account)
    {
        var response = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("session").GetProperty("token").GetString()!;
    }
}
