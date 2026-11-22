using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Data;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Jobs;
using GreenStore.Api.Modules.Accounts.Sms;
using GreenStore.Api.Modules.Platform;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// The accounts API on a database of its own: migrated and seeded like Development (reference data, the sample
/// marketplace and the dev staff accounts). The API's clock is <see cref="Clock"/>, which the tests move forward (never
/// back): a test that needs empty limit windows first jumps a day or two. SMS go to <see cref="Sms"/>, not the log.
/// The test classes of the <see cref="AccountsCollection"/> run one after another, so they can share the clock; each
/// uses phone numbers and client IPs of its own (<see cref="NewPhone"/>, <see cref="Client"/>), so limits do not mix.
/// </summary>
public class AccountsApi(PostgresDatabase database) : IAsyncLifetime
{
    public static readonly DateTimeOffset Start = new(2026, 11, 22, 8, 0, 0, TimeSpan.Zero);

    private static int phones;
    private static int ips;

    private ScratchDatabase? scratch;
    private ApiFactory? root;
    private WebApplicationFactory<Program>? api;

    public ManualTimeProvider Clock { get; } = new(Start);

    public CapturingSmsSender Sms { get; } = new();

    public CapturingLoggerProvider Log { get; } = new();

    /// <summary>The cache refresh notices the outbox would have sent to the site.</summary>
    public CapturingRevalidationSender Revalidation { get; } = new();

    /// <summary>The scratch database's name suffix: each fixture has a database of its own.</summary>
    protected virtual string DatabaseSuffix => "accounts";

    public string ConnectionString => scratch!.ConnectionString;

    public async ValueTask InitializeAsync()
    {
        scratch = await database.CreateScratchDatabaseAsync(DatabaseSuffix);
        await using (var db = CreateDbContext())
        {
            await db.Database.MigrateAsync();
            await Seeder.SeedAsync(db, new SeedOptions { Reference = true, Demo = true, DevAccounts = true }, Clock, NullLogger.Instance);
        }

        root = new ApiFactory(database);
        api = Variant();
    }

    public async ValueTask DisposeAsync()
    {
        if (root is not null)
        {
            await root.DisposeAsync();
        }

        if (scratch is not null)
        {
            await scratch.DisposeAsync();
        }
    }

    /// <summary>
    /// The API with these settings on top of the fixture's (same database, clock and SMS sender). The default one has
    /// demo codes on and limits that tests do not reach by accident. Dispose a variant in the test.
    /// </summary>
    public WebApplicationFactory<Program> Variant(IDictionary<string, string?>? settings = null, ISmsSender? sms = null)
    {
        var all = new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = scratch!.ConnectionString,
            ["Otp:ExposeDemoCode"] = "true",
            ["Otp:GlobalDailyCap"] = "100000",
            ["RateLimiting:AnonymousWrites:PermitLimit"] = "100000",
        };
        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
        {
            all[key] = value;
        }

        return root!.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(all));
            builder.ConfigureTestServices(services =>
            {
                services.AddSingleton<TimeProvider>(Clock);
                services.AddSingleton<ISmsSender>(sms ?? Sms);
                services.AddSingleton<IRevalidationSender>(Revalidation);
                services.AddSingleton<ILoggerProvider>(Log);
            });
        });
    }

    /// <summary>A context on the test database, as the API's (with <paramref name="interceptors"/> on top).</summary>
    public AppDbContext CreateDbContext(params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>();
        DatabaseSetup.Configure(options, scratch!.ConnectionString);
        options.AddInterceptors([new UpdatedAtInterceptor(Clock), .. interceptors]);
        return new AppDbContext(options.Options);
    }

    /// <summary>A mobile number no other test uses (+99455 1xx xx xx).</summary>
    public static string NewPhone() => string.Create(CultureInfo.InvariantCulture, $"+99455{1_000_000 + Interlocked.Increment(ref phones)}");

    /// <summary>A client IP no other test uses (10.x.y.z).</summary>
    public static string NewIp()
    {
        var n = Interlocked.Increment(ref ips);
        return string.Create(CultureInfo.InvariantCulture, $"10.{(n >> 16) & 255}.{(n >> 8) & 255}.{n & 255}");
    }

    /// <summary>
    /// A client as the site's server is one: the internal key, and the visitor's IP (a new one unless given), plus the
    /// session token when there is one.
    /// </summary>
    public HttpClient Client(string? token = null, string? ip = null, WebApplicationFactory<Program>? factory = null)
    {
        var client = (factory ?? api!).CreateClient();
        client.DefaultRequestHeaders.Add(ClientIpResolver.InternalKeyHeader, ApiFactory.InternalKey);
        client.DefaultRequestHeaders.Add(ClientIpResolver.ClientIpHeader, ip ?? NewIp());
        if (token is not null)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }

    /// <summary>A client without the site's headers: what a browser or a script sends.</summary>
    public HttpClient RawClient(WebApplicationFactory<Program>? factory = null) => (factory ?? api!).CreateClient();

    /// <summary>Asks for a code; asserts 200 and returns the challenge.</summary>
    public async Task<JsonElement> RequestOtpAsync(HttpClient client, string phone, string purpose)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/otp", new { phone, purpose }, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"POST /auth/otp: {(int)response.StatusCode} {body}");
        return body;
    }

    /// <summary>A verified challenge of <paramref name="purpose"/> for <paramref name="phone"/>; its id.</summary>
    public async Task<string> VerifiedChallengeAsync(HttpClient client, string phone, string purpose)
    {
        var challenge = await RequestOtpAsync(client, phone, purpose);
        var id = challenge.GetProperty("challengeId").GetString()!;
        var verify = await client.PostAsJsonAsync("/api/v1/auth/otp/verify", new { challengeId = id, code = challenge.GetProperty("demoCode").GetString() }, Ct);
        Assert.Equal(HttpStatusCode.OK, verify.StatusCode);
        return id;
    }

    /// <summary>Registers an account (code asked for and verified first); returns the response body.</summary>
    public async Task<Account> RegisterAsync(
        string? phone = null,
        string accountType = "individual",
        string password = "Bagban-2026",
        string? companyName = null,
        string? businessKind = null,
        string? email = null,
        string fullName = "Test İstifadəçi",
        string? cityId = null)
    {
        phone ??= NewPhone();
        var client = Client();
        var challengeId = await VerifiedChallengeAsync(client, phone, "register");
        var response = await client.PostAsJsonAsync(
            "/api/v1/accounts",
            new { accountType, fullName, phone, password, otpChallengeId = challengeId, companyName, businessKind, email, cityId },
            Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /accounts: {(int)response.StatusCode} {body}");
        return new Account(phone, password, body);
    }

    /// <summary>GETs with the token; asserts 200 and returns the body.</summary>
    public async Task<JsonElement> GetAsync(string path, string token)
    {
        var response = await Client(token).GetAsync(path, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"GET {path}: {(int)response.StatusCode} {body}");
        return body;
    }
}

/// <summary>A registered test account: its number, password and the registration's response.</summary>
public sealed record Account(string Phone, string Password, JsonElement Response)
{
    public string Token => Response.GetProperty("session").GetProperty("token").GetString()!;

    public string SessionId => Response.GetProperty("session").GetProperty("id").GetString()!;

    public string UserId => Response.GetProperty("user").GetProperty("id").GetString()!;

    public Guid Id => Guid.Parse(UserId);
}

[CollectionDefinition(Name)]
public sealed class AccountsCollection : ICollectionFixture<AccountsApi>
{
    public const string Name = "accounts";
}

/// <summary>The SMS the API would have sent, newest last.</summary>
public sealed class CapturingSmsSender : ISmsSender
{
    private readonly ConcurrentQueue<SmsMessage> sent = new();

    public IReadOnlyList<SmsMessage> Sent => sent.ToList();

    public IReadOnlyList<SmsMessage> To(string phone) => sent.Where(m => m.Phone == phone).ToList();

    public Task SendAsync(SmsMessage message, CancellationToken cancellationToken)
    {
        sent.Enqueue(message);
        return Task.CompletedTask;
    }
}

/// <summary>
/// The refresh notices, newest last; <see cref="Fail"/> makes the site unreachable. Like the site's
/// <c>/api/revalidate</c>, it refuses a notice without tags or with more than <see cref="Revalidation.MaxTagsPerNotice"/>.
/// </summary>
public sealed class CapturingRevalidationSender : IRevalidationSender
{
    private readonly ConcurrentQueue<IReadOnlyList<string>> sent = new();

    public IReadOnlyList<IReadOnlyList<string>> Sent => sent.ToList();

    public bool Fail { get; set; }

    public Task<bool> SendAsync(IReadOnlyList<string> tags, CancellationToken ct)
    {
        if (Fail)
        {
            throw new HttpRequestException("site unavailable");
        }

        if (tags.Count is 0 or > Revalidation.MaxTagsPerNotice)
        {
            throw new HttpRequestException($"site refused {tags.Count} tags", null, System.Net.HttpStatusCode.BadRequest);
        }

        sent.Enqueue(tags);
        return Task.FromResult(true);
    }
}

/// <summary>An SMS provider that is down.</summary>
public sealed class FailingSmsSender : ISmsSender
{
    public Task SendAsync(SmsMessage message, CancellationToken cancellationToken) =>
        throw new HttpRequestException("provider unavailable");
}

/// <summary>Collects every log message at Warning or above.</summary>
public sealed class CapturingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<(LogLevel Level, string Message)> messages = new();

    public IReadOnlyList<(LogLevel Level, string Message)> Messages => messages.ToList();

    public ILogger CreateLogger(string categoryName) => new Logger(this);

    public void Dispose()
    {
    }

    private sealed class Logger(CapturingLoggerProvider log) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Warning;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (IsEnabled(logLevel))
            {
                log.messages.Enqueue((logLevel, formatter(state, exception)));
            }
        }
    }
}
