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

    /// <summary>
    /// «Usta çağır» to a provider: the request's number, the service type and city in the provider's language, and the
    /// customer to call back (the inbox page comes later, so the SMS carries what the call needs).
    /// </summary>
    public static string ServiceRequestNotice(long number, string serviceType, string city, string customerName, string customerPhone, Language language) => language switch
    {
        Language.Ru => $"GreenStore: новая заявка № {number}. {serviceType}, {city}. Клиент: {customerName}, {customerPhone}.",
        Language.En => $"GreenStore: new service request No. {number}. {serviceType}, {city}. Customer: {customerName}, {customerPhone}.",
        _ => $"GreenStore: yeni xidmət sorğusu № {number}. {serviceType}, {city}. Müştəri: {customerName}, {customerPhone}.",
    };
}
