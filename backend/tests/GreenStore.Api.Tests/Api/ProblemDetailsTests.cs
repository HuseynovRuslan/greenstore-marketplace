using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

public sealed class ProblemDetailsTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    private const string Test = TestEndpoints.Prefix;

    [Fact]
    public async Task Unknown_api_route_is_a_404_problem()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/does-not-exist", Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.NotFound, "not-found");
        Assert.Equal("/api/v1/does-not-exist", problem.GetProperty("instance").GetString());
        Assert.False(problem.TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task Not_found_thrown_by_an_endpoint_keeps_its_own_code()
    {
        var response = await api.CreateClient().GetAsync($"{Test}/missing", Ct);

        await ProblemAsync(response, HttpStatusCode.NotFound, "listing.not-found");
    }

    [Fact]
    public async Task Unexpected_exception_is_a_500_without_internals()
    {
        var response = await api.CreateClient().GetAsync($"{Test}/throw", Ct);

        await ProblemAsync(response, HttpStatusCode.InternalServerError, "internal-error");
        var body = await response.Content.ReadAsStringAsync(Ct);
        Assert.DoesNotContain("secret internal detail", body);
        Assert.DoesNotContain("InvalidOperationException", body);
    }

    [Fact]
    public async Task Business_rule_failure_keeps_its_own_code()
    {
        var response = await api.CreateClient().GetAsync($"{Test}/problem", Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.Conflict, "listing.not-editable");
        Assert.Equal("Only the owner can edit.", problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Validation_failure_lists_error_codes_per_field()
    {
        var response = await api.CreateClient().GetAsync($"{Test}/validation", Ct);

        var problem = await ProblemAsync(response, HttpStatusCode.BadRequest, "validation");
        var errors = problem.GetProperty("errors");
        Assert.Equal(["phone.invalid"], errors.GetProperty("contactPhone").EnumerateArray().Select(e => e.GetString()));
        Assert.Equal(["too-short", "required"], errors.GetProperty("title").EnumerateArray().Select(e => e.GetString()));
    }

    [Fact]
    public async Task Stale_row_version_is_a_409_concurrency_conflict()
    {
        var response = await api.CreateClient().GetAsync($"{Test}/concurrency", Ct);

        await ProblemAsync(response, HttpStatusCode.Conflict, "concurrency-conflict");
    }

    [Theory]
    [InlineData(400, "bad-request")]
    [InlineData(401, "unauthorized")]
    [InlineData(403, "forbidden")]
    [InlineData(404, "not-found")]
    [InlineData(409, "conflict")]
    [InlineData(503, "unavailable")]
    public async Task Empty_error_responses_become_problems(int status, string code)
    {
        var response = await api.CreateClient().GetAsync($"{Test}/status/{status}", Ct);

        await ProblemAsync(response, (HttpStatusCode)status, code);
    }

    [Theory]
    [InlineData(400, "https://tools.ietf.org/html/rfc9110#section-15.5.1")]
    [InlineData(404, "https://tools.ietf.org/html/rfc9110#section-15.5.5")]
    [InlineData(413, "https://tools.ietf.org/html/rfc9110#section-15.5.14")]
    [InlineData(423, "https://tools.ietf.org/html/rfc4918#section-11.3")]
    [InlineData(429, "https://tools.ietf.org/html/rfc6585#section-4")]
    [InlineData(503, "https://tools.ietf.org/html/rfc9110#section-15.6.4")]
    public async Task Every_problem_type_links_to_the_definition_of_its_status(int status, string type)
    {
        var response = await api.CreateClient().GetAsync($"{Test}/status/{status}", Ct);

        var problem = await JsonAsync(response);
        Assert.Equal(status, (int)response.StatusCode);
        Assert.Equal(type, problem.GetProperty("type").GetString());
    }

    [Fact]
    public async Task Wrong_method_is_a_405_problem()
    {
        var response = await api.CreateClient().PostAsync($"{Test}/language", new StringContent("{}", Encoding.UTF8, "application/json"), Ct);

        await ProblemAsync(response, HttpStatusCode.MethodNotAllowed, "method-not-allowed");
    }

    [Fact]
    public async Task Malformed_json_body_is_a_400_problem()
    {
        var response = await api.CreateClient().PostAsync($"{Test}/echo", new StringContent("{ not json", Encoding.UTF8, "application/json"), Ct);

        await ProblemAsync(response, HttpStatusCode.BadRequest, "bad-request");
    }

    public static TheoryData<string, HttpStatusCode, string> Errors => new()
    {
        { "/api/v1/does-not-exist", HttpStatusCode.NotFound, "not-found" },
        { $"{Test}/missing", HttpStatusCode.NotFound, "listing.not-found" },
        { $"{Test}/problem", HttpStatusCode.Conflict, "listing.not-editable" },
        { $"{Test}/validation", HttpStatusCode.BadRequest, "validation" },
        { $"{Test}/throw", HttpStatusCode.InternalServerError, "internal-error" },
        { $"{Test}/status/403", HttpStatusCode.Forbidden, "forbidden" },
    };

    [Theory]
    [MemberData(nameof(Errors))]
    public async Task Errors_are_the_same_problem_json_whatever_the_client_accepts(string path, HttpStatusCode status, string code)
    {
        var expected = MaskTraceId(await ProblemAsync(await GetAsync(path, "application/json"), status, code));

        // A crawler asking for HTML, an XML client, a client that lists neither JSON nor */*.
        foreach (var accept in new[] { "text/html", "application/xml", "text/plain, image/png" })
        {
            var problem = await ProblemAsync(await GetAsync(path, accept), status, code);
            Assert.Equal(expected, MaskTraceId(problem));
        }
    }

    private async Task<HttpResponseMessage> GetAsync(string path, string accept)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.TryAddWithoutValidation("Accept", accept);
        return await api.CreateClient().SendAsync(request, Ct);
    }

    /// <summary>The body as text with the per-request trace id replaced (its position stays, so key order counts).</summary>
    private static string MaskTraceId(JsonElement problem)
    {
        var json = JsonNode.Parse(problem.GetRawText())!.AsObject();
        Assert.True(json.ContainsKey("traceId"));
        json["traceId"] = "*";
        return json.ToJsonString();
    }
}
