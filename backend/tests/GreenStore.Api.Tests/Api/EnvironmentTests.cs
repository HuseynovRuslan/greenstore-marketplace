using System.Net;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Sms;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Api;

public sealed class EnvironmentTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("Development")]
    [InlineData("Staging")]
    public async Task OpenApi_document_is_served_in_development_and_staging(string environment)
    {
        await using var factory = api.With(environment);

        var response = await factory.CreateClient().GetAsync("/openapi/v1.json", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await JsonAsync(response);
        Assert.StartsWith("3.", document.GetProperty("openapi").GetString());
        Assert.Equal("GreenStore API", document.GetProperty("info").GetProperty("title").GetString());
    }

    [Fact]
    public async Task OpenApi_document_describes_the_accounts_endpoints()
    {
        await using var factory = api.With("Development");

        var document = await JsonAsync(await factory.CreateClient().GetAsync("/openapi/v1.json", Ct));

        var paths = document.GetProperty("paths").EnumerateObject().Select(p => p.Name).ToList();
        foreach (var path in new[]
        {
            "/api/v1/auth/otp", "/api/v1/auth/otp/verify", "/api/v1/auth/login", "/api/v1/auth/login/otp", "/api/v1/auth/logout",
            "/api/v1/accounts", "/api/v1/accounts/password-reset", "/api/v1/me", "/api/v1/me/password", "/api/v1/me/phone",
            "/api/v1/me/sessions", "/api/v1/me/sessions/{id}", "/api/v1/me/seller", "/api/v1/me/favorites", "/api/v1/me/favorites/items",
            "/api/v1/me/favorites/{kind}/{id}", "/api/v1/me/favorites/merge", "/api/v1/me/saved-searches",
            "/api/v1/me/saved-searches/{id}", "/api/v1/me/saved-searches/{id}/opened",
        })
        {
            Assert.Contains(path, paths);
        }
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Testing")]
    public async Task OpenApi_document_is_not_served_elsewhere(string environment)
    {
        await using var factory = api.With(environment);

        var response = await factory.CreateClient().GetAsync("/openapi/v1.json", Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public void The_api_validates_its_settings_on_start()
    {
        // The registrations the startup tests below exercise on a bare host are the ones Program.cs uses.
        Assert.NotNull(api.Services.GetService<IStartupValidator>());
        Assert.NotEmpty(api.Services.GetServices<IValidateOptions<OtpOptions>>());
        Assert.NotEmpty(api.Services.GetServices<IValidateOptions<DatabaseOptions>>());
    }

    [Fact]
    public async Task Development_refuses_to_start_without_a_connection_string()
    {
        // The whole API: Development fails in its startup migration, before the host starts.
        await using var factory = api.With("Development", new Dictionary<string, string?> { ["ConnectionStrings:Default"] = "" });

        var error = Record.Exception(() => factory.CreateClient());

        var validation = Assert.IsType<OptionsValidationException>(error);
        Assert.Contains("ConnectionStrings:Default is not set", validation.Message);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    [InlineData("Testing")]
    public async Task Other_environments_refuse_to_start_without_a_connection_string(string environment)
    {
        // appsettings.json commits an empty one; Production gets it from ConnectionStrings__Default.
        var error = await StartAsync(environment, new() { ["ConnectionStrings:Default"] = "" });

        var validation = Assert.IsType<OptionsValidationException>(error);
        Assert.Contains("ConnectionStrings:Default is not set", validation.Message);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task Hosts_on_the_internet_refuse_to_start_with_demo_codes_on(string environment)
    {
        var error = await StartAsync(environment, new() { ["Otp:ExposeDemoCode"] = "true" });

        var validation = Assert.IsType<OptionsValidationException>(error);
        Assert.Contains("Otp:ExposeDemoCode must be false outside Development", validation.Message);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    [InlineData("Testing")]
    public async Task Every_environment_refuses_to_start_without_an_otp_key(string environment)
    {
        var error = await StartAsync(environment, new() { ["Otp:HmacKey"] = "" });

        Assert.Contains("Otp:HmacKey is not set", Assert.IsType<OptionsValidationException>(error).Message);
    }

    [Fact]
    public async Task Production_refuses_a_short_otp_key()
    {
        var error = await StartAsync("Production", new() { ["Otp:HmacKey"] = "short-key" });

        Assert.Contains("at least 32 characters", Assert.IsType<OptionsValidationException>(error).Message);
        Assert.Null(await StartAsync("Staging", new() { ["Otp:HmacKey"] = "short-key" }));
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public async Task Hosts_on_the_internet_refuse_to_start_with_the_dev_accounts_seed(string environment)
    {
        var error = await StartAsync(environment, new() { ["Seed:DevAccounts"] = "true" });

        Assert.Contains("Seed:DevAccounts must be false outside Development", Assert.IsType<OptionsValidationException>(error).Message);
        Assert.Null(await StartAsync("Development", new() { ["Seed:DevAccounts"] = "true" }));
        Assert.Null(await StartAsync("Testing", new() { ["Seed:DevAccounts"] = "true" }));
    }

    [Theory]
    [InlineData("Otp:MaxAttempts", "6")]
    [InlineData("Otp:CodeLength", "3")]
    [InlineData("Otp:PerPhoneHourly", "0")]
    [InlineData("Otp:GlobalDailyCap", "0")]
    public async Task Otp_settings_outside_their_range_are_refused(string key, string value)
    {
        var error = await StartAsync("Development", new() { [key] = value });

        Assert.IsType<OptionsValidationException>(error);
    }

    [Fact]
    public async Task An_unknown_sms_provider_is_refused()
    {
        var error = await StartAsync("Production", new() { ["Sms:Provider"] = "acme" });

        Assert.Contains("Sms:Provider must be one of: log", Assert.IsType<OptionsValidationException>(error).Message);
    }

    [Fact]
    public async Task Outside_development_the_log_sms_sender_warns_at_startup()
    {
        var log = new CapturingLoggerProvider();
        await using var factory = api.WithWebHostBuilder(builder => builder.ConfigureServices(s => s.AddSingleton<Microsoft.Extensions.Logging.ILoggerProvider>(log)));

        Assert.Equal(HttpStatusCode.OK, (await factory.CreateClient().GetAsync("/health/live", Ct)).StatusCode);

        Assert.Contains(log.Messages, m => m.Message.Contains("SMS codes are written to the log", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Testing")]
    public async Task Demo_codes_are_allowed_on_a_developer_machine_and_in_tests(string environment) =>
        Assert.Null(await StartAsync(environment, new() { ["Otp:ExposeDemoCode"] = "true" }));

    [Fact]
    public async Task Production_starts_with_the_committed_settings()
    {
        // Plus the connection string, which Production always gets from the environment.
        await using var factory = api.With("Production");

        var response = await factory.CreateClient().GetAsync("/health/ready", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>
    /// Starts a bare host with the API's settings registrations, where the startup validation lives, and returns what
    /// the start threw. Not the whole API: when the host's own start fails, Program's <c>app.Run()</c> disposes the host
    /// while WebApplicationFactory still reads its services, so a factory reports ObjectDisposedException at random
    /// instead of the validation error. (Development fails earlier, before <c>app.Run()</c>, and is tested whole.)
    /// </summary>
    private static async Task<Exception?> StartAsync(string environment, Dictionary<string, string?> settings)
    {
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            EnvironmentName = environment,
            DisableDefaults = true,
        });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            // Never opened: validation needs only a value.
            ["ConnectionStrings:Default"] = "Host=localhost;Database=unused",
            ["Otp:HmacKey"] = ApiFactory.OtpHmacKey,
        });
        builder.Configuration.AddInMemoryCollection(settings);
        builder.Services.AddAppSettings();
        builder.Services.AddDatabase();
        builder.Services.AddSms();

        using var host = builder.Build();
        var error = await Record.ExceptionAsync(() => host.StartAsync(Ct));
        if (error is null)
        {
            await host.StopAsync(Ct);
        }

        return error;
    }
}
