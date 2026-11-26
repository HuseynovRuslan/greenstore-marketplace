using System.Net;
using System.Net.Http.Json;
using System.Text;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary><c>/me</c>: the profile (name, e-mail, language), the password and the phone number.</summary>
[Collection(AccountsCollection.Name)]
public sealed class MeTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static Task<HttpResponseMessage> Patch(HttpClient client, string json) =>
        client.PatchAsync("/api/v1/me", new StringContent(json, Encoding.UTF8, "application/json"), Ct);

    [Fact]
    public async Task Me_is_the_UserProfile_with_role_and_locale()
    {
        var account = await api.RegisterAsync(email: $"me{Guid.NewGuid():N}@poct.az");

        var me = await api.GetAsync("/api/v1/me", account.Token);

        Assert.Empty(Contract.Check(me, "UserProfile"));
        Assert.Equal(["id", "fullName", "email", "phone", "accountType", "role", "locale"], me.EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task An_account_without_email_has_an_empty_one()
    {
        var account = await api.RegisterAsync();

        var me = await api.GetAsync("/api/v1/me", account.Token);

        Assert.Equal(string.Empty, me.GetProperty("email").GetString());
    }

    [Fact]
    public async Task What_is_sent_changes_and_the_rest_stays()
    {
        var account = await api.RegisterAsync(email: $"old{Guid.NewGuid():N}@poct.az", fullName: "Köhnə Ad");
        var email = $"yeni{Guid.NewGuid():N}@poct.az";

        var response = await Patch(api.Client(account.Token), $$"""{ "fullName": "  Yeni Ad  ", "email": "{{email}}", "locale": "ru" }""");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await JsonAsync(response);
        Assert.Equal("Yeni Ad", me.GetProperty("fullName").GetString());
        Assert.Equal(email, me.GetProperty("email").GetString());
        Assert.Equal("ru", me.GetProperty("locale").GetString());

        var unchanged = await JsonAsync(await Patch(api.Client(account.Token), """{ "locale": "en" }"""));
        Assert.Equal("Yeni Ad", unchanged.GetProperty("fullName").GetString());
        Assert.Equal(email, unchanged.GetProperty("email").GetString());

        var cleared = await JsonAsync(await Patch(api.Client(account.Token), """{ "email": null }"""));
        Assert.Equal(string.Empty, cleared.GetProperty("email").GetString());
    }

    [Fact]
    public async Task The_sms_language_follows_the_account()
    {
        var account = await api.RegisterAsync();
        await Patch(api.Client(account.Token), """{ "locale": "en" }""");
        api.Clock.Advance(TimeSpan.FromMinutes(2));

        await api.RequestOtpAsync(api.Client(), account.Phone, "login");

        Assert.StartsWith("GreenStore code: ", api.Sms.To(account.Phone)[^1].Text);
    }

    [Fact]
    public async Task Wrong_values_are_refused()
    {
        var other = $"taken{Guid.NewGuid():N}@poct.az";
        await api.RegisterAsync(email: other);
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);

        var errors = (await ProblemAsync(await Patch(client, """{ "fullName": "", "email": "yeni@poct", "locale": null }"""), HttpStatusCode.BadRequest, "validation"))
            .GetProperty("errors");
        Assert.Equal("required", errors.GetProperty("fullName")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("email")[0].GetString());
        Assert.Equal("required", errors.GetProperty("locale")[0].GetString());

        var name = (await ProblemAsync(await Patch(client, """{ "fullName": "Elvin 050" }"""), HttpStatusCode.BadRequest, "validation")).GetProperty("errors");
        Assert.Equal("invalid", name.GetProperty("fullName")[0].GetString());

        await ProblemAsync(await Patch(client, $$"""{ "email": "{{other.ToUpperInvariant()}}" }"""), HttpStatusCode.Conflict, "account.email-taken");
        await ProblemAsync(await Patch(client, """{ "locale": "de" }"""), HttpStatusCode.BadRequest, "bad-request");
        Assert.Equal("Test İstifadəçi", (await api.GetAsync("/api/v1/me", account.Token)).GetProperty("fullName").GetString());
    }

    [Fact]
    public async Task Changing_the_password_needs_the_current_one()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/password", new { current = "Wrong-pass-1", next = "Yeni-sifre-7" }, Ct), HttpStatusCode.BadRequest, "auth.wrong-password");
        var weak = await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/password", new { current = account.Password, next = "sifresiz" }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("too-weak", weak.GetProperty("errors").GetProperty("next")[0].GetString());

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/me/password", new { current = account.Password, next = "Yeni-sifre-7" }, Ct)).StatusCode);
        var login = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = "Yeni-sifre-7" }, Ct);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task Wrong_current_passwords_lock_the_account_too()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        for (var i = 0; i < 4; i++)
        {
            await client.PostAsJsonAsync("/api/v1/me/password", new { current = "Wrong-pass-1", next = "Yeni-sifre-7" }, Ct);
        }

        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/password", new { current = "Wrong-pass-1", next = "Yeni-sifre-7" }, Ct), (HttpStatusCode)423, "auth.locked");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/password", new { current = account.Password, next = "Yeni-sifre-7" }, Ct), (HttpStatusCode)423, "auth.locked");
    }

    [Fact]
    public async Task A_new_phone_number_is_proved_with_a_code_sent_to_it()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "change-phone");

        var response = await client.PostAsJsonAsync("/api/v1/me/phone", new { otpChallengeId = challengeId }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(phone, (await JsonAsync(response)).GetProperty("phone").GetString());
        var login = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = phone, password = account.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var old = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        await ProblemAsync(old, HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/me/phone", new { otpChallengeId = challengeId }, Ct), HttpStatusCode.BadRequest, "otp.not-verified");
    }

    [Fact]
    public async Task A_number_taken_meanwhile_is_refused()
    {
        var account = await api.RegisterAsync();
        var client = api.Client(account.Token);
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(client, phone, "change-phone");
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        await api.RegisterAsync(phone: phone);

        var response = await client.PostAsJsonAsync("/api/v1/me/phone", new { otpChallengeId = challengeId }, Ct);

        await ProblemAsync(response, HttpStatusCode.Conflict, "account.phone-taken");
    }

    [Fact]
    public async Task A_registration_code_does_not_change_the_number()
    {
        var account = await api.RegisterAsync();
        var phone = AccountsApi.NewPhone();
        var challengeId = await api.VerifiedChallengeAsync(api.Client(), phone, "register");

        var response = await api.Client(account.Token).PostAsJsonAsync("/api/v1/me/phone", new { otpChallengeId = challengeId }, Ct);

        await ProblemAsync(response, HttpStatusCode.BadRequest, "otp.not-verified");
    }
}
