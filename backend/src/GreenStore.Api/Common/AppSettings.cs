namespace GreenStore.Api.Common;

/// <summary>The Next.js site (section "Frontend"): cache refresh notices (phase 3), the upload CORS origin, links in messages.</summary>
public sealed class FrontendOptions
{
    public const string Section = "Frontend";

    /// <summary>Public origin of the site, no trailing slash (e.g. https://greenstore.az).</summary>
    public string BaseUrl { get; set; } = string.Empty;
}

/// <summary>
/// Reference and demo data (section "Seed", DATABASE.md §7), written by the <c>migrate</c> command and, in Development,
/// at startup (Data/Seed/Seeder.cs).
/// </summary>
public sealed class SeedOptions
{
    public const string Section = "Seed";

    /// <summary>Categories, cities and promotion packages; written only when missing. Every environment.</summary>
    public bool Reference { get; set; } = true;

    /// <summary>Sample listings, sellers, services and users. Development and Staging only.</summary>
    public bool Demo { get; set; }

    /// <summary>
    /// A moderator and an admin account with known dev-only passwords (backend/README.md). Development only; the API
    /// refuses to start with it anywhere else (<see cref="AppSettingsSetup.IsLocal"/>).
    /// </summary>
    public bool DevAccounts { get; set; }

    /// <summary>The folder with reference/ and demo/; empty: the seed/ folder next to the API's binaries.</summary>
    public string Directory { get; set; } = string.Empty;
}

/// <summary>Photos: where they are stored and served, and the upload limits (section "Media", ARCHITECTURE.md §11).</summary>
public sealed class MediaOptions
{
    public const string Section = "Media";

    /// <summary><see cref="Storage"/>: files on the API's disk, served by the API under /media (Development).</summary>
    public const string LocalStorage = "local";

    /// <summary><see cref="Storage"/>: an S3-compatible bucket (Cloudflare R2, Hetzner, AWS) behind a CDN.</summary>
    public const string S3Storage = "s3";

    /// <summary>
    /// Where uploaded photos are served from (the CDN in production; the API's own /media locally), no trailing slash.
    /// Demo photos keep their site paths ("/images/…", served by Next from /public) and do not use it.
    /// </summary>
    public string BaseUrl { get; set; } = "/media";

    /// <summary><see cref="LocalStorage"/> or <see cref="S3Storage"/>.</summary>
    public string Storage { get; set; } = LocalStorage;

    /// <summary>The folder of <see cref="LocalStorage"/>; relative paths are under the API's content root.</summary>
    public string LocalPath { get; set; } = ".media";

    /// <summary>
    /// The API's public origin for the browser's upload (<c>uploadUrl</c>), e.g. https://api.greenstore.az. Empty: the
    /// origin the request came to (right when the site's server and the browser reach the API at the same address).
    /// </summary>
    public string UploadBaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// What a deployment outside Development has left to the defaults that only suit one machine, logged at start
    /// (backend/README.md, «Şəkil yaddaşı»): the browser must reach both addresses itself.
    /// </summary>
    public IEnumerable<string> DeployWarnings()
    {
        if (string.IsNullOrWhiteSpace(UploadBaseUrl))
        {
            yield return "Media:UploadBaseUrl is not set: upload addresses use the host the site's server called; " +
                "set it to the API's public origin (e.g. https://api.greenstore.az) when that is an internal address";
        }

        if (!Uri.TryCreate(BaseUrl, UriKind.Absolute, out var url) || url.Scheme is not ("http" or "https"))
        {
            yield return $"Media:BaseUrl \"{BaseUrl}\" is not an absolute http(s) URL: photo addresses would resolve " +
                "against the site's origin; set it to the CDN (e.g. https://cdn.greenstore.az) or the API's public origin + /media";
        }
    }

    /// <summary>
    /// Origins whose pages may PUT a photo to the API (CORS), besides <see cref="FrontendOptions.BaseUrl"/>: the
    /// browser uploads straight to the API, not through Next (Vercel takes at most 4.5 MB per request).
    /// </summary>
    public List<string> UploadOrigins { get; set; } = [];

    /// <summary>How long an upload address is valid.</summary>
    public int UploadMinutes { get; set; } = 10;

    /// <summary>The largest file (10 MB, <c>photos.bytes</c>).</summary>
    public int MaxBytes { get; set; } = 10 * 1024 * 1024;

    /// <summary>The shorter side of a photo, at least (the wizard's <c>MIN_SIDE</c>).</summary>
    public int MinSide { get; set; } = 600;

    /// <summary>The most pixels a photo may have, so a small file hiding a huge image cannot take the server down.</summary>
    public long MaxPixels { get; set; } = 50_000_000;

    /// <summary>Photos one account may have waiting to be attached (uploaded in the last 24 hours, not in a listing yet).</summary>
    public int MaxUnattachedPerUser { get; set; } = 60;

    /// <summary>The S3-compatible bucket, for <see cref="S3Storage"/>.</summary>
    public S3StorageOptions S3 { get; set; } = new();
}

/// <summary>An S3-compatible bucket (section "Media:S3"). The keys come from the environment only.</summary>
public sealed class S3StorageOptions
{
    /// <summary>The provider's endpoint, e.g. https://&lt;account&gt;.r2.cloudflarestorage.com; empty for AWS itself.</summary>
    public string ServiceUrl { get; set; } = string.Empty;

    public string Region { get; set; } = "auto";

    public string Bucket { get; set; } = string.Empty;

    public string AccessKey { get; set; } = string.Empty;

    /// <summary>Secret: <c>Media__S3__SecretKey</c> in the hosting's environment, never committed.</summary>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>Bucket in the path (most S3-compatible providers want it).</summary>
    public bool ForcePathStyle { get; set; } = true;
}

/// <summary>The cache refresh notices to the site (section "Revalidation", ARCHITECTURE.md §10).</summary>
public sealed class RevalidationOptions
{
    public const string Section = "Revalidation";

    /// <summary>
    /// Shared secret the API sends to the site's <c>POST /api/revalidate</c> as <c>Authorization: Bearer</c>. Empty, or
    /// <see cref="FrontendOptions.BaseUrl"/> empty: no notices are sent (the site's 60-second cache refreshes pages
    /// anyway). From the environment (<c>Revalidation__Secret</c>), never committed.
    /// </summary>
    public string Secret { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 10;
}

/// <summary>SMS codes (section "Otp", ARCHITECTURE.md §14). Used from phase 2.</summary>
public sealed class OtpOptions
{
    public const string Section = "Otp";

    /// <summary>The longest <see cref="MaxAttempts"/>: <c>otp_challenges</c> has <c>CHECK (attempts &lt;= 5)</c>.</summary>
    public const int AttemptsLimit = 5;

    /// <summary>
    /// Server key for HMAC-SHA256 of codes and IPs (<c>Common/Security/ServerHash.cs</c>). From the environment
    /// (<c>Otp__HmacKey</c>), never committed; at least 32 characters in Production. Changing it makes the codes in
    /// flight and the stored IP hashes unusable (limits start from zero), nothing else.
    /// </summary>
    public string HmacKey { get; set; } = string.Empty;

    /// <summary>
    /// Return the code in the response (<c>demoCode</c>) as well as sending it. Development only; the API refuses to
    /// start with it anywhere else (<see cref="AppSettingsSetup.IsLocal"/>), Staging included: a host on the internet
    /// would hand every visitor the code for any number.
    /// </summary>
    public bool ExposeDemoCode { get; set; }

    public int CodeLength { get; set; } = 4;

    /// <summary>How long a code can be entered.</summary>
    public int LifetimeSeconds { get; set; } = 300;

    /// <summary>«Kodu yenidən göndər»: the wait before another code goes to the same number.</summary>
    public int ResendSeconds { get; set; } = 60;

    public int MaxAttempts { get; set; } = 5;

    /// <summary>How long a verified code still proves the phone to registration, sign-in or a password reset.</summary>
    public int VerifiedLifetimeSeconds { get; set; } = 1800;

    /// <summary>Codes per phone number in the last hour and the last 24 hours.</summary>
    public int PerPhoneHourly { get; set; } = 5;

    public int PerPhoneDaily { get; set; } = 10;

    /// <summary>
    /// Codes per client IP (IPv6: per /64) in the last hour and the last 24 hours. Higher than per phone: mobile
    /// operators put many customers behind one address.
    /// </summary>
    public int PerIpHourly { get; set; } = 20;

    public int PerIpDaily { get; set; } = 100;

    /// <summary>
    /// All codes of the platform in the last 24 hours. Beyond it no SMS is sent (<c>503 otp.unavailable</c>) and an
    /// error is logged; at 80 % a warning is logged. It caps what a bot can spend on SMS.
    /// </summary>
    public int GlobalDailyCap { get; set; } = 2000;
}

public static class AppSettingsSetup
{
    /// <summary>The automated tests' environment (tests/…/Infrastructure/ApiFactory.cs).</summary>
    public const string TestingEnvironment = "Testing";

    /// <summary>
    /// A developer's machine or the test run: the only places where dev-only switches (demo SMS codes in responses, dev
    /// accounts with documented passwords) may be on. Staging and Production are reachable from the internet.
    /// </summary>
    public static bool IsLocal(IHostEnvironment environment) =>
        environment.IsDevelopment() || environment.IsEnvironment(TestingEnvironment);

    public static IServiceCollection AddAppSettings(this IServiceCollection services)
    {
        services.AddOptions<FrontendOptions>().BindConfiguration(FrontendOptions.Section);
        services.AddOptions<MediaOptions>()
            .BindConfiguration(MediaOptions.Section)
            .Validate(
                m => m.Storage is MediaOptions.LocalStorage or MediaOptions.S3Storage,
                $"Media:Storage must be \"{MediaOptions.LocalStorage}\" or \"{MediaOptions.S3Storage}\".")
            .Validate(
                m => m.Storage != MediaOptions.S3Storage || !string.IsNullOrWhiteSpace(m.S3.Bucket),
                "Media:S3:Bucket is not set (Media:Storage is \"s3\").")
            .Validate(
                m => m.UploadMinutes > 0 && m.MaxBytes is > 0 and <= 10 * 1024 * 1024 && m.MinSide > 0 && m.MaxPixels > 0 && m.MaxUnattachedPerUser > 0,
                "Media: the limits must be positive and MaxBytes at most 10 MB (photos.bytes).")
            .ValidateOnStart();
        services.AddOptions<RevalidationOptions>().BindConfiguration(RevalidationOptions.Section);
        services.AddOptions<SeedOptions>()
            .BindConfiguration(SeedOptions.Section)
            .Validate<IHostEnvironment>(
                (seed, environment) => IsLocal(environment) || !seed.DevAccounts,
                "Seed:DevAccounts must be false outside Development.")
            .ValidateOnStart();
        services.AddOptions<OtpOptions>()
            .BindConfiguration(OtpOptions.Section)
            .Validate<IHostEnvironment>(
                (otp, environment) => IsLocal(environment) || !otp.ExposeDemoCode,
                "Otp:ExposeDemoCode must be false outside Development.")
            .Validate(
                otp => !string.IsNullOrWhiteSpace(otp.HmacKey),
                "Otp:HmacKey is not set (environment variable Otp__HmacKey).")
            .Validate<IHostEnvironment>(
                (otp, environment) => !environment.IsProduction() || otp.HmacKey.Length >= 32,
                "Otp:HmacKey must have at least 32 characters in Production.")
            .Validate(
                otp => otp.CodeLength is >= 4 and <= 8
                    && otp.MaxAttempts is >= 1 and <= OtpOptions.AttemptsLimit
                    && otp.LifetimeSeconds > 0 && otp.ResendSeconds >= 0 && otp.VerifiedLifetimeSeconds > 0
                    && otp.PerPhoneHourly > 0 && otp.PerPhoneDaily > 0 && otp.PerIpHourly > 0 && otp.PerIpDaily > 0
                    && otp.GlobalDailyCap > 0,
                "Otp: CodeLength must be 4–8, MaxAttempts 1–5, and the times and limits positive.")
            .ValidateOnStart();
        return services;
    }
}
