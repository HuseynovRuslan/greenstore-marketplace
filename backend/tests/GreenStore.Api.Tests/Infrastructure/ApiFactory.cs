using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// The real API (Program.cs) on an in-memory server, against the test run's database. Environment "Testing" (no
/// automatic migrations, no OpenAPI); the test-only endpoints of <see cref="TestEndpoints"/> are mapped into the real
/// /api/v1 group. Tests that need another environment or setting use <see cref="With"/>.
/// </summary>
public sealed class ApiFactory(PostgresDatabase database) : WebApplicationFactory<Program>
{
    public const string InternalKey = "test-internal-key";

    /// <summary>Long enough for Production's rule (32 characters), so environment tests can start Production too.</summary>
    public const string OtpHmacKey = "test-otp-hmac-key-0123456789abcdef";
    public const int AnonymousWritesPermitLimit = 2;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = database.ConnectionString,
            ["Internal:ApiKey"] = InternalKey,
            ["Otp:HmacKey"] = OtpHmacKey,
            ["RateLimiting:AnonymousWrites:PermitLimit"] = AnonymousWritesPermitLimit.ToString(System.Globalization.CultureInfo.InvariantCulture),
            ["RateLimiting:AnonymousWrites:WindowSeconds"] = "3600",
            // The test rows have made-up dates: the daily clean-up is tested on its own (AccountsCleanupTests).
            ["Cleanup:Enabled"] = "false",
            // The expiry and outbox jobs run when a test runs them (JobsTests), not on a timer.
            ["Jobs:Enabled"] = "false",
            // Uploaded photos of the run go to a folder of its own, removed with the database.
            ["Media:LocalPath"] = database.MediaRoot,
            ["Logging:LogLevel:Default"] = "Warning",
            ["Logging:LogLevel:Microsoft"] = "Warning",
        }));
        builder.ConfigureServices(TestEndpoints.Register);
    }

    /// <summary>A factory for another environment and/or extra settings (dispose it in the test).</summary>
    public WebApplicationFactory<Program> With(string? environment = null, IDictionary<string, string?>? settings = null) =>
        WithWebHostBuilder(builder =>
        {
            if (environment is not null)
            {
                builder.UseEnvironment(environment);
            }

            if (settings is not null)
            {
                builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(settings));
            }
        });
}
