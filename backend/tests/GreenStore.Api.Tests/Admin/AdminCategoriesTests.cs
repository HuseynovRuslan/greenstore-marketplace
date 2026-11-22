using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Tests.Infrastructure;
using GreenStore.Api.Tests.Listings;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Admin;

/// <summary>
/// «Kateqoriya idarəetməsi» end to end: names in three languages, sub-categories, filters, the search text of renamed
/// categories, versions, deletion and the audit log. The tests make categories of their own and leave the seeded ones.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class AdminCategoriesTests(LifecycleApi api)
{
    private static string Unique() => Guid.NewGuid().ToString("N")[..6];

    private async Task<JsonElement> CreateAsync(string admin, object body)
    {
        var response = await api.Client(admin).PostAsJsonAsync("/api/v1/admin/categories", body, Ct);
        var json = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /admin/categories: {(int)response.StatusCode} {json}");
        return json;
    }

    [Fact]
    public async Task The_admin_sees_every_category_with_its_names_in_three_languages()
    {
        var admin = await api.AdminTokenAsync();

        var all = await api.GetAsync("/api/v1/admin/categories?kind=product", admin);

        var trees = all.EnumerateArray().Single(c => c.GetProperty("id").GetString() == "agaclar");
        Assert.Equal("Ağaclar", trees.GetProperty("names").GetProperty("az").GetString());
        Assert.Equal("Деревья", trees.GetProperty("names").GetProperty("ru").GetString());
        Assert.Equal("Trees", trees.GetProperty("names").GetProperty("en").GetString());
        Assert.Equal("plant", trees.GetProperty("form").GetString());
        Assert.Equal("rootSystem", trees.GetProperty("filters")[0].GetProperty("id").GetString());
        Assert.Contains(trees.GetProperty("subcategories").EnumerateArray(), s => s.GetProperty("id").GetString() == "agaclar-meyve" && s.GetProperty("parentId").GetString() == "agaclar");
        Assert.True(trees.GetProperty("listingCount").GetInt32() > 0);
        Assert.False(string.IsNullOrEmpty(trees.GetProperty("version").GetString()));
        Assert.All(all.EnumerateArray(), c => Assert.Equal("product", c.GetProperty("kind").GetString()));

        var one = await api.GetAsync("/api/v1/admin/categories/agaclar-meyve", admin);
        Assert.Equal("Meyvə ağacları", one.GetProperty("names").GetProperty("az").GetString());
        Assert.False(one.TryGetProperty("subcategories", out _));
        await ProblemAsync(await api.Client(admin).GetAsync("/api/v1/admin/categories/yoxdur", Ct), HttpStatusCode.NotFound, AdminErrors.CategoryNotFound);
    }

    [Fact]
    public async Task A_new_category_and_its_sub_category_are_on_the_site_at_once()
    {
        var admin = await api.AdminTokenAsync();
        var name = $"Bağ dekoru {Unique()}";
        var root = await CreateAsync(admin, new
        {
            kind = "product",
            form = "goods",
            names = new { az = name, ru = $"Садовый декор {name[^6..]}", en = "Garden decor" },
            descriptions = new { az = "Dibçəklər, heykəllər və işıqlar" },
            icon = "amphora",
            sortOrder = 900,
        });
        var id = root.GetProperty("id").GetString()!;
        Assert.StartsWith("bag-dekoru-", id, StringComparison.Ordinal);
        var sub = await CreateAsync(admin, new { parentId = id, names = new { az = "Dibçəklər" } });
        Assert.Equal("product", sub.GetProperty("kind").GetString());
        Assert.False(sub.TryGetProperty("form", out _));

        var client = api.Client();
        client.DefaultRequestHeaders.AcceptLanguage.Add(new StringWithQualityHeaderValue("ru"));
        var shown = await JsonAsync(await client.GetAsync($"/api/v1/categories/{id}", Ct));
        Assert.Equal($"Садовый декор {name[^6..]}", shown.GetProperty("name").GetString());
        Assert.Equal("amphora", shown.GetProperty("icon").GetString());
        Assert.Equal(name, (await JsonAsync(await api.Client().GetAsync($"/api/v1/categories/{id}", Ct))).GetProperty("name").GetString());

        // A second one of the same name under the same parent is refused.
        var twice = await ProblemAsync(await api.Client(admin).PostAsJsonAsync("/api/v1/admin/categories", new { parentId = id, names = new { az = "dibcekler" } }, Ct), HttpStatusCode.BadRequest, "validation");
        Assert.Equal(AdminErrors.NameTaken, twice.GetProperty("errors").GetProperty("names.az")[0].GetString());

        await using var db = api.CreateDbContext();
        Assert.Equal(2, await db.AuditLog.CountAsync(e => e.Action == "category.create" && (e.TargetId == id || e.TargetId == sub.GetProperty("id").GetString()), Ct));
        Assert.Contains(await OutboxRows.WithAsync(db, "\"taxonomy\""), m => m.Type == OutboxTypes.Revalidate);

        // Taken off the site again: the public read no longer finds it; the admin still does.
        var off = await api.Client(admin).PatchAsJsonAsync($"/api/v1/admin/categories/{id}", new { isActive = false }, Ct);
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);
        Assert.False((await JsonAsync(off)).GetProperty("isActive").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await api.Client().GetAsync($"/api/v1/categories/{id}", Ct)).StatusCode);
    }

    [Fact]
    public async Task Renaming_a_sub_category_makes_its_listings_findable_by_the_new_name()
    {
        var admin = await api.AdminTokenAsync();
        var root = await CreateAsync(admin, new
        {
            kind = "product",
            form = "plant",
            names = new { az = $"Test ağacları {Unique()}" },
            icon = "trees",
            filters = new[] { new { id = "rootSystem", enabled = true } },
        });
        var rootId = root.GetProperty("id").GetString()!;
        var subName = $"Sidr {Unique()}";
        var sub = await CreateAsync(admin, new { parentId = rootId, names = new { az = subName } });
        var subId = sub.GetProperty("id").GetString()!;
        var owner = await api.RegisterAsync();
        var listing = await api.PublishAsync(owner, input =>
        {
            input["categoryId"] = rootId;
            input["subcategory"] = subName;
        });
        var number = listing.GetProperty("number").GetInt64();
        var word = $"кедрик{Unique()}";
        Assert.Empty(Json.Items(await JsonAsync(await api.Client().GetAsync($"/api/v1/listings?q={word}", Ct))));

        var renamed = await api.Client(admin).PatchAsJsonAsync(
            $"/api/v1/admin/categories/{subId}",
            new { names = new { az = subName, ru = $"Кедры {word}" }, version = sub.GetProperty("version").GetString() },
            Ct);

        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        var found = Json.Items(await JsonAsync(await api.Client().GetAsync($"/api/v1/listings?q={word}", Ct)));
        Assert.Equal([number], Json.Numbers(found));
        await using var db = api.CreateDbContext();
        var audit = await db.AuditLog.AsNoTracking().SingleAsync(e => e.Action == "category.update" && e.TargetId == subId, Ct);
        using (var data = JsonDocument.Parse(audit.Data!))
        {
            Assert.Equal(1, data.RootElement.GetProperty("searchTextsRebuilt").GetInt32());
            Assert.Equal($"Кедры {word}", data.RootElement.GetProperty("after").GetProperty("name").GetProperty("ru").GetString());
        }

        // The version read before the rename is stale now.
        await ProblemAsync(
            await api.Client(admin).PatchAsJsonAsync($"/api/v1/admin/categories/{subId}", new { sortOrder = 5, version = sub.GetProperty("version").GetString() }, Ct),
            HttpStatusCode.Conflict,
            "concurrency-conflict");
        await ProblemAsync(
            await api.Client(admin).PatchAsJsonAsync($"/api/v1/admin/categories/{subId}", new { sortOrder = 5, version = "x" }, Ct),
            HttpStatusCode.BadRequest,
            "validation");

        // In use: not deleted, only taken off the site.
        await ProblemAsync(await api.Client(admin).DeleteAsync($"/api/v1/admin/categories/{subId}", Ct), HttpStatusCode.Conflict, AdminErrors.CategoryInUse);
        await ProblemAsync(await api.Client(admin).DeleteAsync($"/api/v1/admin/categories/{rootId}", Ct), HttpStatusCode.Conflict, AdminErrors.CategoryInUse);
        Assert.Equal(HttpStatusCode.OK, (await api.Client(admin).PatchAsJsonAsync($"/api/v1/admin/categories/{rootId}", new { isActive = false }, Ct)).StatusCode);
    }

    [Fact]
    public async Task A_category_nothing_uses_can_be_deleted()
    {
        var admin = await api.AdminTokenAsync();
        var root = await CreateAsync(admin, new { kind = "product", form = "goods", names = new { az = $"Səhvən {Unique()}" }, icon = "shovel", isActive = false });
        var id = root.GetProperty("id").GetString()!;

        Assert.Equal(HttpStatusCode.NoContent, (await api.Client(admin).DeleteAsync($"/api/v1/admin/categories/{id}", Ct)).StatusCode);

        await ProblemAsync(await api.Client(admin).GetAsync($"/api/v1/admin/categories/{id}", Ct), HttpStatusCode.NotFound, AdminErrors.CategoryNotFound);
        await ProblemAsync(await api.Client(admin).DeleteAsync($"/api/v1/admin/categories/{id}", Ct), HttpStatusCode.NotFound, AdminErrors.CategoryNotFound);
        await using var db = api.CreateDbContext();
        Assert.True(await db.AuditLog.AnyAsync(e => e.Action == "category.delete" && e.TargetId == id, Ct));
    }

    [Fact]
    public async Task A_bad_category_is_refused_by_field()
    {
        var admin = await api.AdminTokenAsync();

        var problem = await ProblemAsync(
            await api.Client(admin).PostAsJsonAsync("/api/v1/admin/categories", new { kind = "service", form = "plant", names = new { ru = "Только русский" }, icon = "rose" }, Ct),
            HttpStatusCode.BadRequest,
            "validation");

        Assert.Equal(["form", "icon", "names.az"], problem.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order());
        var patch = await ProblemAsync(
            await api.Client(admin).PatchAsJsonAsync("/api/v1/admin/categories/agaclar-meyve", new { icon = "trees", filters = new[] { new { id = "age", enabled = true } } }, Ct),
            HttpStatusCode.BadRequest,
            "validation");
        Assert.Equal(["filters", "icon"], patch.GetProperty("errors").EnumerateObject().Select(e => e.Name).Order());
        await ProblemAsync(await api.Client(admin).PatchAsJsonAsync("/api/v1/admin/categories/yoxdur", new { sortOrder = 1 }, Ct), HttpStatusCode.NotFound, AdminErrors.CategoryNotFound);
    }
}
