namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// Wrong passwords per client IP (ARCHITECTURE.md §14 «hesab və IP üzrə»): after <c>limit</c> failures within the window
/// the IP may not try a password again until the window ends, whichever accounts it tried. This stops one address from
/// trying a few passwords on many accounts, which the per-account lockout cannot see. Kept in memory: per API process,
/// like the rate limiter (ARCHITECTURE.md §13). Only failures count, so the visitors of a shared address (an office, a
/// mobile operator's NAT) who type their passwords right are never stopped.
/// </summary>
public sealed class FailedLoginThrottle(TimeProvider clock, int limit, TimeSpan window)
{
    /// <summary>Above this many tracked addresses, finished windows are dropped on the next failure.</summary>
    private const int SweepAbove = 10_000;

    private readonly Dictionary<string, (DateTimeOffset Start, int Count)> failures = new(StringComparer.Ordinal);
    private readonly Lock gate = new();

    /// <summary>How long the address must wait; null when it may try.</summary>
    public TimeSpan? Blocked(string key)
    {
        var now = clock.GetUtcNow();
        lock (gate)
        {
            if (failures.TryGetValue(key, out var entry) && entry.Start + window > now && entry.Count >= limit)
            {
                return entry.Start + window - now;
            }

            return null;
        }
    }

    public void RecordFailure(string key)
    {
        var now = clock.GetUtcNow();
        lock (gate)
        {
            if (failures.Count > SweepAbove)
            {
                foreach (var stale in failures.Where(f => f.Value.Start + window <= now).Select(f => f.Key).ToList())
                {
                    failures.Remove(stale);
                }
            }

            failures[key] = failures.TryGetValue(key, out var entry) && entry.Start + window > now
                ? (entry.Start, entry.Count + 1)
                : (now, 1);
        }
    }
}
