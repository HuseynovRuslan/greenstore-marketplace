using System.Text.Json;
using GreenStore.Api.Modules.Promotion;
using GreenStore.Api.Modules.Promotion.Payments;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Promotion;

/// <summary>The fake payment provider on its own: its payment page address, its signed callbacks, where it may run.</summary>
public sealed class FakePaymentGatewayTests
{
    private static FakePaymentGateway Gateway(string secret = "test-secret") =>
        new(Options.Create(new PaymentOptions { Fake = new FakePaymentOptions { Secret = secret } }));

    private static PaymentCallbackRequest Signed(FakePaymentGateway gateway, string body) =>
        new(body, new Dictionary<string, string> { ["x-fake-signature"] = gateway.Sign(body) });

    [Fact]
    public async Task The_payment_page_is_the_apis_own_with_the_way_back()
    {
        var start = await Gateway().StartAsync(
            new PaymentStartRequest(Guid.NewGuid(), 1001, 9, "GreenStore № 1001", "https://api.example.az", "/kabinet/elanlar/alma-1?order=x", null),
            Ct);

        Assert.Matches("^fake_[0-9a-f]{32}$", start.ProviderRef);
        Assert.Equal(
            $"https://api.example.az/api/v1/payments/fake/checkout/{start.ProviderRef}?return=%2Fkabinet%2Felanlar%2Falma-1%3Forder%3Dx",
            start.PaymentUrl);
    }

    [Fact]
    public async Task Every_payment_gets_a_reference_of_its_own()
    {
        var request = new PaymentStartRequest(Guid.NewGuid(), 1001, 9, "x", "http://localhost", "/kabinet", null);
        var gateway = Gateway();

        Assert.NotEqual((await gateway.StartAsync(request, Ct)).ProviderRef, (await gateway.StartAsync(request, Ct)).ProviderRef);
    }

    [Theory]
    [InlineData(true, PaymentOutcome.Paid, FakePaymentGateway.Succeeded)]
    [InlineData(false, PaymentOutcome.Failed, FakePaymentGateway.Failed)]
    public void A_signed_callback_says_what_happened(bool paid, PaymentOutcome outcome, string eventType)
    {
        var gateway = Gateway();
        var order = Guid.NewGuid();
        var body = FakePaymentGateway.CallbackBody("fake_abc", order, 9.00m, paid);

        var callback = gateway.Read(Signed(gateway, body));

        Assert.Equal(new PaymentCallback(true, "fake_abc", eventType, outcome, 9m), callback);
        using var json = JsonDocument.Parse(body);
        Assert.Equal(order.ToString(), json.RootElement.GetProperty("orderId").GetString());
        Assert.Equal("AZN", json.RootElement.GetProperty("currency").GetString());
        Assert.Equal("9", json.RootElement.GetProperty("amount").GetRawText());
    }

    [Fact]
    public void A_changed_body_or_a_wrong_signature_is_not_trusted()
    {
        var gateway = Gateway();
        var body = FakePaymentGateway.CallbackBody("fake_abc", Guid.NewGuid(), 9, paid: true);
        var signature = gateway.Sign(body);

        Assert.False(gateway.Read(new PaymentCallbackRequest(body.Replace("9", "1", StringComparison.Ordinal), new Dictionary<string, string> { ["x-fake-signature"] = signature })).SignatureOk);
        Assert.False(gateway.Read(new PaymentCallbackRequest(body, new Dictionary<string, string>())).SignatureOk);
        Assert.False(gateway.Read(new PaymentCallbackRequest(body, new Dictionary<string, string> { ["x-fake-signature"] = "not-hex" })).SignatureOk);
        Assert.False(gateway.Read(new PaymentCallbackRequest(body, new Dictionary<string, string> { ["x-fake-signature"] = signature[..10] })).SignatureOk);
        Assert.False(Gateway("another-secret").Read(Signed(gateway, body)).SignatureOk);
        Assert.True(gateway.Read(new PaymentCallbackRequest(body, new Dictionary<string, string> { ["x-fake-signature"] = signature.ToUpperInvariant() })).SignatureOk);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[1, 2]")]
    [InlineData("{\"event\": 5, \"providerRef\": 7}")]
    [InlineData("")]
    public void A_body_it_cannot_read_is_reported_not_thrown(string body)
    {
        var gateway = Gateway();

        var callback = gateway.Read(Signed(gateway, body));

        Assert.True(callback.SignatureOk);
        Assert.Equal((null, null, PaymentOutcome.Unknown, (decimal?)null), (callback.ProviderRef, callback.EventType, callback.Outcome, callback.Amount));
    }

    [Fact]
    public void An_event_it_does_not_know_changes_nothing()
    {
        var gateway = Gateway();
        var callback = gateway.Read(Signed(gateway, """{"event":"payment.refund-requested","providerRef":"fake_abc"}"""));

        Assert.Equal((PaymentOutcome.Unknown, "payment.refund-requested", "fake_abc"), (callback.Outcome, callback.EventType, callback.ProviderRef));
    }

    [Fact]
    public void Without_a_secret_each_process_signs_with_a_key_of_its_own()
    {
        var first = Gateway(string.Empty);
        var second = Gateway(string.Empty);
        var body = FakePaymentGateway.CallbackBody("fake_abc", Guid.NewGuid(), 9, paid: true);

        Assert.True(first.Read(Signed(first, body)).SignatureOk);
        Assert.False(second.Read(Signed(first, body)).SignatureOk);
    }

    [Theory]
    [InlineData("Development", true)]
    [InlineData("Testing", true)]
    [InlineData("Staging", true)]
    [InlineData("Production", false)]
    public void The_fake_provider_never_takes_a_payment_in_production(string environment, bool allowed)
    {
        var options = Options.Create(new PaymentOptions());
        var gateways = new PaymentGateways([new FakePaymentGateway(options)], options, new Environment(environment));

        Assert.Equal(allowed, PaymentGateways.FakeAllowed(new Environment(environment)));
        Assert.Equal(allowed, gateways.Current is FakePaymentGateway);
        Assert.Equal(allowed, gateways.Find("fake") is not null);
        Assert.Null(gateways.Find("stripe"));
        Assert.Null(gateways.Find("Fake"));
    }

    private sealed class Environment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "GreenStore.Api";

        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
