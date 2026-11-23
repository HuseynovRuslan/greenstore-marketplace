using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Accounts.Sms;

public static class SmsSetup
{
    /// <summary>The provider names <see cref="AddSms"/> knows (the value of <c>Sms:Provider</c>).</summary>
    public static readonly IReadOnlyList<string> Providers = [SmsOptions.LogProvider];

    /// <summary>
    /// Registers the <see cref="ISmsSender"/> that <c>Sms:Provider</c> names. A real provider gets its own line here
    /// and in <see cref="Providers"/>, for example:
    /// <code>
    /// services.AddHttpClient&lt;AcmeSmsSender&gt;();
    /// // in the switch:  "acme" => sp.GetRequiredService&lt;AcmeSmsSender&gt;(),
    /// </code>
    /// </summary>
    public static IServiceCollection AddSms(this IServiceCollection services)
    {
        services.AddOptions<SmsOptions>()
            .BindConfiguration(SmsOptions.Section)
            .Validate(o => Providers.Contains(o.Provider), $"Sms:Provider must be one of: {string.Join(", ", Providers)}.")
            .ValidateOnStart();

        services.AddSingleton<LogSmsSender>();
        services.AddSingleton<ISmsSender>(sp => sp.GetRequiredService<IOptions<SmsOptions>>().Value.Provider switch
        {
            SmsOptions.LogProvider => sp.GetRequiredService<LogSmsSender>(),
            var unknown => throw new InvalidOperationException($"Unknown Sms:Provider \"{unknown}\"."),
        });
        return services;
    }
}
