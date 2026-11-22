using System.Net;
using GreenStore.Api.Jobs;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Promotion;

/// <summary>
/// The Promotions job (ARCHITECTURE.md §12) run by hand on the lifecycle database: «Önə çıxar» ends, «İrəli çək» lifts.
/// Times are moved in the rows, not on the shared clock.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class PromotionsJobTests(LifecycleApi api)
{
    [Fact]
    public async Task A_feature_past_its_end_takes_the_badge_off_and_the_site_is_told()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.PublishAsync(owner);
        var id = Guid.Parse(sent.GetProperty("id").GetString()!);
        await api.PayAsync(await api.OrderAsync(owner, id.ToString(), "one-cixar-3"));
        await using var db = api.CreateDbContext();
        // Three days later, as far as the rows know.
        var ended = api.Clock.Now.AddSeconds(-1);
        await db.Listings.Where(l => l.Id == id).ExecuteUpdateAsync(l => l.SetProperty(x => x.PromotedUntil, ended), Ct);
        await db.ListingPromotions.Where(p => p.ListingId == id).ExecuteUpdateAsync(p => p.SetProperty(x => x.StartsAt, ended.AddDays(-3)).SetProperty(x => x.EndsAt, ended), Ct);
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);
        var demo = await db.Listings.AsNoTracking().Where(l => l.IsPromoted && l.PromotedUntil == null).Select(l => l.Id).ToListAsync(Ct);
        Assert.NotEmpty(demo);

        var run = await RunAsync();

        Assert.True(run!.FeaturesEnded >= 1);
        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.False(own.GetProperty("vip").GetBoolean());
        Assert.False(own.TryGetProperty("promotion", out _));
        Assert.Equal("active", own.GetProperty("status").GetString());
        Assert.Null((await db.Listings.AsNoTracking().SingleAsync(l => l.Id == id, Ct)).PromotedAt);
        Assert.Contains(await OutboxRows.WithAsync(db, $"listing:{id}"), m => m.SentAt == null);
        // The demo data's «Önə çıxan» listings have no end and stay.
        Assert.Equal(demo.Count, await db.Listings.CountAsync(l => demo.Contains(l.Id) && l.IsPromoted, Ct));
        Assert.Equal(0, (await RunAsync())!.FeaturesEnded);
    }

    [Fact]
    public async Task Ireli_cek_lifts_the_listing_again_when_the_next_lift_is_due()
    {
        var owner = await api.RegisterAsync();
        var id = Guid.Parse((await api.PublishAsync(owner)).GetProperty("id").GetString()!);
        await api.PayAsync(await api.OrderAsync(owner, id.ToString(), "ireli-cek-5"));
        await using var db = api.CreateDbContext();
        var row = await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct);
        Assert.Equal((short)4, row.BumpsLeft);
        // The first lift came with the payment; the next is a day later.
        await RunAsync();
        Assert.Equal((short)4, (await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct)).BumpsLeft);

        var earlier = api.Clock.Now.AddDays(-2);
        await db.ListingPromotions.Where(p => p.Id == row.Id).ExecuteUpdateAsync(p => p.SetProperty(x => x.NextBumpAt, api.Clock.Now.AddMinutes(-1)), Ct);
        await db.Listings.Where(l => l.Id == id).ExecuteUpdateAsync(l => l.SetProperty(x => x.SortAt, earlier).SetProperty(x => x.BumpedAt, earlier), Ct);
        await db.Outbox.Where(m => m.SentAt == null).ExecuteUpdateAsync(m => m.SetProperty(x => x.SentAt, api.Clock.Now), Ct);

        Assert.True((await RunAsync())!.ListingsBumped >= 1);

        var now = api.Clock.Now;
        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == id, Ct);
        Assert.Equal(((DateTimeOffset?)now, (DateTimeOffset?)now), (listing.SortAt, listing.BumpedAt));
        row = await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct);
        Assert.Equal(((short)3, (DateTimeOffset?)now.AddDays(1)), (row.BumpsLeft, row.NextBumpAt));
        Assert.Contains(await OutboxRows.WithAsync(db, $"listing:{id}"), m => m.SentAt == null);

        // Not due again until a day later.
        await RunAsync();
        Assert.Equal((short)3, (await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct)).BumpsLeft);
    }

    [Fact]
    public async Task A_listing_off_the_site_keeps_its_lifts_until_it_is_back()
    {
        var owner = await api.RegisterAsync();
        var id = Guid.Parse((await api.PublishAsync(owner)).GetProperty("id").GetString()!);
        await api.PayAsync(await api.OrderAsync(owner, id.ToString(), "ireli-cek-5"));
        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/deactivate", null, Ct)).StatusCode);
        await using var db = api.CreateDbContext();
        await db.ListingPromotions.Where(p => p.ListingId == id).ExecuteUpdateAsync(p => p.SetProperty(x => x.NextBumpAt, api.Clock.Now.AddMinutes(-1)), Ct);

        await RunAsync();
        Assert.Equal((short)4, (await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct)).BumpsLeft);

        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PostAsync($"/api/v1/me/listings/{id}/activate", null, Ct)).StatusCode);
        await RunAsync();
        Assert.Equal((short)3, (await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct)).BumpsLeft);
    }

    [Fact]
    public async Task The_last_lift_ends_the_schedule()
    {
        var owner = await api.RegisterAsync();
        var id = Guid.Parse((await api.PublishAsync(owner)).GetProperty("id").GetString()!);
        await api.PayAsync(await api.OrderAsync(owner, id.ToString(), "paket-7"));
        await using var db = api.CreateDbContext();
        await db.ListingPromotions
            .Where(p => p.ListingId == id && p.BumpsLeft > 0)
            .ExecuteUpdateAsync(p => p.SetProperty(x => x.BumpsLeft, (short)1).SetProperty(x => x.NextBumpAt, api.Clock.Now.AddMinutes(-1)), Ct);

        await RunAsync();

        var rows = await db.ListingPromotions.AsNoTracking().Where(p => p.ListingId == id).ToListAsync(Ct);
        Assert.All(rows, r => Assert.Equal(((short)0, (DateTimeOffset?)null), (r.BumpsLeft, r.NextBumpAt)));
        // The bundle's «Önə çıxan» runs on.
        Assert.True((await db.Listings.AsNoTracking().SingleAsync(l => l.Id == id, Ct)).IsPromoted);
    }

    [Fact]
    public async Task Another_instance_running_the_job_is_left_alone()
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var transaction = await connection.BeginTransactionAsync(Ct);
        await using (var hold = new NpgsqlCommand("SELECT pg_advisory_xact_lock(hashtextextended('job:promotions', 0))", connection, transaction))
        {
            await hold.ExecuteNonQueryAsync(Ct);
        }

        Assert.Null(await RunAsync());
        await transaction.RollbackAsync(Ct);
        Assert.NotNull(await RunAsync());
    }

    private async Task<PromotionsRun?> RunAsync()
    {
        await using var factory = api.Variant();
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<Promotions>().RunOnceAsync(Ct);
    }
}
