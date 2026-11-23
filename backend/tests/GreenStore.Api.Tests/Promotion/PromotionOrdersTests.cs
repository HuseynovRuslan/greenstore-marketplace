using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Promotion.Payments;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Promotion;

/// <summary>
/// Buying «Önə çıxar», «İrəli çək» and the bundle (phase 5) through the fake provider, on the lifecycle database:
/// the order, the payment page, the callback, what a paid order starts, and every refusal.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class PromotionOrdersTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Fact]
    public async Task The_packages_are_the_sites_in_the_visitors_language()
    {
        var response = await api.Client().GetAsync("/api/v1/promotion-packages", Ct);
        var packages = await JsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        NoProblems(Contract.Check(packages, "PromotionPackage[]"));
        Assert.Equal(["ireli-cek", "one-cixar", "paket"], packages.EnumerateArray().Select(p => p.GetProperty("id").GetString()));
        var feature = packages.EnumerateArray().Single(p => p.GetProperty("id").GetString() == "one-cixar");
        Assert.Equal("Önə çıxar", feature.GetProperty("name").GetString());
        var week = feature.GetProperty("options").EnumerateArray().Single(o => o.GetProperty("id").GetString() == "one-cixar-7");
        Assert.Equal(("7 gün", 9m, 7), (week.GetProperty("label").GetString(), week.GetProperty("price").GetDecimal(), week.GetProperty("days").GetInt32()));
        Assert.False(week.TryGetProperty("bumps", out _));
        Assert.DoesNotContain("vip", packages.GetRawText(), StringComparison.OrdinalIgnoreCase);

        var russian = await JsonAsync(await Localized("ru"));
        Assert.Equal("Вывести в топ", russian[1].GetProperty("name").GetString());
        Assert.Equal("7 дней", russian[1].GetProperty("options")[1].GetProperty("label").GetString());
        var english = await JsonAsync(await Localized("en"));
        Assert.Equal("Feature", english[1].GetProperty("name").GetString());
    }

    [Fact]
    public async Task A_package_taken_off_sale_is_not_offered_and_cannot_be_bought()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        await using var db = api.CreateDbContext();
        await db.PromotionOptions.Where(o => o.Id == "one-cixar-15").ExecuteUpdateAsync(o => o.SetProperty(x => x.IsActive, false), Ct);
        try
        {
            var packages = await JsonAsync(await api.Client().GetAsync("/api/v1/promotion-packages", Ct));
            Assert.Equal(["one-cixar-3", "one-cixar-7"], packages[1].GetProperty("options").EnumerateArray().Select(o => o.GetProperty("id").GetString()));

            var problem = await ProblemAsync(await api.PostOrderAsync(owner.Token, id, "one-cixar-15"), HttpStatusCode.BadRequest, "validation");
            Assert.Equal("invalid", problem.GetProperty("errors").GetProperty("optionId")[0].GetString());
        }
        finally
        {
            await db.PromotionOptions.Where(o => o.Id == "one-cixar-15").ExecuteUpdateAsync(o => o.SetProperty(x => x.IsActive, true), Ct);
        }
    }

    [Fact]
    public async Task The_owner_buys_one_cixar_and_the_listing_is_featured_at_the_top_of_the_catalogue()
    {
        await using var site = api.WithSite();
        var owner = await api.RegisterBusinessAsync();
        api.Clock.Advance(TimeSpan.FromSeconds(1));
        var sent = await api.PublishAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        var slug = sent.GetProperty("slug").GetString()!;
        var now = api.Clock.Now;
        int noticesBefore;
        await using (var before = api.CreateDbContext())
        {
            noticesBefore = (await OutboxRows.WithAsync(before, $"listing:{id}")).Count;
        }

        // The order: pending, at the option's price, and the provider's page to pay on.
        var checkout = await api.OrderAsync(owner, id, "one-cixar-7", returnPath: $"/kabinet/elanlar/{slug}", factory: site);
        Assert.Equal(["order", "paymentUrl"], checkout.EnumerateObject().Select(p => p.Name));
        NoProblems(Contract.Check(checkout, "PromotionCheckout"));
        var order = checkout.GetProperty("order");
        NoProblems(Contract.Check(order, "PromotionOrder"));
        var orderId = order.GetProperty("id").GetString()!;
        Assert.Equal(
            (id, "one-cixar", "one-cixar-7", 9m, "pending"),
            (order.GetProperty("listingId").GetString(), order.GetProperty("packageId").GetString(), order.GetProperty("optionId").GetString(), order.GetProperty("amount").GetDecimal(), order.GetProperty("status").GetString()));
        Assert.True(order.GetProperty("number").GetInt64() >= 1001);
        Assert.False(order.TryGetProperty("paidAt", out _));
        Assert.StartsWith("http://localhost/api/v1/payments/fake/checkout/fake_", checkout.GetProperty("paymentUrl").GetString());

        // The fake provider's page («Test ödənişi»).
        var page = await api.RawClient(site).GetAsync(new Uri(checkout.GetProperty("paymentUrl").GetString()!).PathAndQuery, Ct);
        var html = await page.Content.ReadAsStringAsync(Ct);
        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Equal("text/html", page.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Test ödənişi", html, StringComparison.Ordinal);
        Assert.Contains("«Önə çıxar» · 7 gün", html, StringComparison.Ordinal);
        Assert.Contains("9 ₼", html, StringComparison.Ordinal);
        Assert.DoesNotContain("vip", html, StringComparison.OrdinalIgnoreCase);

        // «Ödə»: the callback is applied and the visitor goes back to the page they came from.
        var paid = await api.AnswerCheckoutAsync(checkout, paid: true, site);
        Assert.Equal(HttpStatusCode.SeeOther, paid.StatusCode);
        Assert.Equal($"{PromotionApi.Site}/kabinet/elanlar/{slug}?order={orderId}&payment=paid", paid.Headers.Location?.ToString());

        var stored = await api.GetAsync($"/api/v1/me/promotion-orders/{orderId}", owner.Token);
        NoProblems(Contract.Check(stored, "PromotionOrder"));
        Assert.Equal(("paid", now), (stored.GetProperty("status").GetString(), stored.GetProperty("paidAt").GetDateTimeOffset()));

        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        NoProblems(Contract.CheckOwnListing(own));
        Assert.True(own.GetProperty("vip").GetBoolean());
        Assert.Equal("one-cixar", own.GetProperty("promotion").GetProperty("packageId").GetString());
        Assert.Equal(now.AddDays(7), own.GetProperty("promotion").GetProperty("until").GetDateTimeOffset());

        // «Önə çıxan» at the top of /elanlar and on the home page.
        var catalogue = await JsonAsync(await api.Client().GetAsync("/api/v1/listings?sort=newest", Ct));
        Assert.Equal(id, catalogue.GetProperty("items")[0].GetProperty("id").GetString());
        Assert.True(catalogue.GetProperty("items")[0].GetProperty("vip").GetBoolean());
        var home = await JsonAsync(await api.Client().GetAsync("/api/v1/home", Ct));
        Assert.Contains(home.GetProperty("vip").EnumerateArray(), l => l.GetProperty("id").GetString() == id);

        await using var db = api.CreateDbContext();
        var rows = await db.ListingPromotions.AsNoTracking().Where(p => p.ListingId == Guid.Parse(id)).ToListAsync(Ct);
        var row = Assert.Single(rows);
        Assert.Equal((PromotionKind.Feature, now, now.AddDays(7), (short)0), (row.Kind, row.StartsAt, row.EndsAt, row.BumpsLeft));
        var events = await db.PaymentEvents.AsNoTracking().Where(e => e.ProviderRef == PromotionApi.ReferenceOf(checkout)).ToListAsync(Ct);
        var paymentEvent = Assert.Single(events);
        Assert.Equal(("fake", FakePaymentGateway.Succeeded, true, (DateTimeOffset?)now), (paymentEvent.Provider, paymentEvent.EventType, paymentEvent.SignatureOk, paymentEvent.ProcessedAt));
        // The site is told to refresh the listing's pages, the catalogue and the home page.
        var notices = await OutboxRows.WithAsync(db, $"listing:{id}");
        Assert.Equal(noticesBefore + 1, notices.Count);
        Assert.Contains("\"home\"", notices[^1].Payload, StringComparison.Ordinal);
    }

    [Fact]
    public async Task The_last_listing_to_pay_tops_the_promoted_group_and_the_home_page_whatever_its_date()
    {
        var first = await api.RegisterAsync();
        var last = await api.RegisterAsync();
        var earlier = (await api.PublishAsync(first)).GetProperty("id").GetString()!;
        var older = (await api.PublishAsync(last)).GetProperty("id").GetString()!;
        await using var db = api.CreateDbContext();
        // The listing that pays last is the oldest on the site: its own date would put it under every «Önə çıxan».
        var oldest = await db.Listings.MinAsync(l => l.SortAt, Ct);
        await db.Listings.Where(l => l.Id == Guid.Parse(older)).ExecuteUpdateAsync(l => l.SetProperty(x => x.SortAt, oldest!.Value.AddDays(-1)), Ct);

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        await api.PayAsync(await api.OrderAsync(first, earlier, "one-cixar-7"));
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var paidAt = api.Clock.Now;
        await api.PayAsync(await api.OrderAsync(last, older, "one-cixar-3"));

        var catalogue = await JsonAsync(await api.Client().GetAsync("/api/v1/listings?sort=newest", Ct));
        Assert.Equal([older, earlier], catalogue.GetProperty("items").EnumerateArray().Take(2).Select(l => l.GetProperty("id").GetString()));
        var promotedOnly = await JsonAsync(await api.Client().GetAsync("/api/v1/listings?promoted=true", Ct));
        Assert.Equal(older, promotedOnly.GetProperty("items")[0].GetProperty("id").GetString());
        var home = await JsonAsync(await api.Client().GetAsync("/api/v1/home", Ct));
        Assert.Equal([older, earlier], home.GetProperty("vip").EnumerateArray().Take(2).Select(l => l.GetProperty("id").GetString()));
        Assert.DoesNotContain(home.GetProperty("latest").EnumerateArray(), l => l.GetProperty("id").GetString() == older);
        Assert.Equal((DateTimeOffset?)paidAt, (await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(older), Ct)).PromotedAt);
    }

    [Fact]
    public async Task Days_bought_on_top_of_a_running_one_cixar_keep_its_place_in_the_group()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var began = api.Clock.Now;
        await api.PayAsync(await api.OrderAsync(owner, id, "one-cixar-3"));
        api.Clock.Advance(TimeSpan.FromHours(1));

        await api.PayAsync(await api.OrderAsync(owner, id, "one-cixar-7"));

        await using var db = api.CreateDbContext();
        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal(((DateTimeOffset?)began, (DateTimeOffset?)began.AddDays(10)), (listing.PromotedAt, listing.PromotedUntil));
    }

    [Fact]
    public async Task A_listing_promoted_without_an_end_stays_promoted_after_buying_one_cixar()
    {
        var owner = await api.RegisterAsync();
        var id = Guid.Parse((await api.PublishAsync(owner)).GetProperty("id").GetString()!);
        await using var db = api.CreateDbContext();
        // As the demo data's «Önə çıxan»: promoted, no end.
        var since = api.Clock.Now.AddDays(-5);
        await db.Listings.Where(l => l.Id == id).ExecuteUpdateAsync(l => l.SetProperty(x => x.IsPromoted, true).SetProperty(x => x.PromotedAt, since), Ct);
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var now = api.Clock.Now;

        await api.PayAsync(await api.OrderAsync(owner, id.ToString(), "one-cixar-3"));

        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == id, Ct);
        Assert.Equal((true, (DateTimeOffset?)null, (DateTimeOffset?)now), (listing.IsPromoted, listing.PromotedUntil, listing.PromotedAt));
        var row = await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == id, Ct);
        Assert.Equal((now, now.AddDays(3)), (row.StartsAt, row.EndsAt));
        Assert.Equal("one-cixar", (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("promotion").GetProperty("packageId").GetString());
    }

    [Fact]
    public async Task A_repeated_callback_does_not_apply_twice()
    {
        await using var factory = api.Variant();
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-3", factory: factory);
        await api.PayAsync(checkout, factory);
        var until = (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("promotion").GetProperty("until").GetDateTimeOffset();
        api.Clock.Advance(TimeSpan.FromMinutes(5));

        // The page answered again, the provider's own retry, and five at the same moment.
        await api.PayAsync(checkout, factory);
        var body = FakePaymentGateway.CallbackBody(PromotionApi.ReferenceOf(checkout), Guid.Parse(PromotionApi.OrderIdOf(checkout)), 5, paid: true);
        var retry = await api.CallbackAsync(factory, body);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var answer = await JsonAsync(retry);
        Assert.Equal((PromotionApi.OrderIdOf(checkout), "paid"), (answer.GetProperty("orderId").GetString(), answer.GetProperty("status").GetString()));
        var together = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => api.CallbackAsync(factory, body)));
        Assert.All(together, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        await using var db = api.CreateDbContext();
        Assert.Single(await db.ListingPromotions.AsNoTracking().Where(p => p.ListingId == Guid.Parse(id)).ToListAsync(Ct));
        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal(until, listing.PromotedUntil);
        var events = await db.PaymentEvents.AsNoTracking().Where(e => e.ProviderRef == PromotionApi.ReferenceOf(checkout)).ToListAsync(Ct);
        Assert.Equal(8, events.Count);
        Assert.All(events, e => Assert.True(e.SignatureOk && e.ProcessedAt is not null));
        var order = await db.PromotionOrders.AsNoTracking().SingleAsync(o => o.Id == Guid.Parse(PromotionApi.OrderIdOf(checkout)), Ct);
        Assert.Equal(until.AddDays(-3), order.PaidAt);
    }

    [Fact]
    public async Task A_declined_payment_changes_nothing_and_a_later_payment_still_counts()
    {
        await using var site = api.WithSite();
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-7", factory: site);
        var orderId = PromotionApi.OrderIdOf(checkout);

        var declined = await api.AnswerCheckoutAsync(checkout, paid: false, site);
        Assert.Equal(HttpStatusCode.SeeOther, declined.StatusCode);
        Assert.Equal($"{PromotionApi.Site}/kabinet?order={orderId}&payment=failed", declined.Headers.Location?.ToString());
        Assert.Equal("failed", (await api.GetAsync($"/api/v1/me/promotion-orders/{orderId}", owner.Token)).GetProperty("status").GetString());
        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.False(own.GetProperty("vip").GetBoolean());
        Assert.False(own.TryGetProperty("promotion", out _));

        // The provider confirms the money after all: it is applied.
        var body = FakePaymentGateway.CallbackBody(PromotionApi.ReferenceOf(checkout), Guid.Parse(orderId), 9, paid: true);
        Assert.Equal(HttpStatusCode.OK, (await api.CallbackAsync(site, body)).StatusCode);
        Assert.True((await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("vip").GetBoolean());

        // A «failed» after the payment does not undo it.
        var late = FakePaymentGateway.CallbackBody(PromotionApi.ReferenceOf(checkout), Guid.Parse(orderId), 9, paid: false);
        Assert.Equal("paid", (await JsonAsync(await api.CallbackAsync(site, late))).GetProperty("status").GetString());
        Assert.True((await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("vip").GetBoolean());
    }

    [Fact]
    public async Task A_callback_with_a_wrong_signature_is_kept_but_not_applied()
    {
        await using var factory = api.Variant();
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-3", factory: factory);
        var reference = PromotionApi.ReferenceOf(checkout);
        var body = FakePaymentGateway.CallbackBody(reference, Guid.Parse(PromotionApi.OrderIdOf(checkout)), 5, paid: true);

        await ProblemAsync(await api.CallbackAsync(factory, body, signature: new string('0', 64)), HttpStatusCode.Unauthorized, PromotionErrors.BadSignature);
        await ProblemAsync(await api.CallbackAsync(factory, "garbage " + reference, signature: "zz"), HttpStatusCode.Unauthorized, PromotionErrors.BadSignature);

        await using var db = api.CreateDbContext();
        var forged = await db.PaymentEvents.AsNoTracking().SingleAsync(e => e.ProviderRef == reference, Ct);
        Assert.Equal((false, (DateTimeOffset?)null), (forged.SignatureOk, forged.ProcessedAt));
        using (var payload = JsonDocument.Parse(forged.Payload))
        {
            Assert.Equal(reference, payload.RootElement.GetProperty("providerRef").GetString());
        }

        var raw = (await db.PaymentEvents.AsNoTracking().ToListAsync(Ct)).Single(e => e.Payload.Contains("garbage " + reference, StringComparison.Ordinal));
        Assert.Equal($"garbage {reference}", JsonDocument.Parse(raw.Payload).RootElement.GetProperty("raw").GetString());

        // Anyone can post junk: only its beginning is kept (a surrogate pair is never cut in half).
        var junk = $"big {reference} " + new string('x', PromotionService.MaxUnsignedPayloadChars - reference.Length - 6) + "🌳" + new string('y', 5000);
        await ProblemAsync(await api.CallbackAsync(factory, junk, signature: "zz"), HttpStatusCode.Unauthorized, PromotionErrors.BadSignature);
        var big = (await db.PaymentEvents.AsNoTracking().ToListAsync(Ct)).Single(e => e.Payload.Contains($"big {reference}", StringComparison.Ordinal));
        using (var payload = JsonDocument.Parse(big.Payload))
        {
            Assert.True(payload.RootElement.GetProperty("truncated").GetBoolean());
            Assert.Equal(junk[..(PromotionService.MaxUnsignedPayloadChars - 1)], payload.RootElement.GetProperty("raw").GetString());
        }
        Assert.Equal(PromotionOrderStatus.Pending, (await db.PromotionOrders.AsNoTracking().SingleAsync(o => o.ProviderRef == reference, Ct)).Status);
        Assert.False((await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct)).IsPromoted);
    }

    [Fact]
    public async Task Callbacks_that_name_nothing_known_are_refused()
    {
        await using var factory = api.Variant();
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-7", factory: factory);
        var reference = PromotionApi.ReferenceOf(checkout);
        var orderId = Guid.Parse(PromotionApi.OrderIdOf(checkout));

        await ProblemAsync(await api.CallbackAsync(factory, "{}", provider: "acme"), HttpStatusCode.NotFound, PromotionErrors.UnknownProvider);
        await ProblemAsync(await api.CallbackAsync(factory, FakePaymentGateway.CallbackBody("fake_unknown", orderId, 9, paid: true)), HttpStatusCode.NotFound, PromotionErrors.OrderNotFound);
        await ProblemAsync(await api.CallbackAsync(factory, """{"event":"payment.succeeded"}"""), HttpStatusCode.BadRequest, PromotionErrors.MissingReference);
        await ProblemAsync(await api.CallbackAsync(factory, FakePaymentGateway.CallbackBody(reference, orderId, 1, paid: true)), HttpStatusCode.Conflict, PromotionErrors.AmountMismatch);
        Assert.Contains(api.Log.Messages, m => m.Message.Contains("says 1 AZN was paid", StringComparison.Ordinal));

        await using var db = api.CreateDbContext();
        Assert.Equal(PromotionOrderStatus.Pending, (await db.PromotionOrders.AsNoTracking().SingleAsync(o => o.Id == orderId, Ct)).Status);
        Assert.False((await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct)).IsPromoted);
        Assert.True(await db.PaymentEvents.AnyAsync(e => e.ProviderRef == "fake_unknown" && e.ProcessedAt == null, Ct));
        // A callback bigger than any provider sends is not read at all.
        await ProblemAsync(await api.CallbackAsync(factory, new string('x', PromotionEndpoints.MaxCallbackBytes + 1)), HttpStatusCode.RequestEntityTooLarge, "payload-too-large");
    }

    [Fact]
    public async Task Only_the_owner_can_order_and_only_for_an_active_listing()
    {
        var owner = await api.RegisterAsync();
        var stranger = await api.RegisterAsync();
        var active = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var pending = (await api.SubmitAsync(owner)).GetProperty("id").GetString()!;

        var anonymous = await api.Client().PostAsJsonAsync("/api/v1/promotion-orders", new { listingId = active, packageId = "one-cixar", optionId = "one-cixar-7" }, Ct);
        await ProblemAsync(anonymous, HttpStatusCode.Unauthorized, "unauthorized");
        await ProblemAsync(await api.PostOrderAsync(stranger.Token, active, "one-cixar-7"), HttpStatusCode.NotFound, "listing.not-found");
        await ProblemAsync(await api.PostOrderAsync(owner.Token, Guid.CreateVersion7().ToString(), "one-cixar-7"), HttpStatusCode.NotFound, "listing.not-found");
        var wrongStatus = await ProblemAsync(await api.PostOrderAsync(owner.Token, pending, "one-cixar-7"), HttpStatusCode.Conflict, "listing.wrong-status");
        Assert.Equal("pending", wrongStatus.GetProperty("listingStatus").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(owner.Token).DeleteAsync($"/api/v1/me/listings/{active}", Ct)).StatusCode);
        await ProblemAsync(await api.PostOrderAsync(owner.Token, active, "one-cixar-7"), HttpStatusCode.NotFound, "listing.not-found");

        await using var db = api.CreateDbContext();
        Assert.False(await db.PromotionOrders.AnyAsync(o => o.UserId == owner.Id || o.UserId == stranger.Id, Ct));
    }

    [Theory]
    [InlineData("{}", "listingId", "required")]
    [InlineData("""{"listingId":"x","packageId":"one-cixar","optionId":"one-cixar-7"}""", "listingId", "invalid")]
    [InlineData("""{"listingId":"LISTING","optionId":"one-cixar-7"}""", "packageId", "required")]
    [InlineData("""{"listingId":"LISTING","packageId":"vip","optionId":"one-cixar-7"}""", "packageId", "invalid")]
    [InlineData("""{"listingId":"LISTING","packageId":"one-cixar"}""", "optionId", "required")]
    [InlineData("""{"listingId":"LISTING","packageId":"one-cixar","optionId":"paket-7"}""", "optionId", "invalid")]
    [InlineData("""{"listingId":"LISTING","packageId":"one-cixar","optionId":"one-cixar-7","returnPath":"//evil.example"}""", "returnPath", "invalid")]
    public async Task A_wrong_order_is_refused_field_by_field(string json, string field, string code)
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        using var content = new StringContent(json.Replace("LISTING", id, StringComparison.Ordinal), System.Text.Encoding.UTF8, "application/json");

        var problem = await ProblemAsync(await api.Client(owner.Token).PostAsync("/api/v1/promotion-orders", content, Ct), HttpStatusCode.BadRequest, "validation");

        Assert.Equal(code, problem.GetProperty("errors").GetProperty(field)[0].GetString());
    }

    [Fact]
    public async Task The_same_idempotency_key_answers_the_same_order()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var key = $"reklam-{Guid.NewGuid()}";

        var first = await api.OrderAsync(owner, id, "one-cixar-7", key: key);
        var again = await api.OrderAsync(owner, id, "one-cixar-7", key: key);

        Assert.Equal(
            (PromotionApi.OrderIdOf(first), first.GetProperty("paymentUrl").GetString()),
            (PromotionApi.OrderIdOf(again), again.GetProperty("paymentUrl").GetString()));
        await ProblemAsync(await api.PostOrderAsync(owner.Token, id, "one-cixar-3", key: key), (HttpStatusCode)422, "idempotency.key-reused");
        await using var db = api.CreateDbContext();
        Assert.Equal(1, await db.PromotionOrders.CountAsync(o => o.ListingId == Guid.Parse(id), Ct));
    }

    [Fact]
    public async Task An_account_cannot_open_endless_unpaid_orders()
    {
        await using var factory = api.Variant(new Dictionary<string, string?> { ["Payments:MaxPendingOrdersPerDay"] = "2" });
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        await api.OrderAsync(owner, id, "one-cixar-7", factory: factory);
        var paid = await api.OrderAsync(owner, id, "one-cixar-3", factory: factory);
        await api.PayAsync(paid, factory);
        await api.OrderAsync(owner, id, "one-cixar-3", factory: factory);

        var response = await api.PostOrderAsync(owner.Token, id, "one-cixar-7", factory: factory);

        await ProblemAsync(response, HttpStatusCode.TooManyRequests, PromotionErrors.TooManyOrders);
        Assert.NotNull(response.Headers.RetryAfter);
    }

    [Fact]
    public async Task Production_takes_no_fake_payment()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-7");
        await using var variant = api.Variant(new Dictionary<string, string?> { ["Otp:ExposeDemoCode"] = "false" });
        await using var production = variant.WithWebHostBuilder(builder => builder.UseEnvironment("Production"));

        await ProblemAsync(await api.PostOrderAsync(owner.Token, id, "one-cixar-7", factory: production), HttpStatusCode.ServiceUnavailable, PromotionErrors.Unavailable);
        var body = FakePaymentGateway.CallbackBody(PromotionApi.ReferenceOf(checkout), Guid.Parse(PromotionApi.OrderIdOf(checkout)), 9, paid: true);
        using var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        await ProblemAsync(await api.RawClient(production).PostAsync("/api/v1/payments/fake/callback", content, Ct), HttpStatusCode.NotFound, PromotionErrors.UnknownProvider);
        await ProblemAsync(await api.RawClient(production).GetAsync(new Uri(checkout.GetProperty("paymentUrl").GetString()!).PathAndQuery, Ct), HttpStatusCode.NotFound, PromotionErrors.UnknownProvider);
        await ProblemAsync(await api.AnswerCheckoutAsync(checkout, paid: true, production), HttpStatusCode.NotFound, PromotionErrors.UnknownProvider);
        // Nothing can be bought, so nothing is offered: the site shows no prices and no paid choice.
        var packages = await api.RawClient(production).GetAsync("/api/v1/promotion-packages", Ct);
        Assert.Equal(HttpStatusCode.OK, packages.StatusCode);
        Assert.Equal(0, (await JsonAsync(packages)).GetArrayLength());
        Assert.Contains(api.Log.Messages, m => m.Message.Contains("cannot be used here", StringComparison.Ordinal));
    }

    [Fact]
    public async Task The_bundle_starts_a_feature_and_lifts_the_listing_at_once()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var now = api.Clock.Now;

        await api.PayAsync(await api.OrderAsync(owner, id, "paket-7"));

        await using var db = api.CreateDbContext();
        var rows = (await db.ListingPromotions.AsNoTracking().Where(p => p.ListingId == Guid.Parse(id)).ToListAsync(Ct)).OrderBy(p => p.Kind).ToList();
        Assert.Equal(
            [(PromotionKind.Feature, now, now.AddDays(7), (short)0, (DateTimeOffset?)null), (PromotionKind.Bump, now, now.AddDays(7), (short)6, now.AddDays(1))],
            rows.Select(r => (r.Kind, r.StartsAt, r.EndsAt, r.BumpsLeft, r.NextBumpAt)));
        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal((true, (DateTimeOffset?)now.AddDays(7), (DateTimeOffset?)now, (DateTimeOffset?)now), (listing.IsPromoted, listing.PromotedUntil, listing.SortAt, listing.BumpedAt));
        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal(("paket", now.AddDays(7)), (own.GetProperty("promotion").GetProperty("packageId").GetString(), own.GetProperty("promotion").GetProperty("until").GetDateTimeOffset()));
        Assert.Equal(now, own.GetProperty("bumpedAt").GetDateTimeOffset());
    }

    [Fact]
    public async Task Ireli_cek_once_lifts_the_listing_to_the_top_of_the_newest()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        await using var db = api.CreateDbContext();
        await db.Listings.Where(l => l.Id == Guid.Parse(id)).ExecuteUpdateAsync(l => l.SetProperty(x => x.SortAt, api.Clock.Now.AddDays(-10)), Ct);
        api.Clock.Advance(TimeSpan.FromMinutes(1));
        var now = api.Clock.Now;

        await api.PayAsync(await api.OrderAsync(owner, id, "ireli-cek-1"));

        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal((false, (DateTimeOffset?)now, (DateTimeOffset?)now), (listing.IsPromoted, listing.SortAt, listing.BumpedAt));
        var row = await db.ListingPromotions.AsNoTracking().SingleAsync(p => p.ListingId == Guid.Parse(id), Ct);
        Assert.Equal((PromotionKind.Bump, (short)0, (DateTimeOffset?)null, now.AddDays(1)), (row.Kind, row.BumpsLeft, row.NextBumpAt, row.EndsAt));
        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal("ireli-cek", own.GetProperty("promotion").GetProperty("packageId").GetString());
        var newest = await JsonAsync(await api.Client().GetAsync("/api/v1/listings?sort=newest&pageSize=60", Ct));
        var firstPlain = newest.GetProperty("items").EnumerateArray().First(l => !l.GetProperty("vip").GetBoolean());
        Assert.Equal(id, firstPlain.GetProperty("id").GetString());
    }

    [Fact]
    public async Task One_cixar_bought_twice_runs_one_after_the_other_and_keeps_the_listing_online()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        await using var db = api.CreateDbContext();
        // Two days of the 30 left: the paid days reach past them.
        await db.Listings.Where(l => l.Id == Guid.Parse(id)).ExecuteUpdateAsync(l => l.SetProperty(x => x.ExpiresAt, api.Clock.Now.AddDays(2)), Ct);
        var now = api.Clock.Now;

        await api.PayAsync(await api.OrderAsync(owner, id, "one-cixar-3"));
        await api.PayAsync(await api.OrderAsync(owner, id, "one-cixar-15"));

        var rows = await db.ListingPromotions.AsNoTracking().Where(p => p.ListingId == Guid.Parse(id)).OrderBy(p => p.StartsAt).ToListAsync(Ct);
        Assert.Equal([(now, now.AddDays(3)), (now.AddDays(3), now.AddDays(18))], rows.Select(r => (r.StartsAt, r.EndsAt)));
        var listing = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal(((DateTimeOffset?)now.AddDays(18), (DateTimeOffset?)now.AddDays(18)), (listing.PromotedUntil, listing.ExpiresAt));
    }

    [Fact]
    public async Task A_promotion_chosen_while_posting_waits_for_the_payment_after_approval()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.SubmitAsync(owner, i => i["promotion"] = new JsonObject { ["packageId"] = "paket", ["optionId"] = "paket-7" });
        var id = sent.GetProperty("id").GetString()!;

        var own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        NoProblems(Contract.CheckOwnListing(own));
        Assert.Equal(("paket", "paket-7"), (own.GetProperty("pendingPromotion").GetProperty("packageId").GetString(), own.GetProperty("pendingPromotion").GetProperty("optionId").GetString()));
        var all = await api.GetAsync("/api/v1/me/listings", owner.Token);
        Assert.Equal("paket-7", all.EnumerateArray().Single(l => l.GetProperty("id").GetString() == id).GetProperty("pendingPromotion").GetProperty("optionId").GetString());
        await ProblemAsync(await api.PostOrderAsync(owner.Token, id, "paket-7"), HttpStatusCode.Conflict, "listing.wrong-status");

        // Approved: the choice is still there until it is paid, and the moderator's view does not show it.
        await api.ApproveAsync(id);
        Assert.True((await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).TryGetProperty("pendingPromotion", out _));
        Assert.False((await api.ModerationItemAsync(await api.ModeratorTokenAsync(), id)).GetProperty("listing").TryGetProperty("pendingPromotion", out _));
        await api.PayAsync(await api.OrderAsync(owner, id, "paket-7"));

        own = await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.False(own.TryGetProperty("pendingPromotion", out _));
        Assert.Equal("paket", own.GetProperty("promotion").GetProperty("packageId").GetString());
    }

    [Theory]
    [InlineData("one-cixar", "paket-7")]
    [InlineData("one-cixar", "one-cixar-99")]
    [InlineData("vip", "vip-7")]
    public async Task A_promotion_choice_that_is_not_on_offer_is_refused(string package, string option)
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);
        var input = LifecycleApi.TreeInput([photo], owner.Phone, i => i["promotion"] = new JsonObject { ["packageId"] = package, ["optionId"] = option });

        var problem = await ProblemAsync(await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", input, Ct), HttpStatusCode.BadRequest, "validation");

        Assert.Equal("invalid", problem.GetProperty("errors").GetProperty("promotion")[0].GetString());
    }

    [Fact]
    public async Task An_edit_says_what_is_chosen_now()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.SubmitAsync(owner, i => i["promotion"] = new JsonObject { ["packageId"] = "one-cixar", ["optionId"] = "one-cixar-3" })).GetProperty("id").GetString()!;
        var photos = (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("photoIds").EnumerateArray().Select(p => p.GetString()!).ToList();

        var changed = await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput(photos, owner.Phone, i => i["promotion"] = new JsonObject { ["packageId"] = "ireli-cek", ["optionId"] = "ireli-cek-5" }), Ct);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        Assert.Equal("ireli-cek-5", (await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("pendingPromotion").GetProperty("optionId").GetString());

        // «Pulsuz yerləşdir»: no promotion in the form clears the choice.
        Assert.Equal(HttpStatusCode.OK, (await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", LifecycleApi.TreeInput(photos, owner.Phone), Ct)).StatusCode);
        Assert.False((await api.GetAsync($"/api/v1/me/listings/{id}", owner.Token)).TryGetProperty("pendingPromotion", out _));
    }

    [Fact]
    public async Task Public_reads_never_show_the_owners_promotion_fields()
    {
        var owner = await api.RegisterAsync();
        var sent = await api.PublishAsync(owner);
        var id = sent.GetProperty("id").GetString()!;
        await api.PayAsync(await api.OrderAsync(owner, id, "one-cixar-3"));

        var page = await JsonAsync(await api.Client().GetAsync($"/api/v1/listings/{sent.GetProperty("slug").GetString()}", Ct));

        Assert.True(page.GetProperty("vip").GetBoolean());
        Assert.False(page.TryGetProperty("promotion", out _));
        Assert.False(page.TryGetProperty("pendingPromotion", out _));
    }

    [Fact]
    public async Task An_order_is_its_buyers_only()
    {
        var owner = await api.RegisterAsync();
        var stranger = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var orderId = PromotionApi.OrderIdOf(await api.OrderAsync(owner, id, "one-cixar-3"));

        await ProblemAsync(await api.Client(stranger.Token).GetAsync($"/api/v1/me/promotion-orders/{orderId}", Ct), HttpStatusCode.NotFound, PromotionErrors.OrderNotFound);
        await ProblemAsync(await api.Client(owner.Token).GetAsync($"/api/v1/me/promotion-orders/{Guid.CreateVersion7()}", Ct), HttpStatusCode.NotFound, PromotionErrors.OrderNotFound);
        Assert.Equal("pending", (await api.GetAsync($"/api/v1/me/promotion-orders/{orderId}", owner.Token)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task The_checkout_page_needs_a_known_payment_and_an_answer()
    {
        var owner = await api.RegisterAsync();
        var id = (await api.PublishAsync(owner)).GetProperty("id").GetString()!;
        var checkout = await api.OrderAsync(owner, id, "one-cixar-3");
        var path = new Uri(checkout.GetProperty("paymentUrl").GetString()!).AbsolutePath;
        using var empty = new FormUrlEncodedContent([]);

        await ProblemAsync(await api.RawClient().GetAsync("/api/v1/payments/fake/checkout/fake_unknown", Ct), HttpStatusCode.NotFound, PromotionErrors.OrderNotFound);
        var wrong = await ProblemAsync(await api.RawClient().PostAsync($"{path}?result=maybe", empty, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal("invalid", wrong.GetProperty("errors").GetProperty("result")[0].GetString());

        // Without Frontend:BaseUrl the answer is the callback's own.
        var paid = await api.RawClient().PostAsync($"{path}?result=paid&return=%2F%2Fevil.example", empty, Ct);
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);
        Assert.Equal("paid", (await JsonAsync(paid)).GetProperty("status").GetString());

        // Paid: the page says so and offers nothing more; a crafted return path never leaves the site.
        await using var site = api.WithSite();
        var html = await (await api.RawClient(site).GetAsync(path, Ct)).Content.ReadAsStringAsync(Ct);
        Assert.Contains("Ödənilib", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<form", html, StringComparison.Ordinal);
        var again = await api.RawClient(site, followRedirects: false).PostAsync($"{path}?result=paid&return=%2F%2Fevil.example", empty, Ct);
        Assert.Equal(HttpStatusCode.SeeOther, again.StatusCode);
        Assert.Equal($"{PromotionApi.Site}/kabinet?payment=paid", again.Headers.Location?.ToString());
    }

    private Task<HttpResponseMessage> Localized(string language)
    {
        var client = api.Client();
        client.DefaultRequestHeaders.Add("Accept-Language", language);
        return client.GetAsync("/api/v1/promotion-packages", Ct);
    }

    private static void NoProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));
}
