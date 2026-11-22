using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Http;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Promotion.Payments;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// «Önə çıxar», «İrəli çək» and the bundle (ARCHITECTURE.md §7, backend-contract.md 5.1): the packages with their
/// prices, an order for the owner's active listing with the provider's payment page, the provider's callback, and the
/// fake provider's «Test ödənişi» page (Development and Staging).
/// </summary>
public static class PromotionEndpoints
{
    /// <summary>The largest callback body read (providers send a few hundred bytes).</summary>
    public const int MaxCallbackBytes = 64 * 1024;

    /// <summary>The «Test ödənişi» page's text: only the characters HTML needs escaped; letters stay as they are.</summary>
    private static readonly HtmlEncoder Html = HtmlEncoder.Create(UnicodeRanges.All);

    public static RouteGroupBuilder MapPromotion(this RouteGroupBuilder api)
    {
        api.MapGet("/promotion-packages", Packages).WithTags("Promotion");
        api.MapPost("/promotion-orders", CreateOrder).WithTags("Promotion").RequireAuthorization()
            .Produces<PromotionCheckoutDto>(StatusCodes.Status201Created);
        api.MapGet("/me/promotion-orders/{id:guid}", Order).WithTags("Me").RequireAuthorization();
        api.MapPost("/payments/{provider}/callback", Callback).WithTags("Payments").RequireRateLimiting(RateLimitPolicies.PaymentCallbacks);
        api.MapGet($"{FakePaymentGateway.CheckoutPath}/{{reference}}", FakeCheckoutPage).WithTags("Payments");
        api.MapPost($"{FakePaymentGateway.CheckoutPath}/{{reference}}", FakeCheckoutAnswer).WithTags("Payments")
            .RequireRateLimiting(RateLimitPolicies.AnonymousWrites);
        return api;
    }

    /// <summary>
    /// <c>GET /promotion-packages</c> → <c>PromotionPackage[]</c> in the request's language: the packages on offer, each
    /// with its options on offer, in the site's order (<c>listPromotionPackages</c>). Empty while no payment provider
    /// can be used here (Production until a real one is added): nothing could be bought, so the site sells nothing.
    /// </summary>
    private static async Task<Ok<List<PromotionPackageDto>>> Packages(HttpContext http, AppDbContext db, PaymentGateways gateways, CancellationToken ct)
    {
        if (gateways.Current is null)
        {
            return TypedResults.Ok(new List<PromotionPackageDto>());
        }

        var catalogue = await PromotionCatalogue.LoadAsync(db, ct);
        var language = http.GetLanguage();
        return TypedResults.Ok(catalogue.OnOffer().Select(p => p.Package.ToDto(p.Options, language)).ToList());
    }

    /// <summary>
    /// <c>POST /promotion-orders</c> <c>{ listingId, packageId, optionId, returnPath? }</c> → 201 <c>{ order,
    /// paymentUrl }</c>: the order (<c>status: "pending"</c>, the amount is the option's price now) and the provider's
    /// page to send the visitor to; after paying, the provider brings them back to <c>returnPath</c> on the site with
    /// <c>?order=&lt;id&gt;</c>. Takes an <c>Idempotency-Key</c> header. Only the owner's active listing. 400
    /// <c>validation</c>, 404 <c>listing.not-found</c>, 409 <c>listing.wrong-status</c>, 422
    /// <c>idempotency.key-reused</c>, 429 <c>promotion-order.too-many</c>, 503 <c>payment.unavailable</c>.
    /// </summary>
    private static Task<IResult> CreateOrder(
        PromotionOrderInputDto body,
        CurrentUser me,
        HttpContext http,
        IdempotentRequests idempotency,
        PromotionService promotions,
        IOptions<PaymentOptions> options,
        CancellationToken ct)
    {
        var apiBaseUrl = string.IsNullOrWhiteSpace(options.Value.PublicBaseUrl)
            ? $"{http.Request.Scheme}://{http.Request.Host}{http.Request.PathBase}"
            : options.Value.PublicBaseUrl.TrimEnd('/');
        return idempotency.RunAsync(
            http,
            me.UserId.ToString(),
            body,
            async token => (StatusCodes.Status201Created, await promotions.CreateOrderAsync(me, body, apiBaseUrl, token)),
            ct);
    }

    /// <summary><c>GET /me/promotion-orders/{id}</c> → the caller's <c>PromotionOrder</c> (the site asks after the return from the provider).</summary>
    private static async Task<Ok<PromotionOrderDto>> Order(Guid id, CurrentUser me, PromotionService promotions, CancellationToken ct) =>
        TypedResults.Ok(await promotions.OwnOrderAsync(me, id, ct));

    /// <summary>
    /// <c>POST /payments/{provider}/callback</c>: the provider's word on a payment. No session: the signature proves who
    /// sent it. Stored in <c>payment_events</c> whatever it says; applied once per payment (<c>provider</c>,
    /// <c>provider_ref</c>): the same callback again answers 200 without a second promotion. → 200 <c>{ orderId,
    /// status }</c>; 401 <c>payment.bad-signature</c>, 404 <c>payment.unknown-provider</c> /
    /// <c>promotion-order.not-found</c>, 409 <c>payment.amount-mismatch</c>, 413 <c>payload-too-large</c>.
    /// </summary>
    private static async Task<Ok<PaymentCallbackResultDto>> Callback(
        string provider,
        HttpContext http,
        PaymentGateways gateways,
        PromotionService promotions,
        CancellationToken ct)
    {
        var gateway = gateways.Find(provider) ?? throw ApiProblemException.NotFound(PromotionErrors.UnknownProvider);
        var body = await ReadBodyAsync(http.Request, ct);
        var headers = http.Request.Headers.ToDictionary(h => h.Key.ToLowerInvariant(), h => h.Value.ToString(), StringComparer.Ordinal);
        return TypedResults.Ok(await promotions.HandleCallbackAsync(gateway, new PaymentCallbackRequest(body, headers), ct));
    }

    /// <summary>
    /// <c>GET /payments/fake/checkout/{ref}?return=</c>: the fake provider's payment page («Test ödənişi»), Development
    /// and Staging only. It shows the order and offers «Ödə» and «İmtina et»; no card is asked for.
    /// </summary>
    private static async Task<IResult> FakeCheckoutPage(string reference, HttpContext http, AppDbContext db, PaymentGateways gateways, CancellationToken ct)
    {
        _ = gateways.Fake ?? throw ApiProblemException.NotFound(PromotionErrors.UnknownProvider);
        var order = await FakeOrderAsync(db, reference, ct);
        var catalogue = await PromotionCatalogue.LoadAsync(db, ct);
        var option = catalogue.Option(order.OptionId);
        var package = catalogue.Package(option?.PackageId);
        var returnPath = PromotionRules.TryCleanReturnPath(http.Request.Query["return"], out var path) ? path : PromotionRules.DefaultReturnPath;
        var action = Html.Encode($"?return={Uri.EscapeDataString(returnPath)}&result=");
        var what = Html.Encode($"«{package?.Name.Az}» · {option?.Label.Az}");
        var amount = Html.Encode(Money.Format(order.Amount, Language.Az));
        var status = order.Status switch
        {
            PromotionOrderStatus.Pending => "Ödənilməyib",
            PromotionOrderStatus.Paid => "Ödənilib",
            _ => "Ödənilmədi",
        };
        var buttons = order.Status == PromotionOrderStatus.Paid
            ? string.Empty
            : $$"""
                <form method="post" action="{{action}}paid"><button type="submit">Ödə</button></form>
                <form method="post" action="{{action}}failed"><button type="submit">İmtina et</button></form>
              """;
        var html = $$"""
            <!doctype html>
            <html lang="az">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta name="robots" content="noindex">
              <title>Test ödənişi · GreenStore</title>
              <style>
                body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
                dl { display: grid; grid-template-columns: auto 1fr; gap: .25rem 1rem; }
                dt { font-weight: 600; }
                form { display: inline-block; margin-right: .5rem; }
                button { font: inherit; padding: .5rem 1.25rem; cursor: pointer; }
              </style>
            </head>
            <body>
              <h1>Test ödənişi</h1>
              <p>Bu, sınaq mühitinin saxta ödəniş səhifəsidir: kart soruşulmur və pul çıxılmır.</p>
              <dl>
                <dt>Sifariş</dt><dd>№ {{order.Number.ToString(CultureInfo.InvariantCulture)}}</dd>
                <dt>Reklam</dt><dd>{{what}}</dd>
                <dt>Məbləğ</dt><dd>{{amount}} ₼</dd>
                <dt>Status</dt><dd>{{status}}</dd>
              </dl>
            {{buttons}}
            </body>
            </html>
            """;
        http.Response.Headers.CacheControl = "no-store";
        return Results.Content(html, "text/html; charset=utf-8", Encoding.UTF8);
    }

    /// <summary>
    /// <c>POST /payments/fake/checkout/{ref}?result=paid|failed&amp;return=</c>: «Ödə» or «İmtina et». Sends the signed
    /// callback a provider would send (through <see cref="PromotionService.HandleCallbackAsync"/>, as
    /// <c>POST /payments/fake/callback</c> does), then 303 back to the site: <c>{Frontend:BaseUrl}{return}</c> with
    /// <c>payment=paid|failed</c> added. Without <c>Frontend:BaseUrl</c> it answers the callback's JSON.
    /// </summary>
    private static async Task<IResult> FakeCheckoutAnswer(
        string reference,
        HttpContext http,
        AppDbContext db,
        PaymentGateways gateways,
        PromotionService promotions,
        IOptions<FrontendOptions> frontend,
        CancellationToken ct)
    {
        var fake = gateways.Fake ?? throw ApiProblemException.NotFound(PromotionErrors.UnknownProvider);
        string? result = http.Request.Query["result"];
        if (result is not ("paid" or "failed"))
        {
            throw ApiProblemException.Validation("result", FieldErrors.Invalid);
        }

        var order = await FakeOrderAsync(db, reference, ct);
        var body = FakePaymentGateway.CallbackBody(reference, order.Id, order.Amount, paid: result == "paid");
        var headers = new Dictionary<string, string>(StringComparer.Ordinal) { [FakePaymentGateway.SignatureHeader.ToLowerInvariant()] = fake.Sign(body) };
        var answer = await promotions.HandleCallbackAsync(fake, new PaymentCallbackRequest(body, headers), ct);

        var site = frontend.Value.BaseUrl.TrimEnd('/');
        if (string.IsNullOrEmpty(site))
        {
            return Results.Ok(answer);
        }

        var returnPath = PromotionRules.TryCleanReturnPath(http.Request.Query["return"], out var path) ? path : PromotionRules.DefaultReturnPath;
        var payment = answer.Status == PromotionOrderStatus.Paid ? "paid" : "failed";
        return new SeeOther(site + PromotionRules.WithQuery(returnPath, $"payment={payment}"));
    }

    private static async Task<PromotionOrder> FakeOrderAsync(AppDbContext db, string reference, CancellationToken ct) =>
        await db.PromotionOrders.AsNoTracking()
            .FirstOrDefaultAsync(o => o.Provider == FakePaymentGateway.ProviderName && o.ProviderRef == reference, ct)
        ?? throw ApiProblemException.NotFound(PromotionErrors.OrderNotFound);

    /// <summary>The body as text, at most <see cref="MaxCallbackBytes"/> (413 beyond).</summary>
    private static async Task<string> ReadBodyAsync(HttpRequest request, CancellationToken ct)
    {
        if (request.ContentLength > MaxCallbackBytes)
        {
            throw new ApiProblemException(StatusCodes.Status413PayloadTooLarge, ErrorCodes.PayloadTooLarge);
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int read;
        while ((read = await request.Body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxCallbackBytes)
            {
                throw new ApiProblemException(StatusCodes.Status413PayloadTooLarge, ErrorCodes.PayloadTooLarge);
            }

            buffer.Write(chunk, 0, read);
        }

        return Encoding.UTF8.GetString(buffer.GetBuffer(), 0, (int)buffer.Length);
    }

    /// <summary>303 See Other: after the form's POST the browser GETs the site's page.</summary>
    private sealed class SeeOther(string location) : IResult
    {
        public Task ExecuteAsync(HttpContext httpContext)
        {
            httpContext.Response.StatusCode = StatusCodes.Status303SeeOther;
            httpContext.Response.Headers.Location = location;
            return Task.CompletedTask;
        }
    }
}
