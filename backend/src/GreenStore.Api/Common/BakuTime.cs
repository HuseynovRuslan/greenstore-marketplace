namespace GreenStore.Api.Common;

/// <summary>
/// Day boundaries of statistics are Baku's (DATABASE.md §2): UTC+4 all year (Azerbaijan has no daylight saving time
/// since 2016).
/// </summary>
public static class BakuTime
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(4);

    public static DateOnly Today(DateTimeOffset now) => DateOnly.FromDateTime(now.ToOffset(Offset).DateTime);
}
