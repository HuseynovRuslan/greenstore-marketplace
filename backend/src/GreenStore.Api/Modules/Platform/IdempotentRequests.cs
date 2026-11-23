using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Platform;

/// <summary>
/// POSTs that create something take an <c>Idempotency-Key</c> header (ARCHITECTURE.md §7): «Elanı göndər» pressed twice,
/// or sent again after a dropped connection, makes one listing. The key, the request's hash and the answer are saved
/// in the same transaction as what the request creates (<c>idempotency_keys</c>, kept 24 hours). The same key again
/// gets the saved answer; the same key with another body is refused (422 <c>idempotency.key-reused</c>). Two requests
/// with one key at the same moment wait for each other on the key's row, so the second one replays the first's answer.
/// Without the header the request simply runs (in a transaction all the same).
/// </summary>
public sealed class IdempotentRequests(AppDbContext db, TimeProvider clock, IOptions<JsonOptions> json)
{
    public const string Header = "Idempotency-Key";

    /// <summary>422: the key was used for a different request.</summary>
    public const string KeyReused = "idempotency.key-reused";

    /// <summary>409: the first request with this key has not finished (it never answered: it should not happen).</summary>
    public const string InProgress = "idempotency.in-progress";

    public const int MaxKeyLength = 80;

    /// <param name="scope">Whose keys these are: the user's id (keys of different users never meet).</param>
    /// <param name="request">The request body, hashed to tell a repeat from another request.</param>
    public async Task<IResult> RunAsync<T>(
        HttpContext http,
        string scope,
        object request,
        Func<CancellationToken, Task<(int Status, T Body)>> action,
        CancellationToken ct)
    {
        var options = json.Value.SerializerOptions;
        string? key = http.Request.Headers[Header];
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (string.IsNullOrWhiteSpace(key))
        {
            var (status, body) = await action(ct);
            await transaction.CommitAsync(ct);
            return Answer(JsonSerializer.Serialize(body, options), status);
        }

        key = key.Trim();
        if (key.Length > MaxKeyLength || key.Any(c => c is < '!' or > '~'))
        {
            throw ApiProblemException.Validation(Header, FieldErrors.Invalid);
        }

        var hash = SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(request, request.GetType(), options));
        var now = clock.GetUtcNow();
        var inserted = await db.Database.ExecuteSqlAsync(
            $"INSERT INTO idempotency_keys (scope, key, request_hash, created_at) VALUES ({scope}, {key}, {hash}, {now}) ON CONFLICT DO NOTHING",
            ct);
        if (inserted == 0)
        {
            var saved = await db.IdempotencyKeys.AsNoTracking().FirstAsync(k => k.Scope == scope && k.Key == key, ct);
            if (!saved.RequestHash.AsSpan().SequenceEqual(hash))
            {
                throw new ApiProblemException(StatusCodes.Status422UnprocessableEntity, KeyReused);
            }

            if (saved.ResponseStatus is not { } savedStatus || saved.ResponseBody is null)
            {
                throw ApiProblemException.Conflict(InProgress);
            }

            return Answer(saved.ResponseBody, savedStatus);
        }

        var (answerStatus, answerBody) = await action(ct);
        var text = JsonSerializer.Serialize(answerBody, options);
        var status16 = (short)answerStatus;
        await db.IdempotencyKeys
            .Where(k => k.Scope == scope && k.Key == key)
            .ExecuteUpdateAsync(k => k.SetProperty(x => x.ResponseStatus, status16).SetProperty(x => x.ResponseBody, text), ct);
        await transaction.CommitAsync(ct);
        return Answer(text, answerStatus);
    }

    private static IResult Answer(string body, int status) =>
        Results.Text(body, "application/json", Encoding.UTF8, status);
}
