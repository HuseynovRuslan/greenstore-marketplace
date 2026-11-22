using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Promotion.Payments;

/// <summary>
/// The payment provider of Development and Staging (ARCHITECTURE.md §16): nobody pays anything. Its payment page is
/// the API's own <c>/api/v1/payments/fake/checkout/{ref}</c> («Test ödənişi»): «Ödə» or «İmtina et» there sends a
/// signed callback through the same path a real provider's takes (<c>POST /payments/fake/callback</c>: signature,
/// <c>payment_events</c>, the order) and brings the visitor back to the site. Callbacks are signed with HMAC-SHA256
/// over the body (<see cref="SignatureHeader"/>, key <c>Payments:Fake:Secret</c>), as real providers sign theirs.
/// Never offered in Production (<see cref="PaymentGateways"/>).
/// </summary>
public sealed class FakePaymentGateway : IPaymentGateway
{
    public const string ProviderName = "fake";

    /// <summary>Lower-case hex HMAC-SHA256 of the body.</summary>
    public const string SignatureHeader = "X-Fake-Signature";

    public const string Succeeded = "payment.succeeded";

    public const string Failed = "payment.failed";

    /// <summary>The checkout page under /api/v1: <c>payments/fake/checkout/{ref}</c>.</summary>
    public const string CheckoutPath = "/payments/fake/checkout";

    private static readonly JsonSerializerOptions BodyJson = new(JsonSerializerDefaults.Web);

    private readonly byte[] key;

    public FakePaymentGateway(IOptions<PaymentOptions> options)
    {
        var secret = options.Value.Fake.Secret;
        // Without a configured secret the key is this process's own: the checkout page and the callback are served
        // by the same API, so it still works on one instance (Program.cs warns outside Development).
        key = string.IsNullOrEmpty(secret) ? RandomNumberGenerator.GetBytes(32) : Encoding.UTF8.GetBytes(secret);
    }

    public string Name => ProviderName;

    public Task<PaymentStart> StartAsync(PaymentStartRequest request, CancellationToken ct)
    {
        var providerRef = $"{ProviderName}_{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(16))}";
        var url = $"{request.ApiBaseUrl}{Modules.ApiRoutes.Prefix}{CheckoutPath}/{providerRef}?return={Uri.EscapeDataString(request.ReturnPath)}";
        return Task.FromResult(new PaymentStart(providerRef, url));
    }

    public PaymentCallback Read(PaymentCallbackRequest callback)
    {
        var signatureOk = callback.Headers.TryGetValue(SignatureHeader.ToLowerInvariant(), out var signature) && Verify(callback.Body, signature);
        try
        {
            using var document = JsonDocument.Parse(callback.Body);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return new PaymentCallback(signatureOk, null, null, PaymentOutcome.Unknown, null);
            }

            var eventType = Text(root, "event");
            var outcome = eventType switch
            {
                Succeeded => PaymentOutcome.Paid,
                Failed => PaymentOutcome.Failed,
                _ => PaymentOutcome.Unknown,
            };
            decimal? amount = root.TryGetProperty("amount", out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)
                ? number
                : null;
            return new PaymentCallback(signatureOk, Text(root, "providerRef"), eventType, outcome, amount);
        }
        catch (JsonException)
        {
            return new PaymentCallback(signatureOk, null, null, PaymentOutcome.Unknown, null);
        }
    }

    /// <summary>The callback the checkout page sends for a payment (what a real provider would post).</summary>
    public static string CallbackBody(string providerRef, Guid orderId, decimal amount, bool paid) =>
        JsonSerializer.Serialize(
            new
            {
                @event = paid ? Succeeded : Failed,
                providerRef,
                orderId = orderId.ToString(),
                amount = Common.Money.Trim(amount),
                currency = "AZN",
            },
            BodyJson);

    /// <summary>The signature of <paramref name="body"/>, as <see cref="SignatureHeader"/> carries it.</summary>
    public string Sign(string body) => Convert.ToHexStringLower(HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(body)));

    private bool Verify(string body, string signature)
    {
        var expected = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes(body));
        byte[] given;
        try
        {
            given = Convert.FromHexString(signature.Trim());
        }
        catch (FormatException)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(expected, given);
    }

    private static string? Text(JsonElement root, string name) =>
        root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
