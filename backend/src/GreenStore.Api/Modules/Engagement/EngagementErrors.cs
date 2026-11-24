namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// The stable codes of reports and support (ProblemDetails <c>code</c>). Clients choose their message by these; a code
/// never changes once released.
/// </summary>
public static class EngagementErrors
{
    /// <summary>404: no such report (staff endpoints).</summary>
    public const string ReportNotFound = "report.not-found";
}
