using GreenStore.Api.Common;

namespace GreenStore.Api.Modules.Accounts.Sms;

/// <summary>
/// The SMS sender while no provider is connected (<c>Sms:Provider = "log"</c>): writes the message, code included, to
/// the log instead of sending it. Development reads codes from the console (or from <c>demoCode</c>); any other
/// environment logs a warning at startup, because nobody receives these messages there.
/// </summary>
public sealed class LogSmsSender(ILogger<LogSmsSender> logger) : ISmsSender
{
    public Task SendAsync(SmsMessage message, CancellationToken cancellationToken)
    {
        logger.LogInformation("SMS not sent (Sms:Provider is \"log\") to {Phone}: {Text}", PhoneNumbers.Mask(message.Phone), message.Text);
        return Task.CompletedTask;
    }
}
