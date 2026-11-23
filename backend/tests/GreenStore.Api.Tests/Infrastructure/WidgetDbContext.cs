using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// <see cref="AppDbContext"/> plus one test-only table (<c>infra_test.widgets</c>), to test the data conventions on a
/// table of their own: snake_case names, LocalizedText as jsonb, the updated_at interceptor and xmin.
/// </summary>
public sealed class WidgetDbContext(DbContextOptions<WidgetDbContext> options) : AppDbContext(options)
{
    public DbSet<Widget> Widgets => Set<Widget>();

    public static WidgetDbContext Create(PostgresDatabase database, TimeProvider clock)
    {
        var options = new DbContextOptionsBuilder<WidgetDbContext>();
        DatabaseSetup.Configure(options, database.ConnectionString);
        options.AddInterceptors(new UpdatedAtInterceptor(clock));
        return new WidgetDbContext(options.Options);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Widget>(widget =>
        {
            widget.ToTable("widgets", "infra_test", t => t.HasCheckConstraint("ck_widgets_name", LocalizedTextMapping.CheckSql("name")));
            widget.Property(w => w.Id).ValueGeneratedNever();
            widget.Property(w => w.Name).IsLocalizedText();
            widget.HasXminRowVersion();
        });
    }
}

public sealed class Widget : IHasUpdatedAt, IHasRowVersion
{
    public Guid Id { get; set; }

    public required LocalizedText Name { get; set; }

    public int Stock { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public uint Version { get; set; }
}

/// <summary>
/// Creates the widgets table once per test run. Only this table: the rest of the model already exists, created by the
/// migrations, so EF's "create every table" would fail. The DDL is what EF generates for <see cref="Widget"/>.
/// </summary>
public sealed class WidgetTables(PostgresDatabase database) : IAsyncLifetime
{
    public PostgresDatabase Database => database;

    public async ValueTask InitializeAsync()
    {
        await using var db = WidgetDbContext.Create(database, TimeProvider.System);
        var widgets = db.Model.FindEntityType(typeof(Widget))!;
        var script = db.Database.GenerateCreateScript();
        var create = script
            .Split(";", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Single(statement => statement.StartsWith($"CREATE TABLE {widgets.GetSchema()}.{widgets.GetTableName()} ", StringComparison.Ordinal));
        var sql = "CREATE SCHEMA IF NOT EXISTS " + widgets.GetSchema() + "; " + create + ";";
        await db.Database.ExecuteSqlRawAsync(sql);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
