using System.Net;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

public sealed class HealthTests(ApiFactory api, PostgresDatabase database) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Live_answers_without_checking_dependencies()
    {
        var response = await api.CreateClient().GetAsync("/health/live", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"status":"healthy","checks":{}}""", await response.Content.ReadAsStringAsync(Ct));
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Ready_checks_the_database()
    {
        var response = await api.CreateClient().GetAsync("/health/ready", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("""{"status":"healthy","checks":{"database":"healthy"}}""", await response.Content.ReadAsStringAsync(Ct));
    }

    [Fact]
    public async Task Ready_is_503_when_the_database_is_unreachable()
    {
        await using var down = api.With(settings: new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2",
        });

        var response = await down.CreateClient().GetAsync("/health/ready", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("""{"status":"unhealthy","checks":{"database":"unhealthy"}}""", await response.Content.ReadAsStringAsync(Ct));
        // Live stays green: the process itself is fine.
        Assert.Equal(HttpStatusCode.OK, (await down.CreateClient().GetAsync("/health/live", Ct)).StatusCode);
    }

    [Fact]
    public async Task Ready_is_503_while_migrations_are_pending()
    {
        // The server's maintenance database has never been migrated: it has no migration history table at all.
        var log = new ErrorLog();
        await using var behind = api.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = database.ServerConnectionString,
            }));
            builder.ConfigureLogging(logging => logging.AddProvider(log));
        });

        var response = await behind.CreateClient().GetAsync("/health/ready", Ct);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("""{"status":"unhealthy","checks":{"database":"unhealthy"}}""", await response.Content.ReadAsStringAsync(Ct));
        // Not EF's failed read of the missing table on every probe: a brand-new database is routine before the first
        // deploy's migrate step. (The health check service still logs the unhealthy result itself.)
        Assert.DoesNotContain(log.Errors, e => e.Category.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("/health/live")]
    [InlineData("/health/ready")]
    public async Task Probes_answer_get_and_head_only(string path)
    {
        var client = api.CreateClient();

        using var head = new HttpRequestMessage(HttpMethod.Head, path);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(head, Ct)).StatusCode);

        await ProblemAsync(await client.PostAsync(path, null, Ct), HttpStatusCode.MethodNotAllowed, "method-not-allowed");
        await ProblemAsync(await client.DeleteAsync(path, Ct), HttpStatusCode.MethodNotAllowed, "method-not-allowed");
    }

    [Fact]
    public async Task Health_endpoints_are_not_under_the_api_prefix_and_carry_no_language()
    {
        var response = await api.CreateClient().GetAsync("/health/live", Ct);
        Assert.False(response.Content.Headers.Contains("Content-Language"));
    }
}
