using Microsoft.Extensions.Options;

namespace GreenStore.Api.Jobs;

/// <summary>Background jobs (section "Jobs", ARCHITECTURE.md §12).</summary>
public sealed class JobsOptions
{
    public const string Section = "Jobs";

    /// <summary>Run the frequent jobs (expiry, outbox) in this API instance. The tests run them by hand instead.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Wait after the start before the first run.</summary>
    public int FirstRunDelaySeconds { get; set; } = 10;

    /// <summary><see cref="ExpireListings"/>: every 10 minutes.</summary>
    public int ExpireListingsSeconds { get; set; } = 600;

    /// <summary><see cref="OutboxDispatcher"/>: every 5 seconds.</summary>
    public int OutboxSeconds { get; set; } = 5;
}

/// <summary>The daily clean-up (section "Cleanup", ARCHITECTURE.md §12 <c>Cleanup</c>).</summary>
public sealed class CleanupOptions
{
    public const string Section = "Cleanup";

    /// <summary>Run it in this API instance. The tests turn it off: their rows have made-up dates.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Wait after the start before the first run, so a deploy is not slowed by it.</summary>
    public int FirstRunDelaySeconds { get; set; } = 60;
}

/// <summary>One run of a job: what it did, for the log, or null when there was nothing to do (or another instance had it).</summary>
public interface IJobStep
{
    Task<string?> RunAsync(CancellationToken ct);
}

/// <summary>
/// Runs <typeparamref name="TStep"/> in a scope of its own every <see cref="Interval"/> (after a first delay), in the
/// API's process (ARCHITECTURE.md §2). Each step takes a PostgreSQL advisory lock, so with several API instances one
/// runs it at a time. A failed run is logged and the next one tries again: a job never stops the API.
/// </summary>
public abstract class PeriodicJob<TStep>(IServiceScopeFactory scopes, TimeProvider clock, ILogger logger) : BackgroundService
    where TStep : IJobStep
{
    protected abstract bool Enabled { get; }

    protected abstract TimeSpan FirstDelay { get; }

    protected abstract TimeSpan Interval { get; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!Enabled)
        {
            return;
        }

        try
        {
            await Task.Delay(FirstDelay, clock, stoppingToken);
            using var timer = new PeriodicTimer(Interval, clock);
            do
            {
                await RunOnceAsync(stoppingToken);
            }
            while (await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // The API is stopping.
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            if (await scope.ServiceProvider.GetRequiredService<TStep>().RunAsync(ct) is { } done)
            {
                logger.LogInformation("{Job}: {Result}", typeof(TStep).Name, done);
            }
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            logger.LogError(error, "{Job} failed", typeof(TStep).Name);
        }
    }
}

public sealed class ExpireListingsJob(IServiceScopeFactory scopes, IOptions<JobsOptions> options, TimeProvider clock, ILogger<ExpireListingsJob> logger)
    : PeriodicJob<ExpireListings>(scopes, clock, logger)
{
    protected override bool Enabled => options.Value.Enabled;

    protected override TimeSpan FirstDelay => TimeSpan.FromSeconds(options.Value.FirstRunDelaySeconds);

    protected override TimeSpan Interval => TimeSpan.FromSeconds(options.Value.ExpireListingsSeconds);
}

public sealed class OutboxJob(IServiceScopeFactory scopes, IOptions<JobsOptions> options, TimeProvider clock, ILogger<OutboxJob> logger)
    : PeriodicJob<OutboxDispatcher>(scopes, clock, logger)
{
    protected override bool Enabled => options.Value.Enabled;

    protected override TimeSpan FirstDelay => TimeSpan.FromSeconds(options.Value.FirstRunDelaySeconds);

    protected override TimeSpan Interval => TimeSpan.FromSeconds(options.Value.OutboxSeconds);
}

public sealed class CleanupJob(IServiceScopeFactory scopes, IOptions<CleanupOptions> options, TimeProvider clock, ILogger<CleanupJob> logger)
    : PeriodicJob<Cleanup>(scopes, clock, logger)
{
    public static readonly TimeSpan Every = TimeSpan.FromDays(1);

    protected override bool Enabled => options.Value.Enabled;

    protected override TimeSpan FirstDelay => TimeSpan.FromSeconds(options.Value.FirstRunDelaySeconds);

    protected override TimeSpan Interval => Every;
}
