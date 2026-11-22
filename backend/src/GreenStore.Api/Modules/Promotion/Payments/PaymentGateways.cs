using GreenStore.Api.Common;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Promotion.Payments;

/// <summary>
/// The payment providers this API may use: every registered <see cref="IPaymentGateway"/>, except the fake one outside
/// Development, Staging and the tests (Production never takes a fake payment, whatever the settings say).
/// </summary>
public sealed class PaymentGateways(IEnumerable<IPaymentGateway> gateways, IOptions<PaymentOptions> options, IHostEnvironment environment)
{
    /// <summary>Where the fake provider may run: nobody pays there.</summary>
    public static bool FakeAllowed(IHostEnvironment environment) => AppSettingsSetup.IsLocal(environment) || environment.IsStaging();

    /// <summary>The provider new orders go to; null when none may be used here.</summary>
    public IPaymentGateway? Current => Find(options.Value.Provider);

    /// <summary>The provider named in a callback's URL; null for an unknown one (or the fake one in Production).</summary>
    public IPaymentGateway? Find(string? name) =>
        gateways.FirstOrDefault(g => string.Equals(g.Name, name, StringComparison.Ordinal) && (g.Name != FakePaymentGateway.ProviderName || FakeAllowed(environment)));

    public FakePaymentGateway? Fake => Find(FakePaymentGateway.ProviderName) as FakePaymentGateway;
}
