using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary><c>POST /accounts</c>: a verified number becomes an account, signed in at once; a business opens its «mağaza».</summary>
[Collection(AccountsCollection.Name)]
public sealed class RegistrationTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static object Body(string phone, string challengeId, string accountType = "individual", string password = "Bagban-2026", string? companyName = null, string? businessKind = null, string? email = null, string fullName = "Leyla Məmmədova", string? cityId = null) =>
        new { accountType, fullName, phone, password, otpChallengeId = challengeId, companyName, businessKind, email, cityId };

    [Fact]
    public async Task An_individual_account_is_created_and_signed_in()
    {
        var client = api.Client();
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("en");
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "register");

        var response = await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, challengeId, email: " Leyla@Poct.az "), Ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/v1/me", response.Headers.Location?.OriginalString);
        var body = await JsonAsync(response);
        Assert.Empty(Contract.Check(body, "{ ok: boolean; user: UserProfile; session: { id: string; token: string; expiresAt: string } }"));
        Assert.True(body.GetProperty("ok").GetBoolean());
        var user = body.GetProperty("user");
        Assert.Equal("Leyla Məmmədova", user.GetProperty("fullName").GetString());
        Assert.Equal(phone, user.GetProperty("phone").GetString());
        Assert.Equal("Leyla@Poct.az", user.GetProperty("email").GetString());
        Assert.Equal("individual", user.GetProperty("accountType").GetString());
        Assert.Equal("user", user.GetProperty("role").GetString());
        Assert.Equal("en", user.GetProperty("locale").GetString());
        Assert.False(user.TryGetProperty("sellerId", out _));
        var session = body.GetProperty("session");
        Assert.Equal(api.Clock.GetUtcNow().AddDays(30), session.GetProperty("expiresAt").GetDateTimeOffset());

        var me = await api.GetAsync("/api/v1/me", session.GetProperty("token").GetString()!);
        Assert.Equal(user.GetRawText(), me.GetRawText());

        await using var db = api.CreateDbContext();
        var row = await db.Users.SingleAsync(u => u.Phone == phone, Ct);
        // ASP.NET Core Identity's V3 format (PBKDF2): marker byte 0x01, never the password itself.
        Assert.Equal(1, Convert.FromBase64String(row.PasswordHash!)[0]);
        Assert.DoesNotContain("Bagban", row.PasswordHash, StringComparison.Ordinal);
        var stored = await db.Sessions.SingleAsync(s => s.UserId == row.Id, Ct);
        Assert.Equal("Chrome, Windows", stored.DeviceName);
        Assert.Equal(SessionClient.Web, stored.Client);
        Assert.Equal(32, stored.TokenHash.Length);
        Assert.NotNull(stored.IpHash);
    }

    [Fact]
    public async Task A_business_account_opens_its_shop_at_once()
    {
        var account = await api.RegisterAsync(accountType: "business", companyName: "  Gəncə Bağ Evi ", businessKind: "garden-centre", fullName: "Nihad Quliyev");
        var user = account.Response.GetProperty("user");
        var sellerId = user.GetProperty("sellerId").GetString()!;

        var seller = await api.GetAsync($"/api/v1/sellers/by-id/{sellerId}", account.Token);
        var slug = seller.GetProperty("slug").GetString()!;
        var page = await api.GetAsync($"/api/v1/sellers/{slug}", account.Token);
        var directory = await api.GetAsync("/api/v1/sellers?businessKind=garden-centre&pageSize=60", account.Token);

        Assert.StartsWith("gence-bag-evi", slug);
        Assert.Equal("Gəncə Bağ Evi", page.GetProperty("name").GetString());
        Assert.Equal("garden-centre", page.GetProperty("businessKind").GetString());
        Assert.Equal("Bağ mərkəzi", page.GetProperty("kind").GetString());
        Assert.Equal("business", page.GetProperty("type").GetString());
        Assert.Equal("baki", page.GetProperty("cityId").GetString());
        Assert.Equal("Nihad Quliyev", page.GetProperty("contactPerson").GetString());
        Assert.Equal(0, page.GetProperty("activeListings").GetInt32());
        Assert.False(page.GetProperty("verified").GetBoolean());
        Assert.Equal(2026, page.GetProperty("memberSince").GetInt32());
        Assert.Equal($"+994 55 *** ** {account.Phone[^2..]}", page.GetProperty("phoneMasked").GetString());
        Assert.Contains(Json.Slugs(directory.GetProperty("items")), s => s == slug);
        Assert.Empty(Contract.Check(page, "Seller"));
    }

    [Fact]
    public async Task Two_businesses_with_one_name_get_two_addresses()
    {
        var first = await api.RegisterAsync(accountType: "business", companyName: "Lənkəran Sitrus", businessKind: "nursery", cityId: "lenkeran");
        var second = await api.RegisterAsync(accountType: "business", companyName: "Lənkəran Sitrus", businessKind: "nursery");

        var a = await api.GetAsync($"/api/v1/sellers/by-id/{first.Response.GetProperty("user").GetProperty("sellerId").GetString()}", first.Token);
        var b = await api.GetAsync($"/api/v1/sellers/by-id/{second.Response.GetProperty("user").GetProperty("sellerId").GetString()}", second.Token);

        Assert.Equal("lenkeran-sitrus", a.GetProperty("slug").GetString());
        Assert.Equal("lenkeran", a.GetProperty("cityId").GetString());
        Assert.Equal("lenkeran-sitrus-2", b.GetProperty("slug").GetString());
    }

    [Fact]
    public async Task A_verified_code_proves_the_number_once()
    {
        var client = api.Client();
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "register");
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, challengeId), Ct)).StatusCode);

        var again = await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, challengeId), Ct);

        await ProblemAsync(again, HttpStatusCode.BadRequest, "otp.not-verified");
    }

    [Fact]
    public async Task The_proof_must_be_a_verified_registration_code_for_this_number()
    {
        var client = api.Client();
        var phone = AccountsApi.NewPhone();
        var unverified = (await api.RequestOtpAsync(client, phone, "register")).GetProperty("challengeId").GetString()!;
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, unverified), Ct), HttpStatusCode.BadRequest, "otp.not-verified");

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var verified = await api.VerifiedChallengeAsync(client, phone, "register");
        var otherNumber = AccountsApi.NewPhone();
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/accounts", Body(otherNumber, verified), Ct), HttpStatusCode.BadRequest, "otp.not-verified");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, "nonsense"), Ct), HttpStatusCode.BadRequest, "otp.not-verified");

        // A sign-in code is not a registration code.
        var existing = await api.RegisterAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var login = await api.VerifiedChallengeAsync(api.Client(), existing.Phone, "login");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/accounts", Body(existing.Phone, login), Ct), HttpStatusCode.BadRequest, "otp.not-verified");

        // Verified more than 30 minutes ago: too old.
        api.Clock.Advance(TimeSpan.FromMinutes(31));
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, verified), Ct), HttpStatusCode.BadRequest, "otp.not-verified");
    }

    [Fact]
    public async Task Every_wrong_field_is_named()
    {
        var client = api.Client();
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "register");

        var response = await client.PostAsJsonAsync(
            "/api/v1/accounts",
            Body(phone, challengeId, accountType: "business", password: "abcdefgh", email: "leyla@poct", fullName: " ", cityId: "paris"),
            Ct);

        var errors = (await ProblemAsync(response, HttpStatusCode.BadRequest, "validation")).GetProperty("errors");
        Assert.Equal("too-weak", errors.GetProperty("password")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("email")[0].GetString());
        Assert.Equal("required", errors.GetProperty("fullName")[0].GetString());
        Assert.Equal("required", errors.GetProperty("companyName")[0].GetString());
        Assert.Equal("required", errors.GetProperty("businessKind")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("cityId")[0].GetString());

        // Nothing was used up: the same proof still works once the fields are right.
        var ok = await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, challengeId), Ct);
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task An_email_belongs_to_one_account()
    {
        var email = $"bag{Guid.NewGuid():N}@poct.az";
        await api.RegisterAsync(email: email);
        var client = api.Client();
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "register");

        var response = await client.PostAsJsonAsync("/api/v1/accounts", Body(phone, challengeId, email: email.ToUpperInvariant()), Ct);

        await ProblemAsync(response, HttpStatusCode.Conflict, "account.email-taken");
    }

    [Fact]
    public async Task The_mobile_app_names_its_device()
    {
        var client = api.Client();
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "register");

        var response = await client.PostAsJsonAsync(
            "/api/v1/accounts",
            new { accountType = "individual", fullName = "Test", phone, password = "Bagban-2026", otpChallengeId = challengeId, client = "ios", deviceName = "iPhone 15" },
            Ct);

        var body = await JsonAsync(response);
        var sessions = await api.GetAsync("/api/v1/me/sessions", body.GetProperty("session").GetProperty("token").GetString()!);
        var session = Assert.Single(sessions.EnumerateArray());
        Assert.Equal("ios", session.GetProperty("client").GetString());
        Assert.Equal("iPhone 15", session.GetProperty("deviceName").GetString());
        Assert.True(session.GetProperty("current").GetBoolean());
        Assert.Equal(JsonValueKind.String, session.GetProperty("lastSeenAt").ValueKind);
    }
}
