using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Common.Security;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary><c>POST /auth/otp</c> and <c>/auth/otp/verify</c>: the code, its limits and its checks (ARCHITECTURE.md §14).</summary>
[Collection(AccountsCollection.Name)]
public sealed class OtpEndpointsTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static Task<HttpResponseMessage> Request(HttpClient client, string phone, string purpose = "register") =>
        client.PostAsJsonAsync("/api/v1/auth/otp", new { phone, purpose }, Ct);

    private static Task<HttpResponseMessage> Verify(HttpClient client, string challengeId, string code) =>
        client.PostAsJsonAsync("/api/v1/auth/otp/verify", new { challengeId, code }, Ct);

    [Fact]
    public async Task A_code_is_sent_by_sms_and_answered_with_the_challenge()
    {
        var phone = AccountsApi.NewPhone();

        var challenge = await api.RequestOtpAsync(api.Client(), phone, "register");

        Assert.Empty(Contract.Check(challenge, "OtpChallenge"));
        Assert.Equal($"+994 55 *** ** {phone[^2..]}", challenge.GetProperty("phoneMasked").GetString());
        Assert.Equal(300, challenge.GetProperty("expiresInSec").GetInt32());
        Assert.Equal(60, challenge.GetProperty("resendInSec").GetInt32());
        var code = challenge.GetProperty("demoCode").GetString()!;
        Assert.Matches("^[0-9]{4}$", code);
        var sms = Assert.Single(api.Sms.To(phone));
        Assert.Equal($"GreenStore kodunuz: {code}. Kod 5 dəqiqə etibarlıdır. Onu heç kimə deməyin.", sms.Text);
    }

    [Fact]
    public async Task The_sms_is_in_the_language_of_the_request_for_a_new_number()
    {
        var phone = AccountsApi.NewPhone();
        var client = api.Client();
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("ru");

        await api.RequestOtpAsync(client, phone, "register");

        Assert.StartsWith("Код GreenStore: ", Assert.Single(api.Sms.To(phone)).Text);
    }

    [Fact]
    public async Task The_code_is_stored_only_as_its_hmac()
    {
        var phone = AccountsApi.NewPhone();
        var challenge = await api.RequestOtpAsync(api.Client(), phone, "register");
        var id = Guid.Parse(challenge.GetProperty("challengeId").GetString()!);

        await using var db = api.CreateDbContext();
        var row = await db.OtpChallenges.SingleAsync(o => o.Id == id, Ct);

        Assert.Equal(phone, row.Phone);
        Assert.Equal(32, row.CodeHash.Length);
        Assert.True(new ServerHash(ApiFactory.OtpHmacKey).OtpCodeMatches(id, challenge.GetProperty("demoCode").GetString()!, row.CodeHash));
        Assert.Equal(row.CreatedAt.AddMinutes(5), row.ExpiresAt);
        Assert.NotNull(row.IpHash);
    }

    [Fact]
    public async Task The_right_code_verifies_the_challenge_and_may_be_sent_again()
    {
        var challenge = await api.RequestOtpAsync(api.Client(), AccountsApi.NewPhone(), "register");
        var id = challenge.GetProperty("challengeId").GetString()!;
        var code = challenge.GetProperty("demoCode").GetString()!;

        var first = await Verify(api.Client(), id, $" {code} ");
        var again = await Verify(api.Client(), id, code);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Empty(Contract.Check(await JsonAsync(first), "OtpVerifyResult"));
        Assert.True((await JsonAsync(first)).GetProperty("ok").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task A_wrong_code_says_how_many_tries_are_left_and_the_fifth_ends_the_challenge()
    {
        var challenge = await api.RequestOtpAsync(api.Client(), AccountsApi.NewPhone(), "register");
        var id = challenge.GetProperty("challengeId").GetString()!;
        var code = challenge.GetProperty("demoCode").GetString()!;
        var wrong = code == "0000" ? "1111" : "0000";

        for (var left = 4; left >= 1; left--)
        {
            var problem = await ProblemAsync(await Verify(api.Client(), id, wrong), HttpStatusCode.BadRequest, "otp.wrong-code");
            Assert.Equal(left, problem.GetProperty("attemptsLeft").GetInt32());
        }

        var fifth = await ProblemAsync(await Verify(api.Client(), id, "abc"), HttpStatusCode.BadRequest, "otp.too-many-attempts");
        Assert.Equal(0, fifth.GetProperty("attemptsLeft").GetInt32());
        // Even the right code is refused now: a new code must be asked for.
        await ProblemAsync(await Verify(api.Client(), id, code), HttpStatusCode.BadRequest, "otp.too-many-attempts");
    }

    [Fact]
    public async Task A_code_expires_after_5_minutes()
    {
        var challenge = await api.RequestOtpAsync(api.Client(), AccountsApi.NewPhone(), "register");
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        var response = await Verify(api.Client(), challenge.GetProperty("challengeId").GetString()!, challenge.GetProperty("demoCode").GetString()!);

        await ProblemAsync(response, HttpStatusCode.BadRequest, "otp.expired");
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("019a8b4e-0000-7000-8000-000000000001")]
    public async Task An_unknown_challenge_is_expired(string id) =>
        await ProblemAsync(await Verify(api.Client(), id, "1234"), HttpStatusCode.BadRequest, "otp.expired");

    [Fact]
    public async Task Another_code_to_the_same_number_waits_60_seconds()
    {
        var phone = AccountsApi.NewPhone();
        await api.RequestOtpAsync(api.Client(), phone, "register");
        api.Clock.Advance(TimeSpan.FromSeconds(20));

        var response = await Request(api.Client(), phone);

        await ProblemAsync(response, HttpStatusCode.TooManyRequests, "otp.too-soon");
        Assert.Equal(TimeSpan.FromSeconds(40), response.Headers.RetryAfter?.Delta);
        Assert.Single(api.Sms.To(phone));

        api.Clock.Advance(TimeSpan.FromSeconds(40));
        await api.RequestOtpAsync(api.Client(), phone, "register");
        Assert.Equal(2, api.Sms.To(phone).Count);
    }

    [Fact]
    public async Task A_number_gets_5_codes_an_hour_and_10_a_day()
    {
        var phone = AccountsApi.NewPhone();
        for (var i = 0; i < 5; i++)
        {
            await api.RequestOtpAsync(api.Client(), phone, "register");
            api.Clock.Advance(TimeSpan.FromMinutes(2));
        }

        var sixth = await Request(api.Client(), phone);
        await ProblemAsync(sixth, HttpStatusCode.TooManyRequests, "otp.phone-limit");
        // The first of the five was 10 minutes ago: it leaves the hour in 50.
        Assert.Equal(TimeSpan.FromMinutes(50), sixth.Headers.RetryAfter?.Delta);

        api.Clock.Advance(TimeSpan.FromMinutes(51));
        for (var i = 0; i < 5; i++)
        {
            await api.RequestOtpAsync(api.Client(), phone, "register");
            api.Clock.Advance(TimeSpan.FromMinutes(13));
        }

        api.Clock.Advance(TimeSpan.FromMinutes(60));
        await ProblemAsync(await Request(api.Client(), phone), HttpStatusCode.TooManyRequests, "otp.phone-limit");
        Assert.Equal(10, api.Sms.To(phone).Count);

        api.Clock.Advance(TimeSpan.FromDays(1));
        await api.RequestOtpAsync(api.Client(), phone, "register");
    }

    [Fact]
    public async Task A_client_ip_gets_a_limited_number_of_codes()
    {
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Otp:PerIpHourly"] = "3" });
        var ip = AccountsApi.NewIp();
        for (var i = 0; i < 3; i++)
        {
            await api.RequestOtpAsync(api.Client(ip: ip, factory: factory), AccountsApi.NewPhone(), "register");
        }

        var phone = AccountsApi.NewPhone();
        var response = await Request(api.Client(ip: ip, factory: factory), phone);

        await ProblemAsync(response, HttpStatusCode.TooManyRequests, "otp.ip-limit");
        Assert.NotNull(response.Headers.RetryAfter);
        Assert.Empty(api.Sms.To(phone));
        // Another visitor is not affected.
        await api.RequestOtpAsync(api.Client(factory: factory), phone, "register");
    }

    [Fact]
    public async Task Parallel_requests_from_one_ip_do_not_pass_its_limit_together()
    {
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Otp:PerIpHourly"] = "3" });
        var ip = AccountsApi.NewIp();
        var phones = Enumerable.Range(0, 8).Select(_ => AccountsApi.NewPhone()).ToList();

        var responses = await Task.WhenAll(phones.Select(phone => Request(api.Client(ip: ip, factory: factory), phone)));

        Assert.Equal(3, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(5, responses.Count(r => r.StatusCode == HttpStatusCode.TooManyRequests));
        Assert.Equal(3, phones.Sum(phone => api.Sms.To(phone).Count));
    }

    [Fact]
    public async Task The_platform_stops_sending_at_its_daily_cap_and_logs_an_error()
    {
        // A day after every other test's codes, so the cap counts only these.
        api.Clock.Advance(TimeSpan.FromDays(2));
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Otp:GlobalDailyCap"] = "2" });
        await api.RequestOtpAsync(api.Client(factory: factory), AccountsApi.NewPhone(), "register");
        await api.RequestOtpAsync(api.Client(factory: factory), AccountsApi.NewPhone(), "register");

        var phone = AccountsApi.NewPhone();
        var response = await Request(api.Client(factory: factory), phone);

        await ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "otp.unavailable");
        Assert.Empty(api.Sms.To(phone));
        Assert.Contains(api.Log.Messages, m => m.Level == LogLevel.Error && m.Message.Contains("Otp:GlobalDailyCap reached", StringComparison.Ordinal));
        Assert.Contains(api.Log.Messages, m => m.Level == LogLevel.Warning && m.Message.Contains("80% of Otp:GlobalDailyCap", StringComparison.Ordinal));
        api.Clock.Advance(TimeSpan.FromDays(2));
    }

    [Fact]
    public async Task A_failed_sms_is_a_503_and_does_not_count()
    {
        var phone = AccountsApi.NewPhone();
        await using (var down = api.Variant(sms: new FailingSmsSender()))
        {
            await ProblemAsync(await Request(api.Client(factory: down), phone), HttpStatusCode.ServiceUnavailable, "otp.unavailable");
        }

        await using var db = api.CreateDbContext();
        Assert.False(await db.OtpChallenges.AnyAsync(o => o.Phone == phone, Ct));
        // No 60-second wait: nothing was sent.
        await api.RequestOtpAsync(api.Client(), phone, "register");
    }

    [Theory]
    [InlineData("+994124405060", "not-mobile")]
    [InlineData("+994225551234", "not-mobile")]
    [InlineData("50555", "invalid")]
    [InlineData("+7 916 555 12 34", "invalid")]
    [InlineData("", "required")]
    public async Task Codes_go_to_azerbaijani_mobile_numbers_only(string phone, string error)
    {
        var problem = await ProblemAsync(await Request(api.Client(), phone), HttpStatusCode.BadRequest, "validation");

        Assert.Equal(error, problem.GetProperty("errors").GetProperty("phone")[0].GetString());
    }

    [Fact]
    public async Task Any_common_shape_of_the_number_works()
    {
        var phone = AccountsApi.NewPhone();
        var local = $"0{phone[4..6]} {phone[6..9]} {phone[9..11]} {phone[11..]}";

        await api.RequestOtpAsync(api.Client(), local, "register");

        Assert.Single(api.Sms.To(phone));
    }

    [Theory]
    [InlineData("""{ "phone": "+994551234567", "purpose": "signup" }""")]
    [InlineData("""{ "phone": "+994551234567" }""")]
    [InlineData("""{ "phone": 994551234567, "purpose": "login" }""")]
    public async Task A_body_outside_the_contract_is_a_bad_request(string json)
    {
        var response = await api.Client().PostAsync("/api/v1/auth/otp", new StringContent(json, System.Text.Encoding.UTF8, "application/json"), Ct);

        await ProblemAsync(response, HttpStatusCode.BadRequest, "bad-request");
    }

    [Fact]
    public async Task Registering_a_number_that_has_an_account_is_refused_without_an_sms()
    {
        var account = await api.RegisterAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(2));

        await ProblemAsync(await Request(api.Client(), account.Phone, "register"), HttpStatusCode.Conflict, "account.phone-taken");

        Assert.Single(api.Sms.To(account.Phone));
    }

    [Theory]
    [InlineData("login")]
    [InlineData("reset-password")]
    public async Task Signing_in_or_resetting_needs_an_account_with_the_number(string purpose)
    {
        var phone = AccountsApi.NewPhone();

        await ProblemAsync(await Request(api.Client(), phone, purpose), HttpStatusCode.NotFound, "account.not-found");

        Assert.Empty(api.Sms.To(phone));
    }

    [Fact]
    public async Task A_code_for_a_new_phone_number_needs_a_signed_in_user()
    {
        await ProblemAsync(await Request(api.Client(), AccountsApi.NewPhone(), "change-phone"), HttpStatusCode.Unauthorized, "unauthorized");

        var account = await api.RegisterAsync();
        await api.RequestOtpAsync(api.Client(account.Token), AccountsApi.NewPhone(), "change-phone");
        var other = await api.RegisterAsync();
        await ProblemAsync(await Request(api.Client(account.Token), other.Phone, "change-phone"), HttpStatusCode.Conflict, "account.phone-taken");
    }

    [Fact]
    public async Task Without_demo_codes_the_challenge_has_none_but_the_sms_goes_out()
    {
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Otp:ExposeDemoCode"] = "false" });
        var phone = AccountsApi.NewPhone();

        var challenge = await api.RequestOtpAsync(api.Client(factory: factory), phone, "register");

        Assert.False(challenge.TryGetProperty("demoCode", out _));
        var sms = Assert.Single(api.Sms.To(phone));
        Assert.Matches("kodunuz: [0-9]{4}\\.", sms.Text);
    }
}
