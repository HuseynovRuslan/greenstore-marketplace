using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Jobs;

/// <summary>When a failed message is tried again (pure, unit-tested).</summary>
public static class OutboxRetry
{
    /// <summary>Tries before the message is given up on (about two hours in all).</summary>
    public const int MaxAttempts = 10;

    public static readonly TimeSpan First = TimeSpan.FromSeconds(5);

    public static readonly TimeSpan Longest = TimeSpan.FromHours(1);

    /// <summary>5 s, 10 s, 20 s, … doubling after each failed attempt, at most an hour.</summary>
    public static TimeSpan After(int attempts)
    {
        var seconds = First.TotalSeconds * Math.Pow(2, Math.Max(0, attempts - 1));
        return seconds >= Longest.TotalSeconds ? Longest : TimeSpan.FromSeconds(seconds);
    }
}

/// <summary>Sends a cache refresh notice to the site.</summary>
public interface IRevalidationSender
{
    /// <summary>False when no site is configured to receive it (nothing was sent).</summary>
    Task<bool> SendAsync(IReadOnlyList<string> tags, CancellationToken ct);
}

/// <summary>
/// <c>POST {Frontend:BaseUrl}/api/revalidate</c> with <c>{"tags": [...]}</c> and <c>Authorization: Bearer
/// {Revalidation:Secret}</c>; the site calls <c>revalidateTag</c> for each (ARCHITECTURE.md §10), at most
/// <see cref="Revalidation.MaxTagsPerNotice"/> per request. Any answer but 2xx is a failure, retried by the outbox.
/// </summary>
public sealed class HttpRevalidationSender(HttpClient http, IOptions<FrontendOptions> frontend, IOptions<RevalidationOptions> options) : IRevalidationSender
{
    public const string Path = "/api/revalidate";

    public async Task<bool> SendAsync(IReadOnlyList<string> tags, CancellationToken ct)
    {
        var site = frontend.Value.BaseUrl.TrimEnd('/');
        var secret = options.Value.Secret;
        if (string.IsNullOrWhiteSpace(site) || string.IsNullOrWhiteSpace(secret))
        {
            return false;
        }

        // Notices are stored at most MaxTagsPerNotice tags long; one saved before that limit is sent in parts.
        foreach (var part in Revalidation.Notices(tags))
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, site + Path)
            {
                Content = JsonContent.Create(new RevalidatePayload(part)),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secret);
            using var response = await http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
        }

        return true;
    }
}

/// <summary>
/// Sends what the outbox holds (ARCHITECTURE.md §12, every 5 seconds). Due rows are locked with <c>FOR UPDATE SKIP
/// LOCKED</c>, so two API instances never send the same one. A failure is tried again later
/// (<see cref="OutboxRetry"/>); after <see cref="OutboxRetry.MaxAttempts"/> it is given up and logged as an error,
/// since a refresh notice that late is no use (the site's own 60-second cache has refreshed the pages long since).
/// </summary>
public sealed class OutboxDispatcher(AppDbContext db, IRevalidationSender revalidation, TimeProvider clock, ILogger<OutboxDispatcher> logger) : IJobStep
{
    public const int BatchSize = 20;

    public async Task<string?> RunAsync(CancellationToken ct)
    {
        var sent = await DispatchAsync(ct);
        return sent > 0 ? string.Create(CultureInfo.InvariantCulture, $"{sent} messages sent") : null;
    }

    /// <summary>How many messages were sent (or found nothing to send to).</summary>
    public async Task<int> DispatchAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var due = await db.Outbox
            .FromSql($"""
                SELECT * FROM outbox
                WHERE sent_at IS NULL AND next_attempt_at <= {now}
                ORDER BY next_attempt_at, id
                LIMIT {BatchSize}
                FOR UPDATE SKIP LOCKED
                """)
            .ToListAsync(ct);
        var done = 0;
        foreach (var message in due)
        {
            try
            {
                var delivered = message.Type switch
                {
                    OutboxTypes.Revalidate => await revalidation.SendAsync(
                        JsonSerializer.Deserialize<RevalidatePayload>(message.Payload, ColumnMapping.StorageJson)!.Tags,
                        ct),
                    _ => throw new InvalidOperationException($"Unknown outbox message type '{message.Type}'."),
                };
                message.SentAt = now;
                message.LastError = delivered ? null : "skipped: no receiver configured (Frontend:BaseUrl, Revalidation:Secret)";
                done++;
            }
            catch (Exception error) when (error is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                message.Attempts++;
                message.LastError = Trim(error.Message);
                if (message.Attempts >= OutboxRetry.MaxAttempts)
                {
                    message.SentAt = now;
                    message.LastError = Trim($"gave up after {message.Attempts} attempts: {error.Message}");
                    logger.LogError(error, "Outbox message {Id} ({Type}) given up after {Attempts} attempts", message.Id, message.Type, message.Attempts);
                }
                else
                {
                    message.NextAttemptAt = now + OutboxRetry.After(message.Attempts);
                    logger.LogWarning("Outbox message {Id} ({Type}) failed, attempt {Attempts}: {Error}", message.Id, message.Type, message.Attempts, error.Message);
                }
            }
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return done;
    }

    private static string Trim(string text) => text.Length <= 1000 ? text : text[..1000];
}
