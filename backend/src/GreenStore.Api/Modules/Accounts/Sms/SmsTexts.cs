using GreenStore.Api.Common.Localization;

namespace GreenStore.Api.Modules.Accounts.Sms;

/// <summary>
/// SMS texts in the recipient's language (ARCHITECTURE.md §8.1: <c>users.locale</c>, else the request's language).
/// Latin letters only in Azerbaijani would fit more in one SMS, but the platform writes its language correctly.
/// Russian and English are DRAFT translations.
/// </summary>
public static class SmsTexts
{
    public static string OtpCode(string code, Language language, int minutes) => language switch
    {
        Language.Ru => $"Код GreenStore: {code}. Действует {minutes} мин. Никому не сообщайте его.",
        Language.En => $"GreenStore code: {code}. Valid for {minutes} min. Do not share it with anyone.",
        _ => $"GreenStore kodunuz: {code}. Kod {minutes} dəqiqə etibarlıdır. Onu heç kimə deməyin.",
    };
}
