using GreenStore.Api.Common;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Data;

/// <summary>The data conventions on a test-only table: snake_case, LocalizedText as jsonb, updated_at, xmin.</summary>
public sealed class DataConventionsTests(WidgetTables tables) : IClassFixture<WidgetTables>
{
    private static readonly DateTimeOffset T0 = new(2026, 11, 22, 8, 0, 0, TimeSpan.Zero);
    private readonly ManualTimeProvider clock = new(T0);

    private WidgetDbContext Db() => WidgetDbContext.Create(tables.Database, clock);

    private async Task<Widget> AddWidgetAsync(LocalizedText? name = null)
    {
        var widget = new Widget { Id = Ids.New(clock), Name = name ?? new LocalizedText("Güllər", "Розы"), Stock = 1, CreatedAt = clock.GetUtcNow() };
        await using var db = Db();
        db.Widgets.Add(widget);
        await db.SaveChangesAsync(Ct);
        return widget;
    }

    [Fact]
    public async Task Tables_and_columns_are_snake_case_and_xmin_is_not_a_real_column()
    {
        var columns = new List<string>();
        await using (var connection = new NpgsqlConnection(tables.Database.ConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new NpgsqlCommand(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'infra_test' AND table_name = 'widgets' ORDER BY column_name",
                connection);
            await using var reader = await command.ExecuteReaderAsync(Ct);
            while (await reader.ReadAsync(Ct))
            {
                columns.Add(reader.GetString(0));
            }
        }

        Assert.Equal(["created_at", "id", "name", "stock", "updated_at"], columns);
    }

    [Fact]
    public async Task LocalizedText_is_stored_as_a_jsonb_object_and_read_back()
    {
        var widget = await AddWidgetAsync(new LocalizedText("Güllər", "Розы"));

        await using var db = Db();
        var loaded = await db.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
        Assert.Equal(new LocalizedText("Güllər", "Розы"), loaded.Name);

        Assert.Equal("object", await tables.Database.ScalarAsync<string>($"SELECT jsonb_typeof(name) FROM infra_test.widgets WHERE id = '{widget.Id}'"));
        Assert.Equal("Розы", await tables.Database.ScalarAsync<string>($"SELECT name->>'ru' FROM infra_test.widgets WHERE id = '{widget.Id}'"));
        Assert.False(await tables.Database.ScalarAsync<bool>($"SELECT name ? 'en' FROM infra_test.widgets WHERE id = '{widget.Id}'"));
    }

    [Fact]
    public async Task A_localized_column_without_az_is_refused_by_the_database()
    {
        var error = await Assert.ThrowsAsync<PostgresException>(() => tables.Database.ScalarAsync<int>(
            $"INSERT INTO infra_test.widgets (id, name, stock, created_at, updated_at) VALUES ('{Guid.CreateVersion7()}', '{{\"ru\": \"Розы\"}}', 0, now(), now())"));
        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
    }

    [Fact]
    public async Task Updated_at_is_set_on_insert_and_on_every_change()
    {
        var widget = await AddWidgetAsync();
        Assert.Equal(T0, widget.UpdatedAt);

        clock.Advance(TimeSpan.FromMinutes(5));
        await using (var db = Db())
        {
            var loaded = await db.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
            loaded.Stock = 2;
            await db.SaveChangesAsync(Ct);
        }

        clock.Advance(TimeSpan.FromMinutes(5));
        await using (var db = Db())
        {
            // Saving without changes does not touch updated_at.
            _ = await db.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
            await db.SaveChangesAsync(Ct);
        }

        await using var check = Db();
        var stored = await check.Widgets.AsNoTracking().SingleAsync(w => w.Id == widget.Id, Ct);
        Assert.Equal(T0.AddMinutes(5), stored.UpdatedAt);
        Assert.Equal(T0, stored.CreatedAt);
    }

    [Fact]
    public async Task The_second_of_two_concurrent_updates_fails()
    {
        var widget = await AddWidgetAsync();

        await using var first = Db();
        await using var second = Db();
        var a = await first.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
        var b = await second.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
        Assert.NotEqual(0u, a.Version);
        Assert.Equal(a.Version, b.Version);

        a.Stock = 10;
        await first.SaveChangesAsync(Ct);
        Assert.NotEqual(b.Version, a.Version);

        b.Stock = 20;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync(Ct));

        await using var check = Db();
        Assert.Equal(10, (await check.Widgets.AsNoTracking().SingleAsync(w => w.Id == widget.Id, Ct)).Stock);
    }

    [Fact]
    public async Task A_client_version_token_is_checked_on_save()
    {
        var widget = await AddWidgetAsync();
        uint seenByClient;
        await using (var db = Db())
        {
            seenByClient = (await db.Widgets.AsNoTracking().SingleAsync(w => w.Id == widget.Id, Ct)).Version;
        }

        // Somebody else changes the row after the client read it.
        await using (var other = Db())
        {
            (await other.Widgets.SingleAsync(w => w.Id == widget.Id, Ct)).Stock = 5;
            await other.SaveChangesAsync(Ct);
        }

        await using (var stale = Db())
        {
            var loaded = await stale.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
            stale.SetExpectedVersion(loaded, seenByClient);
            loaded.Stock = 7;
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => stale.SaveChangesAsync(Ct));
        }

        await using (var fresh = Db())
        {
            var loaded = await fresh.Widgets.SingleAsync(w => w.Id == widget.Id, Ct);
            Assert.True(RowVersion.TryParse(RowVersion.Format(loaded.Version), out var token));
            fresh.SetExpectedVersion(loaded, token);
            loaded.Stock = 8;
            await fresh.SaveChangesAsync(Ct);
        }
    }
}
