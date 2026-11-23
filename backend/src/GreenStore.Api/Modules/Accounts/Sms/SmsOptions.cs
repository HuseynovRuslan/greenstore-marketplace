namespace GreenStore.Api.Modules.Accounts.Sms;

/// <summary>
/// The SMS provider (section "Sms"). <see cref="Provider"/> picks the <see cref="ISmsSender"/>; the other settings are
/// the ones an SMS gateway usually needs, read by the real provider's sender once there is one. Secrets
/// (<see cref="Password"/>, <see cref="ApiKey"/>) only from the environment (<c>Sms__Password</c>), never committed.
/// </summary>
public sealed class SmsOptions
{
    public const string Section = "Sms";

    /// <summary>"log": nothing is sent, the message (with the code) is written to the API's log.</summary>
    public const string LogProvider = "log";

    public string Provider { get; set; } = LogProvider;

    /// <summary>The provider's send endpoint (https://…).</summary>
    public string ApiUrl { get; set; } = string.Empty;

    public string Login { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>The sender name the recipient sees («GreenStore»), registered with the provider.</summary>
    public string Sender { get; set; } = "GreenStore";

    public int TimeoutSeconds { get; set; } = 10;
}
