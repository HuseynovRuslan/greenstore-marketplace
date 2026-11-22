using System.Net;
using System.Net.Http.Json;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Bizimlə əlaqə»: the message is stored with a ticket number the visitor can quote.</summary>
[Collection(LifecycleCollection.Name)]
public sealed class SupportTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Fact]
    public async Task A_guest_gets_a_ticket_number_and_the_message_is_stored()
    {
        var response = await api.Client().PostAsJsonAsync(
            "/api/v1/support",
            new { topic = "listing", name = "Rauf", contact = "050 555 12 34", message = "Elanım üç gündür yoxlamadadır.", listingNumber = 10482 },
            Ct);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await JsonAsync(response);
        Assert.Empty(Contract.Check(body, "{ ticket: number }"));
        var ticket = body.GetProperty("ticket").GetInt64();
        Assert.True(ticket >= 1001);

        await using var db = api.CreateDbContext();
        var row = await db.SupportMessages.AsNoTracking().SingleAsync(m => m.Ticket == ticket, Ct);
        Assert.Equal(SupportTopic.Listing, row.Topic);
        Assert.Equal("+994505551234", row.Contact);
        Assert.Equal(10482, row.ListingNumber);
        Assert.Equal(SupportStatus.New, row.Status);
        Assert.Null(row.UserId);
        Assert.NotNull(row.IpHash);
    }

    [Fact]
    public async Task A_signed_in_visitors_message_names_the_account_and_tickets_grow()
    {
        var user = await api.RegisterAsync();
        var client = api.Client(user.Token);

        var first = (await JsonAsync(await client.PostAsJsonAsync("/api/v1/support", new { topic = "account", name = "Aygün", contact = "aygun@example.az", message = "Şifrəmi necə dəyişə bilərəm?" }, Ct))).GetProperty("ticket").GetInt64();
        var second = (await JsonAsync(await client.PostAsJsonAsync("/api/v1/support", new { topic = "other", name = "Aygün", contact = "aygun@example.az", message = "Təşəkkürlər, alındı." }, Ct))).GetProperty("ticket").GetInt64();

        Assert.True(second > first);
        await using var db = api.CreateDbContext();
        Assert.All(await db.SupportMessages.AsNoTracking().Where(m => m.Ticket == first || m.Ticket == second).ToListAsync(Ct), m =>
        {
            Assert.Equal(user.Id, m.UserId);
            Assert.Equal("aygun@example.az", m.Contact);
        });
        var overview = await api.GetAsync("/api/v1/admin/overview", await api.ModeratorTokenAsync());
        Assert.True(overview.GetProperty("support").GetProperty("new").GetInt32() >= 2);
    }

    [Fact]
    public async Task A_bad_message_names_its_fields()
    {
        var problem = await ProblemAsync(
            await api.Client().PostAsJsonAsync("/api/v1/support", new { topic = "billing", name = "", contact = "zəng edin", message = "Salam" }, Ct),
            HttpStatusCode.BadRequest,
            "validation");

        Assert.Equal(["contact", "message", "name", "topic"], problem.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order());
    }
}
