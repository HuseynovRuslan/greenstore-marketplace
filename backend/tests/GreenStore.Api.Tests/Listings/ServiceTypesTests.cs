using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using GreenStore.Api.Modules.Admin;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Listings;

/// <summary>
/// A service with several types (backend-contract.md 1.3, 26 November 2026): <c>ListingInput.subcategoryIds</c>, the
/// lists in the answers, the catalogue filter, the search, the edit of a published service, the moderator's diff and
/// the admin's counts, guard and renaming.
/// </summary>
[Collection(LifecycleCollection.Name)]
public sealed class ServiceTypesTests(LifecycleApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static string Unique() => Guid.NewGuid().ToString("N")[..6];

    private static JsonArray Ids(params string[] ids) => new(ids.Select(id => (JsonNode)JsonValue.Create(id)!).ToArray());

    /// <summary>Posts a service of the types (the first its main one) and approves it; returns the <c>ListingSubmitResult</c>.</summary>
    private async Task<JsonElement> PublishAsync(Account owner, string[] types, Action<JsonObject>? edit = null)
    {
        var photo = await api.UploadPhotoAsync(owner.Token);
        var input = LifecycleApi.ServiceInput([photo], owner.Phone, "Landşaft dizaynı", "baki", "baki,abseron", i =>
        {
            i["subcategoryIds"] = Ids(types);
            edit?.Invoke(i);
        });
        var response = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", input, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /listings: {(int)response.StatusCode} {body}");
        await api.ApproveAsync(body.GetProperty("id").GetString()!);
        return body;
    }

    private async Task<JsonElement> GetAsync(string path, string? token = null, string? language = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (language is not null)
        {
            request.Headers.AcceptLanguage.ParseAdd(language);
        }

        var response = await api.Client(token).SendAsync(request, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"GET {path}: {(int)response.StatusCode} {body}");
        return body;
    }

    private async Task<IReadOnlyList<long>> ServiceNumbersAsync(string query) =>
        Json.Numbers(Json.Items(await GetAsync($"/api/v1/services?pageSize=60&{query}")));

    [Fact]
    public async Task A_service_with_several_types_is_found_under_each_and_shows_them_all()
    {
        var owner = await api.RegisterBusinessAsync();
        var word = $"layihe{Unique()}";
        var sent = await PublishAsync(owner, ["landsaft-dizayni", "bag-baximi"], i => i["title"] = $"Həyət {word}");
        var id = sent.GetProperty("id").GetString()!;
        var number = sent.GetProperty("number").GetInt64();

        // The catalogue finds it under each of its types, and not under another.
        Assert.Contains(number, await ServiceNumbersAsync("categoryId=landsaft-dizayni"));
        Assert.Contains(number, await ServiceNumbersAsync("categoryId=bag-baximi"));
        Assert.DoesNotContain(number, await ServiceNumbersAsync("categoryId=cim-salinmasi"));
        // The second type's names are in the search text, in every language.
        Assert.Equal([number], await ServiceNumbersAsync($"q={word}+baximi"));
        Assert.Equal([number], await ServiceNumbersAsync($"q={word}+уход"));

        var page = await GetAsync($"/api/v1/services/{sent.GetProperty("slug").GetString()}", language: "en");
        Assert.Equal("landsaft-dizayni", page.GetProperty("categoryId").GetString());
        Assert.Equal(["landsaft-dizayni", "bag-baximi"], Json.Strings(page.GetProperty("categoryIds")));
        NoProblems(Contract.Check(page, "Service"));

        var own = await GetAsync($"/api/v1/me/listings/{id}", owner.Token, "ru");
        Assert.Equal("landsaft-dizayni", own.GetProperty("subcategoryId").GetString());
        Assert.Equal(["landsaft-dizayni", "bag-baximi"], Json.Strings(own.GetProperty("subcategoryIds")));
        Assert.Equal(["Ландшафтный дизайн", "Уход за садом"], Json.Strings(own.GetProperty("subcategories")));
        NoProblems(Contract.CheckOwnListing(own));
        var az = await GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal(["Landşaft dizaynı", "Bağ baxımı"], Json.Strings(az.GetProperty("subcategories")));

        await using var db = api.CreateDbContext();
        var row = await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct);
        Assert.Equal("landsaft-dizayni", row.SubcategoryId);
        Assert.Equal(["landsaft-dizayni", "bag-baximi"], row.SubcategoryIds);
    }

    [Fact]
    public async Task An_edit_may_change_the_other_types_and_the_moderator_sees_it()
    {
        var owner = await api.RegisterAsync();
        var id = (await PublishAsync(owner, ["landsaft-dizayni", "bag-baximi"])).GetProperty("id").GetString()!;
        var photoIds = Json.Strings((await GetAsync($"/api/v1/me/listings/{id}", owner.Token)).GetProperty("photoIds"));
        JsonObject Edit(params string[] types) =>
            LifecycleApi.ServiceInput(photoIds, owner.Phone, "Landşaft dizaynı", "baki", "baki,abseron", i => i["subcategoryIds"] = Ids(types));

        var edited = await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", Edit("landsaft-dizayni", "cim-salinmasi"), Ct);

        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var item = await api.ModerationItemAsync(await api.ModeratorTokenAsync(), id);
        var changes = item.GetProperty("changes").EnumerateArray().Select(c => (c.GetProperty("field").GetString(), Json.String(c, "before"), Json.String(c, "after"))).ToList();
        Assert.Contains(("subcategoryIds", "landsaft-dizayni,bag-baximi", "landsaft-dizayni,cim-salinmasi"), changes);
        Assert.DoesNotContain(changes, c => c.Item1 == "subcategoryId");

        // The main type is locked like the category; the list keeps its limits.
        var moved = await ProblemAsync(
            await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", Edit("bag-baximi", "landsaft-dizayni"), Ct),
            HttpStatusCode.BadRequest,
            "validation");
        Assert.Equal("locked", moved.GetProperty("errors").GetProperty("categoryId")[0].GetString());
        var seven = new[] { "landsaft-dizayni", "bag-baximi", "cim-salinmasi", "agac-ekilmesi", "avtomatik-suvarma", "heyetyani-yasillasdirma", "yoxdur" };
        var many = await ProblemAsync(
            await api.Client(owner.Token).PutAsJsonAsync($"/api/v1/me/listings/{id}", Edit(seven), Ct),
            HttpStatusCode.BadRequest,
            "validation");
        Assert.Equal("too-many", many.GetProperty("errors").GetProperty("subcategoryIds")[0].GetString());

        await using var db = api.CreateDbContext();
        Assert.Equal(["landsaft-dizayni", "cim-salinmasi"], (await db.Listings.AsNoTracking().SingleAsync(l => l.Id == Guid.Parse(id), Ct)).SubcategoryIds);
    }

    [Fact]
    public async Task A_product_sends_at_most_one_sub_category_in_the_list()
    {
        var owner = await api.RegisterAsync();
        var photo = await api.UploadPhotoAsync(owner.Token);

        var two = await ProblemAsync(
            await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone, i => i["subcategoryIds"] = Ids("agaclar-meyve", "agaclar-iynəyarpaqli")), Ct),
            HttpStatusCode.BadRequest,
            "validation");
        Assert.Equal("too-many", two.GetProperty("errors").GetProperty("subcategoryIds")[0].GetString());

        var one = await api.Client(owner.Token).PostAsJsonAsync("/api/v1/listings", LifecycleApi.TreeInput([photo], owner.Phone, i => i["subcategoryIds"] = Ids("agaclar-meyve")), Ct);
        Assert.Equal(HttpStatusCode.Created, one.StatusCode);
        var id = (await JsonAsync(one)).GetProperty("id").GetString()!;
        var own = await GetAsync($"/api/v1/me/listings/{id}", owner.Token);
        Assert.Equal(["agaclar-meyve"], Json.Strings(own.GetProperty("subcategoryIds")));
        Assert.Equal(["Meyvə ağacları"], Json.Strings(own.GetProperty("subcategories")));
    }

    [Fact]
    public async Task A_type_used_as_another_type_counts_cannot_be_deleted_and_renames_the_search()
    {
        var admin = await api.AdminTokenAsync();
        var created = await api.Client(admin).PostAsJsonAsync(
            "/api/v1/admin/categories",
            new { parentId = "landsaft-xidmetleri", names = new { az = $"Hovuz {Unique()}" } },
            Ct);
        var type = await JsonAsync(created);
        Assert.True(created.StatusCode == HttpStatusCode.Created, $"POST /admin/categories: {(int)created.StatusCode} {type}");
        var typeId = type.GetProperty("id").GetString()!;

        // Only as the second type of a service.
        var first = await PublishAsync(await api.RegisterAsync(), ["cim-salinmasi", typeId]);
        var firstNumber = first.GetProperty("number").GetInt64();
        Assert.Equal([firstNumber], await ServiceNumbersAsync($"categoryId={typeId}"));
        Assert.Equal(1, (await GetAsync($"/api/v1/admin/categories/{typeId}", admin)).GetProperty("listingCount").GetInt32());
        await ProblemAsync(await api.Client(admin).DeleteAsync($"/api/v1/admin/categories/{typeId}", Ct), HttpStatusCode.Conflict, AdminErrors.CategoryInUse);

        var word = $"бассейн{Unique()}";
        var renamed = await api.Client(admin).PatchAsJsonAsync(
            $"/api/v1/admin/categories/{typeId}",
            new { names = new { az = type.GetProperty("names").GetProperty("az").GetString(), ru = $"Бассейны {word}" }, version = type.GetProperty("version").GetString() },
            Ct);
        Assert.Equal(HttpStatusCode.OK, renamed.StatusCode);
        Assert.Equal([firstNumber], await ServiceNumbersAsync($"q={word}"));

        // A service of that type finds the first one similar: they share a type, though not the main one.
        var second = await PublishAsync(await api.RegisterAsync(), [typeId]);
        var related = await GetAsync($"/api/v1/services/{second.GetProperty("id").GetString()}/related");
        Assert.Equal(firstNumber, Json.Numbers(related.GetProperty("similar").EnumerateArray())[0]);
        Assert.Equal(2, (await GetAsync($"/api/v1/admin/categories/{typeId}", admin)).GetProperty("listingCount").GetInt32());

        // Leave the service category as it was for the other tests.
        Assert.Equal(HttpStatusCode.OK, (await api.Client(admin).PatchAsJsonAsync($"/api/v1/admin/categories/{typeId}", new { isActive = false }, Ct)).StatusCode);
    }

    private static void NoProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));
}
