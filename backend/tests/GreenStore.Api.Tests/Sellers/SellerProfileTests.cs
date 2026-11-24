using System.Net;
using System.Text;
using System.Text.Json;
using GreenStore.Api.Tests.Infrastructure;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Sellers;

/// <summary>
/// <c>GET</c> and <c>PATCH /me/seller</c>: a business edits its «mağaza» on /kabinet/profil and its page
/// /saticilar/&lt;slug&gt; shows it at once.
/// </summary>
[Collection(AccountsCollection.Name)]
public sealed class SellerProfileTests(AccountsApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private Task<Account> BusinessAsync(string name = "Şəki Fidanlığı") =>
        api.RegisterAsync(accountType: "business", companyName: name, businessKinds: ["nursery"], fullName: "Aysel Kərimova");

    private static Task<HttpResponseMessage> Patch(HttpClient client, string json) =>
        client.PatchAsync("/api/v1/me/seller", new StringContent(json, Encoding.UTF8, "application/json"), Ct);

    /// <summary>The owner's view is the public <c>Seller</c> plus <c>phone</c> and <c>version</c>.</summary>
    private static void AssertOwnSeller(JsonElement body)
    {
        Assert.Equal(JsonValueKind.String, body.GetProperty("version").ValueKind);
        using var document = JsonDocument.Parse(JsonSerializer.Serialize(
            body.EnumerateObject().Where(p => p.Name is not ("version" or "phone")).ToDictionary(p => p.Name, p => p.Value)));
        Assert.Empty(Contract.Check(document.RootElement, "Seller"));
    }

    [Fact]
    public async Task The_owner_reads_the_profile_with_its_version()
    {
        var business = await BusinessAsync();

        var profile = await api.GetAsync("/api/v1/me/seller", business.Token);

        AssertOwnSeller(profile);
        Assert.Equal("seki-fidanligi", profile.GetProperty("slug").GetString());
        Assert.Equal("Aysel Kərimova", profile.GetProperty("contactPerson").GetString());
        Assert.False(profile.TryGetProperty("phone", out _));
    }

    [Fact]
    public async Task The_profile_form_saves_and_the_seller_page_shows_it_at_once()
    {
        var business = await BusinessAsync("Quba Alma Bağları");
        var slug = (await api.GetAsync("/api/v1/me/seller", business.Token)).GetProperty("slug").GetString();

        var response = await Patch(api.Client(business.Token), """
            {
              "name": "Quba Alma Evi", "businessKinds": ["garden-centre", "nursery"], "contactPerson": "Rauf Həsənli", "cityId": "quba",
              "address": "Qırmızı Qəsəbə yolu 12", "about": "Quba almasının ən yaxşı sortları.\nÇatdırılma var.",
              "terms": "Sifarişlər 2 günə çatdırılır.", "offers": ["delivery", "wholesale"],
              "hours": [{ "day": 1, "open": "09:00", "close": "18:00" }, { "day": 7, "closed": true }],
              "phone": "+994 23 335 12 08", "whatsapp": true, "email": "satis@qubaalma.az", "instagram": "@qubaalma",
              "website": "https://qubaalma.az", "responseMinutes": 60, "location": { "lat": 41.361, "lng": 48.512 }
            }
            """);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var own = await JsonAsync(response);
        AssertOwnSeller(own);
        Assert.Equal("+994233351208", own.GetProperty("phone").GetString());

        var page = await api.GetAsync($"/api/v1/sellers/{slug}", business.Token);
        Assert.Empty(Contract.Check(page, "Seller"));
        Assert.Equal("Quba Alma Evi", page.GetProperty("name").GetString());
        Assert.Equal("Tingçilik təsərrüfatı · Bağ mərkəzi", page.GetProperty("kind").GetString());
        Assert.Equal(["nursery", "garden-centre"], Json.Strings(page.GetProperty("businessKinds")));
        Assert.Equal("Rauf Həsənli", page.GetProperty("contactPerson").GetString());
        Assert.Equal("quba", page.GetProperty("cityId").GetString());
        Assert.Equal("Qırmızı Qəsəbə yolu 12", page.GetProperty("address").GetString());
        Assert.Equal("Quba almasının ən yaxşı sortları.\nÇatdırılma var.", page.GetProperty("about").GetString());
        Assert.Equal("Sifarişlər 2 günə çatdırılır.", page.GetProperty("terms").GetString());
        Assert.Equal(["delivery", "wholesale"], Json.Strings(page.GetProperty("offers")));
        Assert.Equal(2, page.GetProperty("hours").GetArrayLength());
        Assert.True(page.GetProperty("whatsapp").GetBoolean());
        Assert.Equal("satis@qubaalma.az", page.GetProperty("email").GetString());
        Assert.Equal("https://qubaalma.az", page.GetProperty("website").GetString());
        Assert.Equal(60, page.GetProperty("responseMinutes").GetInt32());
        Assert.Equal(41.361m, page.GetProperty("location").GetProperty("lat").GetDecimal());
        // The business's own number, masked; never the number itself on the public page.
        Assert.Equal("+994 23 *** ** 08", page.GetProperty("phoneMasked").GetString());
        Assert.False(page.TryGetProperty("phone", out _));
        // The address of the page stays.
        Assert.Equal(slug, page.GetProperty("slug").GetString());

        var directory = await api.GetAsync("/api/v1/sellers?cityId=quba&businessKind=garden-centre&pageSize=60", business.Token);
        Assert.Contains(directory.GetProperty("items").EnumerateArray(), s => s.GetProperty("slug").GetString() == slug);
    }

    [Fact]
    public async Task An_emptied_field_leaves_the_page()
    {
        var business = await BusinessAsync("Gəncə Gül Evi");
        var client = api.Client(business.Token);
        await Patch(client, """{ "about": "Güllər", "website": "https://gul.az" }""");

        var own = await JsonAsync(await Patch(client, """{ "about": "", "website": null }"""));

        Assert.False(own.TryGetProperty("about", out _));
        Assert.False(own.TryGetProperty("website", out _));
        Assert.Equal("Gəncə Gül Evi", own.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Wrong_values_are_named_and_nothing_is_saved()
    {
        var business = await BusinessAsync("Sumqayıt Bağ");
        var client = api.Client(business.Token);

        var problem = await ProblemAsync(
            await Patch(client, """{ "name": "", "cityId": "paris", "website": "bag", "address": "Yeni ünvan" }"""),
            HttpStatusCode.BadRequest,
            "validation");

        var errors = problem.GetProperty("errors");
        Assert.Equal("required", errors.GetProperty("name")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("cityId")[0].GetString());
        Assert.Equal("invalid", errors.GetProperty("website")[0].GetString());
        var profile = await api.GetAsync("/api/v1/me/seller", business.Token);
        Assert.Equal("Sumqayıt Bağ", profile.GetProperty("name").GetString());
        Assert.False(profile.TryGetProperty("address", out _));
    }

    [Fact]
    public async Task A_stale_version_is_a_conflict_not_an_overwrite()
    {
        var business = await BusinessAsync("Abşeron Çəmən");
        var client = api.Client(business.Token);
        var version = (await api.GetAsync("/api/v1/me/seller", business.Token)).GetProperty("version").GetString();

        var first = await JsonAsync(await Patch(client, $$"""{ "about": "Birinci", "version": "{{version}}" }"""));
        var second = await Patch(client, $$"""{ "about": "İkinci", "version": "{{version}}" }""");

        Assert.NotEqual(version, first.GetProperty("version").GetString());
        await ProblemAsync(second, HttpStatusCode.Conflict, "concurrency-conflict");
        Assert.Equal("Birinci", (await api.GetAsync("/api/v1/me/seller", business.Token)).GetProperty("about").GetString());
        await ProblemAsync(await Patch(client, """{ "about": "x", "version": "abc" }"""), HttpStatusCode.BadRequest, "validation");
    }

    [Fact]
    public async Task An_individual_has_no_shop()
    {
        var person = await api.RegisterAsync();

        await ProblemAsync(await api.Client(person.Token).GetAsync("/api/v1/me/seller", Ct), HttpStatusCode.NotFound, "seller.not-found");
        await ProblemAsync(await Patch(api.Client(person.Token), """{ "about": "x" }"""), HttpStatusCode.NotFound, "seller.not-found");
    }

    [Fact]
    public async Task Without_a_session_there_is_no_profile() =>
        await ProblemAsync(await api.Client().GetAsync("/api/v1/me/seller", Ct), HttpStatusCode.Unauthorized, "unauthorized");
}
