using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Accounts;

/// <summary>Bearer sessions: who is signed in, sliding expiry, «Aktiv cihazlar», signing out and revocation.</summary>
[Collection(AccountsCollection.Name)]
public sealed class SessionTests(AccountsApi api)
{
    private async Task<string> SignInAgainAsync(Account account)
    {
        var response = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("session").GetProperty("token").GetString()!;
    }

    private async Task AssertSignedOutAsync(string token)
    {
        var response = await api.Client(token).GetAsync("/api/v1/me", Ct);
        await ProblemAsync(response, HttpStatusCode.Unauthorized, "unauthorized");
    }

    [Fact]
    public async Task Without_a_session_me_is_a_401_with_a_bearer_challenge()
    {
        var response = await api.Client().GetAsync("/api/v1/me", Ct);

        await ProblemAsync(response, HttpStatusCode.Unauthorized, "unauthorized");
        Assert.Equal("Bearer", response.Headers.WwwAuthenticate.Single().Scheme);
    }

    [Theory]
    [InlineData("Bearer not-a-token")]
    [InlineData("Bearer AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    [InlineData("Basic dXNlcjpwYXNz")]
    [InlineData("Bearer ")]
    public async Task A_wrong_token_is_not_a_session(string header)
    {
        var client = api.Client();
        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", header);

        await ProblemAsync(await client.GetAsync("/api/v1/me", Ct), HttpStatusCode.Unauthorized, "unauthorized");
        // Public endpoints do not care: a stale cookie never breaks a page.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/cities", Ct)).StatusCode);
    }

    [Fact]
    public async Task The_token_is_never_stored_and_the_session_knows_its_account()
    {
        var account = await api.RegisterAsync();

        await using var db = api.CreateDbContext();
        var session = await db.Sessions.SingleAsync(s => s.Id == Guid.Parse(account.SessionId), Ct);
        Assert.Equal(account.Id, session.UserId);
        Assert.Equal(GreenStore.Api.Modules.Accounts.SessionTokens.Hash(account.Token), session.TokenHash);
        Assert.False(await db.Sessions.AnyAsync(s => s.DeviceName == account.Token, Ct));
    }

    [Fact]
    public async Task Signing_out_ends_the_session()
    {
        var account = await api.RegisterAsync();

        var response = await api.Client(account.Token).PostAsync("/api/v1/auth/logout", null, Ct);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await AssertSignedOutAsync(account.Token);
        // Again, or without any session: nothing to do, still 204.
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(account.Token).PostAsync("/api/v1/auth/logout", null, Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client().PostAsync("/api/v1/auth/logout", null, Ct)).StatusCode);
    }

    [Fact]
    public async Task A_session_used_within_30_days_keeps_going()
    {
        var account = await api.RegisterAsync();

        for (var i = 0; i < 3; i++)
        {
            api.Clock.Advance(TimeSpan.FromDays(29));
            await api.GetAsync("/api/v1/me", account.Token);
        }

        await using var db = api.CreateDbContext();
        var session = await db.Sessions.SingleAsync(s => s.Id == Guid.Parse(account.SessionId), Ct);
        Assert.Equal(api.Clock.GetUtcNow(), session.LastSeenAt);
        Assert.Equal(api.Clock.GetUtcNow().AddDays(30), session.ExpiresAt);
    }

    [Fact]
    public async Task A_session_unused_for_30_days_expires()
    {
        var account = await api.RegisterAsync();

        api.Clock.Advance(TimeSpan.FromDays(30));

        await AssertSignedOutAsync(account.Token);
    }

    [Fact]
    public async Task A_use_is_written_at_most_every_5_minutes()
    {
        var account = await api.RegisterAsync();
        var created = api.Clock.GetUtcNow();
        async Task<DateTimeOffset> LastSeenAsync()
        {
            await using var db = api.CreateDbContext();
            return (await db.Sessions.SingleAsync(s => s.Id == Guid.Parse(account.SessionId), Ct)).LastSeenAt;
        }

        api.Clock.Advance(TimeSpan.FromMinutes(4));
        await api.GetAsync("/api/v1/me", account.Token);
        Assert.Equal(created, await LastSeenAsync());

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        await api.GetAsync("/api/v1/me", account.Token);
        Assert.Equal(created.AddMinutes(5), await LastSeenAsync());
    }

    [Fact]
    public async Task The_active_devices_are_listed_and_one_can_be_signed_out()
    {
        var account = await api.RegisterAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var laptop = await SignInAgainAsync(account);

        var sessions = await api.GetAsync("/api/v1/me/sessions", laptop);

        Assert.Equal(2, sessions.GetArrayLength());
        var current = sessions.EnumerateArray().Single(s => s.GetProperty("current").GetBoolean());
        var other = sessions.EnumerateArray().Single(s => !s.GetProperty("current").GetBoolean());
        Assert.Equal(account.SessionId, other.GetProperty("id").GetString());
        // The most recently used first.
        Assert.Equal(current.GetProperty("id").GetString(), sessions[0].GetProperty("id").GetString());
        Assert.Empty(FrontendContract.Load().Check(
            sessions,
            "Array<{ id: string; client: 'web' | 'ios' | 'android'; deviceName?: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean }>"));

        var revoke = await api.Client(laptop).DeleteAsync($"/api/v1/me/sessions/{account.SessionId}", Ct);

        Assert.Equal(HttpStatusCode.NoContent, revoke.StatusCode);
        await AssertSignedOutAsync(account.Token);
        await api.GetAsync("/api/v1/me", laptop);
        Assert.Single((await api.GetAsync("/api/v1/me/sessions", laptop)).EnumerateArray());
        await ProblemAsync(await api.Client(laptop).DeleteAsync($"/api/v1/me/sessions/{account.SessionId}", Ct), HttpStatusCode.NotFound, "session.not-found");
    }

    [Fact]
    public async Task Another_users_session_cannot_be_signed_out()
    {
        var mine = await api.RegisterAsync();
        var theirs = await api.RegisterAsync();

        var response = await api.Client(mine.Token).DeleteAsync($"/api/v1/me/sessions/{theirs.SessionId}", Ct);

        await ProblemAsync(response, HttpStatusCode.NotFound, "session.not-found");
        await api.GetAsync("/api/v1/me", theirs.Token);
    }

    [Fact]
    public async Task Signing_out_the_current_device_from_the_list_is_signing_out()
    {
        var account = await api.RegisterAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(account.Token).DeleteAsync($"/api/v1/me/sessions/{account.SessionId}", Ct)).StatusCode);

        await AssertSignedOutAsync(account.Token);
    }

    [Fact]
    public async Task A_password_change_signs_out_the_other_devices_only()
    {
        var account = await api.RegisterAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var other = await SignInAgainAsync(account);

        var response = await api.Client(account.Token).PostAsJsonAsync("/api/v1/me/password", new { current = account.Password, next = "Yeni-sifre-7" }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await JsonAsync(response)).GetProperty("ok").GetBoolean());
        await api.GetAsync("/api/v1/me", account.Token);
        await AssertSignedOutAsync(other);
    }

    [Fact]
    public async Task A_password_reset_signs_out_every_device()
    {
        var account = await api.RegisterAsync();
        var client = api.Client();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var challengeId = await api.VerifiedChallengeAsync(client, account.Phone, "reset-password");

        var response = await client.PostAsJsonAsync("/api/v1/accounts/password-reset", new { otpChallengeId = challengeId, password = "Yeni-sifre-8" }, Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await JsonAsync(response)).GetProperty("ok").GetBoolean());
        await AssertSignedOutAsync(account.Token);
        var old = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        await ProblemAsync(old, HttpStatusCode.Unauthorized, "auth.wrong-credentials");
        var fresh = await api.Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = "Yeni-sifre-8" }, Ct);
        Assert.Equal(HttpStatusCode.OK, fresh.StatusCode);
        // The proof is used up.
        var again = await client.PostAsJsonAsync("/api/v1/accounts/password-reset", new { otpChallengeId = challengeId, password = "Yeni-sifre-9" }, Ct);
        await ProblemAsync(again, HttpStatusCode.BadRequest, "otp.not-verified");
    }

    [Fact]
    public async Task A_reset_needs_a_good_password()
    {
        var account = await api.RegisterAsync();
        var client = api.Client();
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var challengeId = await api.VerifiedChallengeAsync(client, account.Phone, "reset-password");

        var response = await client.PostAsJsonAsync("/api/v1/accounts/password-reset", new { otpChallengeId = challengeId, password = "short1" }, Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.BadRequest, "validation");
        Assert.Equal("too-short", problem.GetProperty("errors").GetProperty("password")[0].GetString());
        await api.GetAsync("/api/v1/me", account.Token);
    }

    [Fact]
    public async Task The_bearer_scheme_is_case_insensitive()
    {
        var account = await api.RegisterAsync();
        var client = api.Client();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("bearer", account.Token);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/me", Ct)).StatusCode);
    }
}
