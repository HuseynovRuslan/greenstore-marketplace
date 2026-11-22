using System.Text.Json.Serialization;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Tests.Infrastructure.Samples;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// Endpoints that exist only in tests, under <see cref="Prefix"/>. They are mapped into the API's real /api/v1 group
/// (<see cref="IExtraApiEndpoints"/>), so requests pass through Program.cs's whole pipeline (exception handler, status
/// code pages, client IP, language, routing, rate limiter) and their errors come back through it: what they show is
/// what real module endpoints will get.
/// </summary>
public sealed class TestEndpoints : IExtraApiEndpoints
{
    public const string Prefix = ApiRoutes.Prefix + "/__test";

    public static readonly SampleDto Sample = new(
        Guid.Parse("019a8b4e-0000-7000-8000-000000000001"),
        "Zeytun ağacı",
        RootSystem.BareRoot,
        BusinessKind.GardenCentre,
        PromotionPackageId.OneCixar,
        ListingStatus.Active,
        PriceUnit.Sqm,
        new DateTimeOffset(2026, 10, 28, 10, 15, 0, TimeSpan.FromHours(4)),
        12,
        new LocalizedText("Güllər", "Розы"));

    public static void Register(IServiceCollection services) => services.AddSingleton<IExtraApiEndpoints, TestEndpoints>();

    public void Map(RouteGroupBuilder api)
    {
        var e = api.MapGroup(Prefix[ApiRoutes.Prefix.Length..]);
        e.MapGet("/throw", () =>
        {
            throw new InvalidOperationException("secret internal detail");
        });
        e.MapGet("/problem", () =>
        {
            throw new ApiProblemException(StatusCodes.Status409Conflict, "listing.not-editable", detail: "Only the owner can edit.");
        });
        // What every get-by-slug endpoint does from phase 1.
        e.MapGet("/missing", () =>
        {
            throw ApiProblemException.NotFound("listing.not-found");
        });
        e.MapGet("/validation", () =>
        {
            throw ApiProblemException.Validation(new Dictionary<string, string[]>
            {
                ["contactPhone"] = ["phone.invalid"],
                ["title"] = ["too-short", "required"],
            });
        });
        e.MapGet("/concurrency", () =>
        {
            throw new DbUpdateConcurrencyException("stale row version");
        });
        e.MapGet("/status/{status:int}", (int status) => Results.StatusCode(status));
        e.MapGet("/client-ip", (HttpContext context) =>
        {
            var client = context.GetClientIp();
            return new ClientIpDto(client.Address?.ToString(), client.IsInternal);
        });
        e.MapGet("/language", (HttpContext context) => new LanguageDto(context.GetLanguage()));
        e.MapGet("/sample", () => Sample);
        e.MapPost("/echo", (SampleDto body) => body);
        e.MapPost("/limited", () => Results.NoContent()).RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        // The role policies admin endpoints will use (phase 3 and 4).
        e.MapGet("/staff-only", () => Results.NoContent()).RequireAuthorization(Access.StaffPolicy);
        e.MapGet("/admin-only", () => Results.NoContent()).RequireAuthorization(Access.AdminPolicy);
    }
}

public sealed record ClientIpDto(string? Address, bool IsInternal);

public sealed record LanguageDto(Language Language);
