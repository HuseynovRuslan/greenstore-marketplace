using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GreenStore.Api.Modules.Promotion.Payments;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>Buying promotions on the lifecycle database (phase 5): orders, the fake provider's page and its callbacks.</summary>
public static class PromotionApi
{
    /// <summary>The site the fake provider brings the visitor back to, in the tests that follow the redirect.</summary>
    public const string Site = "http://site.test";

    /// <summary>The API with <c>Frontend:BaseUrl</c> set, so the fake payment page redirects back to <see cref="Site"/>.</summary>
    public static WebApplicationFactory<Program> WithSite(this LifecycleApi api, IDictionary<string, string?>? settings = null)
    {
        var all = new Dictionary<string, string?>(settings ?? new Dictionary<string, string?>()) { ["Frontend:BaseUrl"] = Site };
        return api.Variant(all);
    }

    /// <summary><c>POST /promotion-orders</c>; asserts 201 and returns <c>{ order, paymentUrl }</c>.</summary>
    public static async Task<JsonElement> OrderAsync(
        this LifecycleApi api,
        Account owner,
        string listingId,
        string optionId,
        string? returnPath = null,
        string? key = null,
        WebApplicationFactory<Program>? factory = null)
    {
        var response = await api.PostOrderAsync(owner.Token, listingId, optionId, returnPath, key, factory);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /promotion-orders: {(int)response.StatusCode} {body}");
        return body;
    }

    public static async Task<HttpResponseMessage> PostOrderAsync(
        this LifecycleApi api,
        string token,
        string listingId,
        string optionId,
        string? returnPath = null,
        string? key = null,
        WebApplicationFactory<Program>? factory = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/promotion-orders")
        {
            Content = JsonContent.Create(new { listingId, packageId = PackageOf(optionId), optionId, returnPath }),
        };
        if (key is not null)
        {
            request.Headers.Add("Idempotency-Key", key);
        }

        return await api.Client(token, factory: factory).SendAsync(request, Ct);
    }

    /// <summary>«one-cixar-7» → «one-cixar».</summary>
    public static string PackageOf(string optionId) => optionId[..optionId.LastIndexOf('-')];

    /// <summary>«Ödə» (<paramref name="paid"/>) or «İmtina et» on the fake provider's page, as the browser's form sends it.</summary>
    public static async Task<HttpResponseMessage> AnswerCheckoutAsync(this LifecycleApi api, JsonElement checkout, bool paid = true, WebApplicationFactory<Program>? factory = null)
    {
        var url = new Uri(checkout.GetProperty("paymentUrl").GetString()!);
        using var content = new FormUrlEncodedContent([]);
        return await api.RawClient(factory, followRedirects: false).PostAsync($"{url.PathAndQuery}&result={(paid ? "paid" : "failed")}", content, Ct);
    }

    /// <summary>Pays the order on the fake page; asserts the answer (200 without a site, 303 with one).</summary>
    public static async Task PayAsync(this LifecycleApi api, JsonElement checkout, WebApplicationFactory<Program>? factory = null)
    {
        var response = await api.AnswerCheckoutAsync(checkout, paid: true, factory);
        Assert.True(response.StatusCode is HttpStatusCode.OK or HttpStatusCode.SeeOther, $"fake checkout: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync(Ct)}");
    }

    /// <summary>The fake provider of the API (its signing key is the test settings' own).</summary>
    public static FakePaymentGateway Fake(this WebApplicationFactory<Program> factory) =>
        factory.Services.GetRequiredService<PaymentGateways>().Fake!;

    /// <summary><c>POST /payments/fake/callback</c> with <paramref name="body"/>, signed by the API's fake provider unless <paramref name="signature"/> is given.</summary>
    public static async Task<HttpResponseMessage> CallbackAsync(this LifecycleApi api, WebApplicationFactory<Program> factory, string body, string? signature = null, string provider = "fake")
    {
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        content.Headers.Add(FakePaymentGateway.SignatureHeader, signature ?? factory.Fake().Sign(body));
        return await api.RawClient(factory).PostAsync($"/api/v1/payments/{provider}/callback", content, Ct);
    }

    /// <summary>The provider reference of the order (the end of its payment page address).</summary>
    public static string ReferenceOf(JsonElement checkout) =>
        new Uri(checkout.GetProperty("paymentUrl").GetString()!).AbsolutePath.Split('/')[^1];

    public static string OrderIdOf(JsonElement checkout) => checkout.GetProperty("order").GetProperty("id").GetString()!;
}
