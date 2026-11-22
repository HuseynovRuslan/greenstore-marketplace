namespace GreenStore.Api.Modules.Accounts.Sms;

/// <summary>One SMS: the E.164 number (<c>+994505551234</c>) and the text, already in the recipient's language.</summary>
public sealed record SmsMessage(string Phone, string Text);

/// <summary>
/// Sends an SMS (ARCHITECTURE.md §2: SMS is behind an interface). The API calls it directly while the user waits for
/// the code, never through the outbox, so the plain code is never written to the database (DATABASE.md §3.2).
/// <para>
/// To connect a real provider (backend/README.md, «SMS provayderi»): implement this interface in a class next to
/// <see cref="LogSmsSender"/>, add its settings to <see cref="SmsOptions"/>, and register it in
/// <see cref="SmsSetup.AddSms"/> under a provider name; then set <c>Sms__Provider</c> to that name. Throw when the
/// provider does not accept the message: the API then answers <c>503 otp.unavailable</c> and the attempt does not
/// count against the user's limits.
/// </para>
/// </summary>
public interface ISmsSender
{
    Task SendAsync(SmsMessage message, CancellationToken cancellationToken);
}
