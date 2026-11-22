namespace GreenStore.Api.Common;

/// <summary>
/// New row ids: UUIDv7 made by the application (DATABASE.md §2). They grow with time, so inserts land at the end of
/// the primary-key index. The timestamp comes from the injected clock, so tests control it.
/// </summary>
public static class Ids
{
    public static Guid New(TimeProvider clock) => Guid.CreateVersion7(clock.GetUtcNow());
}
