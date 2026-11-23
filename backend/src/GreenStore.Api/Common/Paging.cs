using GreenStore.Api.Common.Errors;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Common;

/// <summary>One page of results: the <c>PageResult</c> of src/services/repository.ts.</summary>
public record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageCount);

/// <summary>
/// <c>page</c> and <c>pageSize</c> of a list request (ARCHITECTURE.md §7): page is 1-based, pageSize at most
/// <see cref="MaxPageSize"/>. A page past the end returns the last page, as the mock repository does, and the result
/// says which page it is.
/// </summary>
public sealed record PageRequest(int Page, int PageSize)
{
    public const int MaxPageSize = 60;

    /// <summary>Checks the parameters; a page size outside 1–60 or a page below 1 is a 400 <c>validation</c>.</summary>
    public static PageRequest From(int? page, int? pageSize, int defaultPageSize)
    {
        var errors = new Dictionary<string, string[]>();
        if (page is < 1)
        {
            errors["page"] = ["out-of-range"];
        }

        if (pageSize is < 1 or > MaxPageSize)
        {
            errors["pageSize"] = ["out-of-range"];
        }

        if (errors.Count > 0)
        {
            throw ApiProblemException.Validation(errors);
        }

        return new PageRequest(page ?? 1, pageSize ?? defaultPageSize);
    }

    /// <summary>How many pages <paramref name="total"/> items make (at least one, even when there are none).</summary>
    public int PageCount(int total) => Math.Max(1, (total + PageSize - 1) / PageSize);

    /// <summary>The requested page, moved back to the last one when it is past the end.</summary>
    public int Clamp(int total) => Math.Min(Page, PageCount(total));
}

public static class PagingExtensions
{
    /// <summary>Counts, then reads the page (already ordered by the caller) and maps it.</summary>
    public static async Task<PageResult<TOut>> ToPageAsync<TIn, TOut>(
        this IQueryable<TIn> ordered,
        PageRequest request,
        Func<IReadOnlyList<TIn>, IReadOnlyList<TOut>> map,
        CancellationToken cancellationToken)
    {
        var total = await ordered.CountAsync(cancellationToken);
        var page = request.Clamp(total);
        var rows = await ordered.Skip((page - 1) * request.PageSize).Take(request.PageSize).ToListAsync(cancellationToken);
        return new PageResult<TOut>(map(rows), total, page, request.PageCount(total));
    }
}
