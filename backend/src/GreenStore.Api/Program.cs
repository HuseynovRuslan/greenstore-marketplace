using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Health;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Data.Seed;
using GreenStore.Api.Jobs;
using GreenStore.Api.Modules;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Sms;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Media;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Promotion.Payments;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.Apply(options.SerializerOptions));
builder.Services.AddApiProblemDetails();
builder.Services.AddClientIp();
builder.Services.AddApiRateLimiting();
builder.Services.AddAppSettings();
builder.Services.AddDatabase();
builder.Services.AddApiHealthChecks();
builder.Services.AddAccounts();
builder.Services.AddEngagement();
builder.Services.AddMedia();
builder.Services.AddListingLifecycle();
builder.Services.AddPromotion();
builder.Services.AddJobs();
builder.Services.AddOpenApi("v1", options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Info.Title = "GreenStore API";
    document.Info.Version = "v1";
    return Task.CompletedTask;
}));

var app = builder.Build();

// "dotnet run -- migrate": apply migrations, write the seed data (Seed:Reference, Seed:Demo) and exit: the deploy
// step. Development also does both on startup.
if (args.Contains(MigrationRunner.Command, StringComparer.OrdinalIgnoreCase))
{
    await MigrationRunner.MigrateAsync(app.Services);
    await Seeder.SeedAsync(app.Services);
    return;
}

if (MigrationRunner.ShouldMigrateOnStartup(app.Environment, app.Configuration))
{
    await MigrationRunner.MigrateAsync(app.Services);
    await Seeder.SeedAsync(app.Services);
}

if (!app.Environment.IsDevelopment() && string.IsNullOrEmpty(app.Services.GetRequiredService<IOptions<InternalApiOptions>>().Value.ApiKey))
{
    app.Logger.LogWarning("Internal:ApiKey is not set: X-Client-IP from the Next.js server is ignored and rate limits count its IP");
}

if (!app.Environment.IsDevelopment() && app.Services.GetRequiredService<IOptions<SmsOptions>>().Value.Provider == SmsOptions.LogProvider)
{
    app.Logger.LogWarning("Sms:Provider is \"log\": SMS codes are written to the log and nobody receives them (backend/README.md, «SMS provayderi»)");
}

if (!app.Environment.IsDevelopment() && app.Services.GetRequiredService<IOptions<MediaOptions>>().Value.Storage == MediaOptions.LocalStorage)
{
    app.Logger.LogWarning("Media:Storage is \"local\": photos are kept on this server's disk and served by the API (backend/README.md, «Şəkil yaddaşı»)");
}

var payments = app.Services.GetRequiredService<IOptions<PaymentOptions>>().Value;
if (app.Services.GetRequiredService<PaymentGateways>().Current is null)
{
    app.Logger.LogWarning(
        "Payments:Provider \"{Provider}\" cannot be used here: promotions cannot be bought (503 payment.unavailable) until a real provider is added (backend/README.md, «Ödəniş provayderi»)",
        payments.Provider);
}
else if (!app.Environment.IsDevelopment() && payments.Provider == FakePaymentGateway.ProviderName)
{
    app.Logger.LogWarning("Payments:Provider is \"fake\": promotions are «paid» on a test page and nobody pays (backend/README.md, «Ödəniş provayderi»)");
    if (string.IsNullOrEmpty(payments.Fake.Secret))
    {
        app.Logger.LogWarning("Payments:Fake:Secret is not set: each API instance signs fake callbacks with a key of its own");
    }
}

if (!app.Environment.IsDevelopment() && app.Services.GetRequiredService<PaymentGateways>().Current is not null && string.IsNullOrWhiteSpace(payments.PublicBaseUrl))
{
    // Orders come from the Next.js server, so the request's own host may be a private address no browser can open.
    app.Logger.LogWarning("Payments:PublicBaseUrl is not set: payment pages are addressed by the host each order request came to, which the visitor's browser may not reach (backend/README.md, «Ödəniş provayderi»)");
}

if (!app.Environment.IsDevelopment())
{
    foreach (var warning in app.Services.GetRequiredService<IOptions<MediaOptions>>().Value.DeployWarnings())
    {
        app.Logger.LogWarning("{Warning}", warning);
    }
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseClientIp();
app.UseRequestLanguage();
// Uploaded photos from the local disk (Media:Storage "local", Development); production serves them from the CDN.
app.UseLocalMedia();
app.UseRouting();
// Only the photo upload has a CORS policy: the browser sends the file to the API itself (ARCHITECTURE.md §11).
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapApiHealthChecks();
if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.MapOpenApi();
}

app.MapApiV1();

app.Run();
