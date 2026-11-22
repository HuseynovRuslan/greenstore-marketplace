using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary><c>POST /auth/login</c> (password, lockout, IP throttle) and <c>POST /auth/login/otp</c> (SMS code).</summary>
[Collection(AccountsCollection.Name)]
public sealed class LoginTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static Task<HttpResponseMessage> Login(HttpClient client, string login, string password) =>
        client.PostAsJsonAsync("/api/v1/auth/login", new { login, password }, Ct);

    private static async Task<JsonElement> OkAsync(HttpResponseMessage response)
    {
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode} {body}");
        return body;
    }

    [Fact]
    public async Task The_phone_number_in_any_shape_or_the_email_signs_in()
    {
        var email = $"satici{Guid.NewGuid():N}@poct.az";
        var account = await api.RegisterAsync(email: email);
        var local = $"0{account.Phone[4..6]} {account.Phone[6..9]} {account.Phone[9..11]} {account.Phone[11..]}";

        foreach (var login in new[] { account.Phone, local, account.Phone[4..], email.ToUpperInvariant(), $"  {email} " })
        {
            var body = await OkAsync(await Login(api.Client(), login, account.Password));
            Assert.Empty(Contract.Check(body, "{ ok: boolean; user: UserProfile; session: { id: string; token: string; expiresAt: string } }"));
            Assert.Equal(account.UserId, body.GetProperty("user").GetProperty("id").GetString());
            var me = await api.GetAsync("/api/v1/me", body.GetProperty("session").GetProperty("token").GetString()!);
            Assert.Equal(account.UserId, me.GetProperty("id").GetString());
        }
    }

    [Fact]
    public async Task A_wrong_password_or_login_does_not_say_which()
    {
        var account = await api.RegisterAsync();

        await ProblemAsync(await Login(api.Client(), account.Phone, "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        await ProblemAsync(await Login(api.Client(), AccountsApi.NewPhone(), "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        await ProblemAsync(await Login(api.Client(), "nobody@poct.az", "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        await ProblemAsync(await Login(api.Client(), "not a number", "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");

        var empty = await ProblemAsync(await Login(api.Client(), " ", ""), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("required", empty.GetProperty("errors").GetProperty("login")[0].GetString());
        Assert.Equal("required", empty.GetProperty("errors").GetProperty("password")[0].GetString());
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account_for_15_minutes()
    {
        var account = await api.RegisterAsync();
        for (var i = 0; i < 4; i++)
        {
            await ProblemAsync(await Login(api.Client(), account.Phone, "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        }

        var fifth = await Login(api.Client(), account.Phone, "Wrong-pass-1");
        await ProblemAsync(fifth, (HttpStatusCode)423, "auth.locked");
        Assert.Equal(TimeSpan.FromMinutes(15), fifth.Headers.RetryAfter?.Delta);

        // Locked: even the right password waits.
        api.Clock.Advance(TimeSpan.FromMinutes(10));
        var locked = await Login(api.Client(), account.Phone, account.Password);
        await ProblemAsync(locked, (HttpStatusCode)423, "auth.locked");
        Assert.Equal(TimeSpan.FromMinutes(5), locked.Headers.RetryAfter?.Delta);

        api.Clock.Advance(TimeSpan.FromMinutes(5));
        await OkAsync(await Login(api.Client(), account.Phone, account.Password));
        await using var db = api.CreateDbContext();
        var user = await db.Users.SingleAsync(u => u.Phone == account.Phone, Ct);
        Assert.Equal(0, user.FailedLogins);
        Assert.Null(user.LockedUntil);
    }

    [Fact]
    public async Task A_right_password_starts_the_count_again()
    {
        var account = await api.RegisterAsync();
        for (var i = 0; i < 4; i++)
        {
            await Login(api.Client(), account.Phone, "Wrong-pass-1");
        }

        await OkAsync(await Login(api.Client(), account.Phone, account.Password));

        await ProblemAsync(await Login(api.Client(), account.Phone, "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
    }

    [Fact]
    public async Task An_sms_code_opens_a_locked_account()
    {
        var account = await api.RegisterAsync();
        for (var i = 0; i < 5; i++)
        {
            await Login(api.Client(), account.Phone, "Wrong-pass-1");
        }

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var client = api.Client();
        var challengeId = await api.VerifiedChallengeAsync(client, account.Phone, "login");
        var body = await OkAsync(await client.PostAsJsonAsync("/api/v1/auth/login/otp", new { otpChallengeId = challengeId }, Ct));

        Assert.Equal(account.UserId, body.GetProperty("user").GetProperty("id").GetString());
        await api.GetAsync("/api/v1/me", body.GetProperty("session").GetProperty("token").GetString()!);
        await OkAsync(await Login(api.Client(), account.Phone, account.Password));
    }

    [Fact]
    public async Task A_sign_in_code_is_used_once_and_only_for_signing_in()
    {
        var account = await api.RegisterAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var client = api.Client();
        var challengeId = await api.VerifiedChallengeAsync(client, account.Phone, "login");
        await OkAsync(await client.PostAsJsonAsync("/api/v1/auth/login/otp", new { otpChallengeId = challengeId }, Ct));

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/auth/login/otp", new { otpChallengeId = challengeId }, Ct), HttpStatusCode.BadRequest, "otp.not-verified");

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var reset = await api.VerifiedChallengeAsync(client, account.Phone, "reset-password");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/auth/login/otp", new { otpChallengeId = reset }, Ct), HttpStatusCode.BadRequest, "otp.not-verified");
    }

    [Fact]
    public async Task Too_many_wrong_passwords_from_one_ip_make_it_wait()
    {
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Auth:FailedLoginsPerIp"] = "3" });
        var account = await api.RegisterAsync();
        var ip = AccountsApi.NewIp();
        for (var i = 0; i < 3; i++)
        {
            // Different accounts: the per-account lockout never sees more than one failure.
            await ProblemAsync(await Login(api.Client(ip: ip, factory: factory), AccountsApi.NewPhone(), "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        }

        var blocked = await Login(api.Client(ip: ip, factory: factory), account.Phone, account.Password);

        await ProblemAsync(blocked, HttpStatusCode.TooManyRequests, "auth.too-many-attempts");
        Assert.NotNull(blocked.Headers.RetryAfter);
        await OkAsync(await Login(api.Client(factory: factory), account.Phone, account.Password));
    }

    [Fact]
    public async Task A_blocked_account_cannot_sign_in()
    {
        var account = await api.RegisterAsync();
        await using (var db = api.CreateDbContext())
        {
            await db.Users.Where(u => u.Phone == account.Phone).ExecuteUpdateAsync(u => u.SetProperty(x => x.Status, UserStatus.Blocked), Ct);
        }

        await ProblemAsync(await Login(api.Client(), account.Phone, account.Password), HttpStatusCode.Forbidden, "auth.blocked");
        // A wrong password still says only that it is wrong.
        await ProblemAsync(await Login(api.Client(), account.Phone, "Wrong-pass-1"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        await ProblemAsync(
            await api.Client().PostAsJsonAsync("/api/v1/auth/otp", new { phone = account.Phone, purpose = "login" }, Ct),
            HttpStatusCode.Forbidden,
            "auth.blocked");
        // Its sessions stop working too.
        await ProblemAsync(await api.Client(account.Token).GetAsync("/api/v1/me", Ct), HttpStatusCode.Unauthorized, "unauthorized");
    }

    [Fact]
    public async Task A_demo_account_has_no_password_but_signs_in_with_an_sms_code()
    {
        // «Abşeron Tingçilik» of the sample marketplace (backend/seed/demo/users.json).
        const string Phone = "+994505551234";
        await ProblemAsync(await Login(api.Client(), Phone, "Bagban-2026"), HttpStatusCode.Unauthorized, "auth.wrong-credentials");

        api.Clock.Advance(TimeSpan.FromMinutes(2));
        var client = api.Client();
        var challengeId = await api.VerifiedChallengeAsync(client, Phone, "login");
        var body = await OkAsync(await client.PostAsJsonAsync("/api/v1/auth/login/otp", new { otpChallengeId = challengeId }, Ct));

        var user = body.GetProperty("user");
        Assert.Equal("Elvin Əliyev", user.GetProperty("fullName").GetString());
        Assert.Equal("business", user.GetProperty("accountType").GetString());
        var seller = await api.GetAsync("/api/v1/me/seller", body.GetProperty("session").GetProperty("token").GetString()!);
        Assert.Equal("abseron-tingcilik", seller.GetProperty("slug").GetString());
        Assert.Equal(user.GetProperty("sellerId").GetString(), seller.GetProperty("id").GetString());
    }

    [Theory]
    [InlineData(0, "admin")]
    [InlineData(1, "moderator")]
    public async Task The_dev_staff_accounts_sign_in_with_their_documented_passwords(int index, string role)
    {
        var account = DevAccountsSeeder.Accounts[index];

        var body = await OkAsync(await Login(api.Client(), account.Email, account.Password));

        Assert.Equal(role, body.GetProperty("user").GetProperty("role").GetString());
        Assert.Equal(account.Phone, body.GetProperty("user").GetProperty("phone").GetString());
    }

    [Fact]
    public async Task An_old_password_hash_is_upgraded_on_sign_in()
    {
        var account = await api.RegisterAsync();
        var v2 = new Microsoft.AspNetCore.Identity.PasswordHasher<User>(
            Microsoft.Extensions.Options.Options.Create(new Microsoft.AspNetCore.Identity.PasswordHasherOptions
            {
                CompatibilityMode = Microsoft.AspNetCore.Identity.PasswordHasherCompatibilityMode.IdentityV2,
            }));
        await using (var db = api.CreateDbContext())
        {
            var user = await db.Users.SingleAsync(u => u.Phone == account.Phone, Ct);
            user.PasswordHash = v2.HashPassword(user, account.Password);
            await db.SaveChangesAsync(Ct);
        }

        await OkAsync(await Login(api.Client(), account.Phone, account.Password));

        await using var check = api.CreateDbContext();
        var hash = (await check.Users.SingleAsync(u => u.Phone == account.Phone, Ct)).PasswordHash!;
        Assert.Equal(1, Convert.FromBase64String(hash)[0]);
    }
}
