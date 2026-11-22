using System.Net;
using System.Net.Http.Json;
using System.Text;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Infrastructure.Samples;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

public sealed class LanguageHeaderTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private async Task<HttpResponseMessage> GetAsync(string path, string? acceptLanguage)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (acceptLanguage is not null)
        {
            request.Headers.TryAddWithoutValidation("Accept-Language", acceptLanguage);
        }

        return await api.CreateClient().SendAsync(request, Ct);
    }

    [Theory]
    [InlineData(null, "az")]
    [InlineData("ru-RU,ru;q=0.9,en;q=0.8", "ru")]
    [InlineData("en-GB", "en")]
    [InlineData("de-DE,fr;q=0.8", "az")]
    public async Task Request_language_comes_from_Accept_Language(string? header, string expected)
    {
        var response = await GetAsync($"{TestEndpoints.Prefix}/language", header);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal($$"""{"language":"{{expected}}"}""", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal([expected], response.Content.Headers.ContentLanguage);
        Assert.Contains("Accept-Language", response.Headers.Vary);
    }

    [Fact]
    public async Task Error_responses_say_their_language_too()
    {
        var response = await GetAsync("/api/v1/does-not-exist", "en");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(["en"], response.Content.Headers.ContentLanguage);
        Assert.Contains("Accept-Language", response.Headers.Vary);
    }
}

public sealed class ClientIpTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private async Task<ClientIpDto> GetAsync(string? clientIp, string? key)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{TestEndpoints.Prefix}/client-ip");
        if (clientIp is not null)
        {
            request.Headers.Add(ClientIpResolver.ClientIpHeader, clientIp);
        }

        if (key is not null)
        {
            request.Headers.Add(ClientIpResolver.InternalKeyHeader, key);
        }

        var response = await api.CreateClient().SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ClientIpDto>(Ct))!;
    }

    [Fact]
    public async Task X_Client_IP_counts_with_the_internal_key() =>
        Assert.Equal(new ClientIpDto("203.0.113.7", true), await GetAsync("203.0.113.7", ApiFactory.InternalKey));

    [Fact]
    public async Task X_Client_IP_is_ignored_with_a_wrong_key() =>
        Assert.Equal(new ClientIpDto(null, false), await GetAsync("203.0.113.7", "guess"));

    [Fact]
    public async Task X_Client_IP_is_ignored_without_a_key() =>
        Assert.Equal(new ClientIpDto(null, false), await GetAsync("203.0.113.7", null));
}

public sealed class JsonContractTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string SampleJson =
        """{"id":"019a8b4e-0000-7000-8000-000000000001","title":"Zeytun ağacı","rootSystem":"bare-root","businessKind":"garden-centre","packageId":"one-cixar","status":"active","priceUnit":"sqm","publishedAt":"2026-10-28T06:15:00Z","stock":12,"name":{"az":"Güllər","ru":"Розы"}}""";

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    [Fact]
    public async Task Responses_use_camel_case_kebab_case_enums_utc_dates_and_no_nulls()
    {
        var response = await api.CreateClient().GetAsync($"{TestEndpoints.Prefix}/sample", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(SampleJson, await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Request_bodies_are_read_with_the_same_rules()
    {
        var response = await api.CreateClient().PostAsync($"{TestEndpoints.Prefix}/echo", Json(SampleJson), Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(SampleJson, await response.Content.ReadAsStringAsync(Ct));
    }

    [Theory]
    [InlineData("\"rootSystem\":\"bare-root\"", "\"rootSystem\":2")]
    [InlineData("\"rootSystem\":\"bare-root\"", "\"rootSystem\":\"tree\"")]
    [InlineData("\"stock\":12", "\"stock\":\"12\"")]
    [InlineData("\"title\":\"Zeytun ağacı\",", "")]
    [InlineData("\"title\":\"Zeytun ağacı\"", "\"title\":null")]
    [InlineData("{\"az\":\"Güllər\",\"ru\":\"Розы\"}", "{\"ru\":\"Розы\"}")]
    [InlineData("\"publishedAt\":\"2026-10-28T06:15:00Z\"", "\"publishedAt\":\"28.10.2026\"")]
    public async Task Bodies_that_break_the_contract_are_rejected(string part, string replacement)
    {
        var json = SampleJson.Replace(part, replacement, StringComparison.Ordinal);
        Assert.NotEqual(SampleJson, json);

        var response = await api.CreateClient().PostAsync($"{TestEndpoints.Prefix}/echo", Json(json), Ct);

        await ProblemAsync(response, HttpStatusCode.BadRequest, "bad-request");
    }
}

public sealed class RateLimitTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private async Task<HttpResponseMessage> PostAsync(string clientIp, string? accept = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{TestEndpoints.Prefix}/limited");
        request.Headers.Add(ClientIpResolver.ClientIpHeader, clientIp);
        request.Headers.Add(ClientIpResolver.InternalKeyHeader, ApiFactory.InternalKey);
        if (accept is not null)
        {
            request.Headers.TryAddWithoutValidation("Accept", accept);
        }

        return await api.CreateClient().SendAsync(request, Ct);
    }

    [Fact]
    public async Task Anonymous_writes_get_a_429_problem_with_Retry_After_per_client_ip()
    {
        for (var i = 0; i < ApiFactory.AnonymousWritesPermitLimit; i++)
        {
            Assert.Equal(HttpStatusCode.NoContent, (await PostAsync("198.51.100.20")).StatusCode);
        }

        var rejected = await PostAsync("198.51.100.20");
        await ProblemAsync(rejected, HttpStatusCode.TooManyRequests, "rate-limited");
        Assert.NotNull(rejected.Headers.RetryAfter?.Delta);
        Assert.True(rejected.Headers.RetryAfter!.Delta > TimeSpan.Zero);

        // Another visitor behind the same Next.js server is not affected.
        Assert.Equal(HttpStatusCode.NoContent, (await PostAsync("198.51.100.21")).StatusCode);
    }

    [Fact]
    public async Task The_429_is_problem_json_for_clients_that_do_not_ask_for_json()
    {
        for (var i = 0; i < ApiFactory.AnonymousWritesPermitLimit; i++)
        {
            Assert.Equal(HttpStatusCode.NoContent, (await PostAsync("198.51.100.30", "text/html")).StatusCode);
        }

        await ProblemAsync(await PostAsync("198.51.100.30", "text/html"), HttpStatusCode.TooManyRequests, "rate-limited");
    }
}
