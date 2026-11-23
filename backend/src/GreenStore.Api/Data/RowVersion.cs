using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Data;

/// <summary>
/// An entity protected by optimistic concurrency on PostgreSQL's <c>xmin</c> system column
/// (DATABASE.md §2: listings, sellers, categories). <see cref="Version"/> changes on every update of the row.
/// </summary>
public interface IHasRowVersion
{
    uint Version { get; set; }
}

/// <summary>
/// The <c>xmin</c> helper. A client reads an entity with its version token, sends the token back with its change, and
/// the update fails with <see cref="DbUpdateConcurrencyException"/> (409 "concurrency-conflict") when somebody else
/// changed the row in between: the second moderator's decision does not overwrite the first one (ARCHITECTURE.md §6).
/// </summary>
public static class RowVersion
{
    /// <summary>Maps <see cref="IHasRowVersion.Version"/> to <c>xmin</c> as a concurrency token (no real column).</summary>
    public static PropertyBuilder<uint> HasXminRowVersion<T>(this EntityTypeBuilder<T> builder)
        where T : class, IHasRowVersion =>
        builder.Property(e => e.Version)
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

    /// <summary>Makes the next save check the version the client saw instead of the one just loaded.</summary>
    public static void SetExpectedVersion<T>(this DbContext db, T entity, uint version)
        where T : class, IHasRowVersion =>
        db.Entry(entity).Property(e => e.Version).OriginalValue = version;

    /// <summary>The version as the API sends it: a decimal string (<c>"version": "7342"</c>).</summary>
    public static string Format(uint version) => version.ToString(CultureInfo.InvariantCulture);

    public static bool TryParse(string? token, out uint version) =>
        uint.TryParse(token, NumberStyles.None, CultureInfo.InvariantCulture, out version);
}
