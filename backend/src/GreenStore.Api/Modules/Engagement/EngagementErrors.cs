namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// The stable codes of reports, «Usta çağır» and support (ProblemDetails <c>code</c>). Clients choose their message by
/// these; a code never changes once released.
/// </summary>
public static class EngagementErrors
{
    /// <summary>404: no such report (staff endpoints).</summary>
    public const string ReportNotFound = "report.not-found";

    /// <summary>404: no such request among the caller's (the provider's inbox).</summary>
    public const string ServiceRequestNotFound = "service-request.not-found";

    /// <summary>429: this phone number sent <see cref="ServiceRequestOptions.MaxPerPhonePerDay"/> requests in 24 hours.</summary>
    public const string PhoneLimit = "service-request.phone-limit";

    /// <summary>429: this client IP sent <see cref="ServiceRequestOptions.MaxPerIpPerDay"/> requests in 24 hours.</summary>
    public const string IpLimit = "service-request.ip-limit";
}

/// <summary>«Usta çağır» settings (section "ServiceRequests").</summary>
public sealed class ServiceRequestOptions
{
    public const string Section = "ServiceRequests";

    /// <summary>Providers a request without a chosen one goes to (DATABASE.md §3.8: up to ten).</summary>
    public int MaxRecipients { get; set; } = 10;

    /// <summary>Requests one customer phone may send in 24 hours (spam protection).</summary>
    public int MaxPerPhonePerDay { get; set; } = 5;

    /// <summary>Requests one client IP may send in 24 hours.</summary>
    public int MaxPerIpPerDay { get; set; } = 20;

    /// <summary>
    /// SMS notices to providers in 24 hours, the whole site together: a bound on what a flood of requests can cost.
    /// Past it the requests still reach the providers' inboxes, without an SMS (a warning is logged).
    /// </summary>
    public int DailyNoticeCap { get; set; } = 500;
}
