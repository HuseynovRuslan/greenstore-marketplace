using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>
/// «Usta çağır» end to end (DATABASE.md §3.8): stored, given to the right providers, an SMS notice each through the
/// outbox, and the providers' inbox. Each test makes a service type of its own, so the providers it counts are its own.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class ServiceRequestsTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    /// <summary>A new, active service type under «Landşaft xidmətləri»; its id and Azerbaijani name.</summary>
    private async Task<(string Id, string Name)> NewServiceTypeAsync()
    {
        var name = $"Test xidməti {Guid.NewGuid().ToString("N")[..8]}";
        var response = await api.Client(await api.AdminTokenAsync()).PostAsJsonAsync("/api/v1/admin/categories", new { parentId = "landsaft-xidmetleri", names = new { az = name } }, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /admin/categories: {(int)response.StatusCode} {body}");
        return (body.GetProperty("id").GetString()!, name);
    }

    private static object Request(string categoryId, string cityId = "baki", string? serviceId = null, string? providerId = null, string phone = "+994 55 700 00 01") => new
    {
        serviceId,
        providerId,
        categoryId,
        cityId,
        area = "Mərdəkan",
        preferredDate = "2026-12-01",
        size = "120 m²",
        description = "Həyətdə 10 ağac əkmək lazımdır.",
        name = "Aygün",
        phone,
    };

    private async Task<HashSet<Guid>> RecipientsAsync(string requestId)
    {
        await using var db = api.CreateDbContext();
        return (await db.ServiceRequestRecipients.Where(r => r.RequestId == Guid.Parse(requestId)).Select(r => r.ProviderUserId).ToListAsync(Ct)).ToHashSet();
    }

    [Fact]
    public async Task A_request_from_a_service_page_goes_to_its_provider_who_gets_an_sms_and_sees_it()
    {
        var (type, name) = await NewServiceTypeAsync();
        var provider = await api.RegisterBusinessAsync();
        var service = await api.PublishServiceAsync(provider, name, "baki", "baki");
        var serviceId = service.GetProperty("id").GetString()!;

        var sent = await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, serviceId: serviceId, phone: AccountsApi.NewPhone()), Ct);

        var body = await JsonAsync(sent);
        Assert.True(sent.StatusCode == HttpStatusCode.Created, body.ToString());
        Assert.Empty(Contract.Check(body, "ServiceRequestResult"));
        var number = body.GetProperty("number").GetInt64();
        Assert.True(number >= 3001);
        Assert.Equal([provider.Id], await RecipientsAsync(body.GetProperty("id").GetString()!));

        await api.DispatchOutboxAsync();
        // The account's own registration code went to this number too.
        var sms = Assert.Single(api.Sms.To(provider.Phone), m => m.Text.Contains("sorğusu", StringComparison.Ordinal));
        Assert.Contains($"№ {number}", sms.Text, StringComparison.Ordinal);
        Assert.Contains("Aygün", sms.Text, StringComparison.Ordinal);

        var inbox = await api.GetAsync("/api/v1/me/service-requests", provider.Token);
        // «Gələn sorğular» of the site reads it as IncomingServiceRequestPage (src/types).
        Assert.Empty(Contract.Check(inbox, "IncomingServiceRequestPage"));
        Assert.Equal(1, inbox.GetProperty("total").GetInt32());
        Assert.Equal(1, inbox.GetProperty("unseen").GetInt32());
        var item = Json.Items(inbox)[0];
        Assert.Equal(number, item.GetProperty("number").GetInt64());
        Assert.Equal(name, item.GetProperty("category").GetString());
        Assert.Equal("Bakı", item.GetProperty("city").GetString());
        Assert.Equal("2026-12-01", item.GetProperty("preferredDate").GetString());
        Assert.Equal(serviceId, item.GetProperty("service").GetProperty("id").GetString());
        Assert.Equal(1, item.GetProperty("recipientCount").GetInt32());
        Assert.True(item.TryGetProperty("notifiedAt", out _));
        Assert.False(item.TryGetProperty("seenAt", out _));
        Assert.StartsWith("+99455", item.GetProperty("customerPhone").GetString(), StringComparison.Ordinal);

        var requestId = item.GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(provider.Token).PostAsync($"/api/v1/me/service-requests/{requestId}/seen", null, Ct)).StatusCode);
        Assert.Equal(0, (await api.GetAsync("/api/v1/me/service-requests", provider.Token)).GetProperty("unseen").GetInt32());

        // Somebody else's inbox does not have it, and cannot mark it.
        var other = await api.RegisterAsync();
        Assert.Equal(0, (await api.GetAsync("/api/v1/me/service-requests", other.Token)).GetProperty("total").GetInt32());
        await ProblemAsync(await api.Client(other.Token).PostAsync($"/api/v1/me/service-requests/{requestId}/seen", null, Ct), HttpStatusCode.NotFound, EngagementErrors.ServiceRequestNotFound);
    }

    [Fact]
    public async Task A_request_without_a_provider_goes_to_the_providers_of_the_type_in_the_city()
    {
        var (type, name) = await NewServiceTypeAsync();
        var inBaku = await api.RegisterBusinessAsync();
        var servingBaku = await api.RegisterBusinessAsync();
        var inGanja = await api.RegisterBusinessAsync();
        var otherType = await api.RegisterBusinessAsync();
        await api.PublishServiceAsync(inBaku, name, "baki", "baki");
        await api.PublishServiceAsync(servingBaku, name, "abseron", "abseron,baki");
        await api.PublishServiceAsync(inGanja, name, "gence", "gence");
        await api.PublishServiceAsync(otherType, "Bağ baxımı", "baki", "baki");

        var sent = await JsonAsync(await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: AccountsApi.NewPhone()), Ct));

        Assert.Equal(new[] { inBaku.Id, servingBaku.Id }.Order(), (await RecipientsAsync(sent.GetProperty("id").GetString()!)).Order());
        await using var db = api.CreateDbContext();
        var request = await db.ServiceRequests.AsNoTracking().SingleAsync(r => r.Id == Guid.Parse(sent.GetProperty("id").GetString()!), Ct);
        Assert.Equal(ServiceRequestStatus.Sent, request.Status);
        Assert.Null(request.ListingId);
        Assert.Equal("+994557000001".Length, request.CustomerPhone.Length);
        var notices = (await OutboxRows.WithAsync(db, request.Id.ToString())).Count(m => m.Type == OutboxTypes.SmsNotice);
        Assert.Equal(2, notices);

        // At most MaxRecipients: the verified business comes first.
        var admin = await api.AdminTokenAsync();
        var sellerId = (await api.GetAsync("/api/v1/me/seller", servingBaku.Token)).GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.OK, (await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/sellers/{sellerId}/verify", new { verified = true }, Ct)).StatusCode);
        await using var one = api.Variant(new Dictionary<string, string?> { ["ServiceRequests:MaxRecipients"] = "1" });
        var single = await JsonAsync(await api.Client(factory: one).PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: AccountsApi.NewPhone()), Ct));
        Assert.Equal([servingBaku.Id], await RecipientsAsync(single.GetProperty("id").GetString()!));
    }

    [Fact]
    public async Task A_request_nobody_can_take_stays_new_for_the_staff()
    {
        var (type, _) = await NewServiceTypeAsync();

        var sent = await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, cityId: "lenkeran", phone: AccountsApi.NewPhone()), Ct);

        Assert.Equal(HttpStatusCode.Created, sent.StatusCode);
        var id = (await JsonAsync(sent)).GetProperty("id").GetString()!;
        Assert.Empty(await RecipientsAsync(id));
        await using var db = api.CreateDbContext();
        Assert.Equal(ServiceRequestStatus.New, (await db.ServiceRequests.AsNoTracking().SingleAsync(r => r.Id == Guid.Parse(id), Ct)).Status);
        var overview = await api.GetAsync("/api/v1/admin/overview", await api.ModeratorTokenAsync());
        Assert.True(overview.GetProperty("serviceRequests").GetProperty("unrouted").GetInt32() >= 1);
    }

    [Fact]
    public async Task A_chosen_provider_is_found_by_account_or_by_business()
    {
        var (type, name) = await NewServiceTypeAsync();
        var provider = await api.RegisterBusinessAsync();
        await api.PublishServiceAsync(provider, name, "gence", "gence");
        var sellerId = (await api.GetAsync("/api/v1/me/seller", provider.Token)).GetProperty("id").GetString()!;

        foreach (var providerId in new[] { provider.UserId, sellerId })
        {
            var sent = await JsonAsync(await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, providerId: providerId, phone: AccountsApi.NewPhone()), Ct));
            Assert.Equal([provider.Id], await RecipientsAsync(sent.GetProperty("id").GetString()!));
        }

        // An account without an active service is no provider.
        var nobody = await api.RegisterAsync();
        await ProblemAsync(await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, providerId: nobody.UserId, phone: AccountsApi.NewPhone()), Ct), HttpStatusCode.NotFound, "provider.not-found");
        await ProblemAsync(await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, serviceId: Guid.NewGuid().ToString(), phone: AccountsApi.NewPhone()), Ct), HttpStatusCode.NotFound, "service.not-found");
    }

    [Fact]
    public async Task A_bad_request_names_its_fields()
    {
        var problem = await ProblemAsync(
            await api.Client().PostAsJsonAsync("/api/v1/service-requests", new { categoryId = "agaclar", cityId = "baki", description = "Kömək", name = "", phone = "123", preferredDate = "2026-11-01" }, Ct),
            HttpStatusCode.BadRequest,
            "validation");

        var errors = problem.GetProperty("errors");
        Assert.Equal("invalid", errors.GetProperty("categoryId")[0].GetString());
        Assert.Equal("too-short", errors.GetProperty("description")[0].GetString());
        Assert.Equal("required", errors.GetProperty("name")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("phone")[0].GetString());
        Assert.Equal(ServiceRequestRules.InPast, errors.GetProperty("preferredDate")[0].GetString());
    }

    [Fact]
    public async Task The_same_idempotency_key_answers_the_same_request()
    {
        var (type, _) = await NewServiceTypeAsync();
        var client = api.Client();
        client.DefaultRequestHeaders.Add(IdempotentRequests.Header, $"sorgu-{Guid.NewGuid()}");
        var body = Request(type, cityId: "seki", phone: AccountsApi.NewPhone());

        var first = await JsonAsync(await client.PostAsJsonAsync("/api/v1/service-requests", body, Ct));
        var second = await client.PostAsJsonAsync("/api/v1/service-requests", body, Ct);

        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(first.GetProperty("number").GetInt64(), (await JsonAsync(second)).GetProperty("number").GetInt64());
        await ProblemAsync(await client.PostAsJsonAsync("/api/v1/service-requests", Request(type, cityId: "quba", phone: AccountsApi.NewPhone()), Ct), HttpStatusCode.UnprocessableEntity, IdempotentRequests.KeyReused);
    }

    [Fact]
    public async Task One_phone_and_one_address_send_a_limited_number_a_day()
    {
        var (type, _) = await NewServiceTypeAsync();
        await using var strict = api.Variant(new Dictionary<string, string?> { ["ServiceRequests:MaxPerPhonePerDay"] = "1", ["ServiceRequests:MaxPerIpPerDay"] = "2" });
        var phone = AccountsApi.NewPhone();
        var ip = AccountsApi.NewIp();

        Assert.Equal(HttpStatusCode.Created, (await api.Client(ip: ip, factory: strict).PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: phone), Ct)).StatusCode);
        var byPhone = await api.Client(factory: strict).PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: phone), Ct);
        await ProblemAsync(byPhone, HttpStatusCode.TooManyRequests, EngagementErrors.PhoneLimit);
        Assert.NotNull(byPhone.Headers.RetryAfter);

        Assert.Equal(HttpStatusCode.Created, (await api.Client(ip: ip, factory: strict).PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: AccountsApi.NewPhone()), Ct)).StatusCode);
        await ProblemAsync(await api.Client(ip: ip, factory: strict).PostAsJsonAsync("/api/v1/service-requests", Request(type, phone: AccountsApi.NewPhone()), Ct), HttpStatusCode.TooManyRequests, EngagementErrors.IpLimit);
    }

    [Fact]
    public async Task Past_the_daily_notice_cap_the_request_reaches_the_inbox_without_an_sms()
    {
        var (type, name) = await NewServiceTypeAsync();
        var provider = await api.RegisterBusinessAsync();
        await api.PublishServiceAsync(provider, name, "quba", "quba");
        await using var capped = api.Variant(new Dictionary<string, string?> { ["ServiceRequests:DailyNoticeCap"] = "0" });

        var sent = await JsonAsync(await api.Client(factory: capped).PostAsJsonAsync("/api/v1/service-requests", Request(type, cityId: "quba", phone: AccountsApi.NewPhone()), Ct));

        var id = sent.GetProperty("id").GetString()!;
        Assert.Equal([provider.Id], await RecipientsAsync(id));
        await using var db = api.CreateDbContext();
        Assert.DoesNotContain(await OutboxRows.WithAsync(db, id), m => m.Type == OutboxTypes.SmsNotice);
        Assert.Contains(api.Log.Messages, m => m.Message.Contains("DailyNoticeCap", StringComparison.Ordinal) && m.Message.Contains(id, StringComparison.Ordinal));
        Assert.Equal(1, (await api.GetAsync("/api/v1/me/service-requests", provider.Token)).GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task A_blocked_providers_notice_is_not_sent()
    {
        var (type, name) = await NewServiceTypeAsync();
        var provider = await api.RegisterBusinessAsync();
        await api.PublishServiceAsync(provider, name, "seki", "seki");
        var sent = await JsonAsync(await api.Client().PostAsJsonAsync("/api/v1/service-requests", Request(type, cityId: "seki", phone: AccountsApi.NewPhone()), Ct));
        Assert.Equal([provider.Id], await RecipientsAsync(sent.GetProperty("id").GetString()!));

        var admin = await api.AdminTokenAsync();
        Assert.Equal(HttpStatusCode.OK, (await api.Client(admin).PostAsJsonAsync($"/api/v1/admin/users/{provider.UserId}/block", new { blocked = true }, Ct)).StatusCode);
        await api.DispatchOutboxAsync();

        Assert.DoesNotContain(api.Sms.To(provider.Phone), m => m.Text.Contains("sorğusu", StringComparison.Ordinal));
        await using var db = api.CreateDbContext();
        var notice = Assert.Single(await OutboxRows.WithAsync(db, sent.GetProperty("id").GetString()!), m => m.Type == OutboxTypes.SmsNotice);
        Assert.NotNull(notice.SentAt);
        Assert.StartsWith("skipped", notice.LastError, StringComparison.Ordinal);
    }
}
