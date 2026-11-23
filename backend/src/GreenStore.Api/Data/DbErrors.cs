using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GreenStore.Api.Data;

/// <summary>Reading PostgreSQL's refusals: a unique index that two requests raced for becomes a 409, not a 500.</summary>
public static class DbErrors
{
    /// <summary>The unique index or constraint the save broke (<c>ux_users_phone</c>), or null for any other error.</summary>
    public static string? UniqueViolation(DbUpdateException error) =>
        error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres ? postgres.ConstraintName : null;
}
