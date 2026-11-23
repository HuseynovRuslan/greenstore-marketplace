using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Sellers;
using GreenStore.Api.Modules.Taxonomy;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Api;

/// <summary>
/// Every public read response against the frontend's types (backend/contracts/frontend-types.json, generated from
/// src/types): the same property names, JSON kinds and enum strings, only the approved additions on top
/// (backend-contract.md), and never a phone number (decision 4, backend-contract.md 3.1).
/// </summary>
[Collection(CatalogueCollection.Name)]
public sealed class ContractShapeTests(CatalogueApi api)
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Fact]
    public async Task Taxonomy_matches_Category_and_City()
    {
        foreach (var language in new[] { "az", "ru", "en" })
        {
            NoProblems(Contract.Check(await api.GetAsync("/api/v1/categories", language), "Category[]"));
            NoProblems(Contract.Check(await api.GetAsync("/api/v1/categories/agaclar", language), "Category"));
            NoProblems(Contract.Check(await api.GetAsync("/api/v1/cities", language), "City[]"));
        }
    }

    [Fact]
    public async Task Home_matches_HomeContent() =>
        NoProblems(Contract.Check(await api.GetAsync("/api/v1/home"), "HomeContent"));

    [Fact]
    public async Task Every_listing_matches_Listing()
    {
        var page = await api.GetAsync($"/api/v1/listings?pageSize={Json.AllOnOnePage}");
        NoProblems(Contract.CheckPage(page, "Listing"));
        Assert.NotEmpty(Json.Items(page));

        foreach (var item in Json.Items(page))
        {
            var detail = await api.GetAsync($"/api/v1/listings/{item.GetProperty("slug").GetString()}", "ru");
            NoProblems(Contract.Check(detail, "Listing"));

            var related = await api.GetAsync($"/api/v1/listings/{item.GetProperty("id").GetString()}/related");
            NoProblems(Contract.Check(related.GetProperty("fromSeller"), "Listing[]"));
            NoProblems(Contract.Check(related.GetProperty("similar"), "Listing[]"));
            Assert.Equal(["fromSeller", "similar"], related.EnumerateObject().Select(p => p.Name));
        }
    }

    [Fact]
    public async Task Every_service_and_provider_matches_Service_and_ServiceProvider()
    {
        var page = await api.GetAsync($"/api/v1/services?pageSize={Json.AllOnOnePage}");
        NoProblems(Contract.CheckPage(page, "Service", extended: "ServiceSearchResult"));
        Assert.NotEmpty(Json.Items(page));

        foreach (var item in Json.Items(page))
        {
            NoProblems(Contract.Check(await api.GetAsync($"/api/v1/services/{item.GetProperty("slug").GetString()}", "en"), "Service"));

            var related = await api.GetAsync($"/api/v1/services/{item.GetProperty("id").GetString()}/related");
            NoProblems(Contract.Check(related.GetProperty("fromProvider"), "Service[]"));
            NoProblems(Contract.Check(related.GetProperty("similar"), "Service[]"));

            var provider = item.GetProperty("providerId").GetString();
            NoProblems(Contract.Check(await api.GetAsync($"/api/v1/providers/{provider}"), "ServiceProvider"));
            NoProblems(Contract.Check(await api.GetAsync($"/api/v1/providers/{provider}/services"), "Service[]"));
        }
    }

    [Fact]
    public async Task Every_seller_matches_Seller()
    {
        var page = await api.GetAsync($"/api/v1/sellers?pageSize={Json.AllOnOnePage}");
        NoProblems(Contract.CheckPage(page, "Seller"));
        Assert.NotEmpty(Json.Items(page));

        foreach (var item in Json.Items(page))
        {
            NoProblems(Contract.Check(await api.GetAsync($"/api/v1/sellers/{item.GetProperty("slug").GetString()}", "ru"), "Seller"));
            NoProblems(Contract.Check(await api.GetAsync($"/api/v1/sellers/by-id/{item.GetProperty("id").GetString()}"), "Seller"));
        }
    }

    [Fact]
    public async Task Facets_and_sitemaps_have_the_approved_shapes()
    {
        // backend-contract.md 1.4: FacetCounts of src/services/repository.ts.
        var facets = await api.GetAsync("/api/v1/listings/facets");
        Assert.Equal(["categories", "subcategories", "cities"], facets.EnumerateObject().Select(p => p.Name));
        NoProblems(Contract.Check(facets, "FacetCounts"));

        // backend-contract.md 1.1: SitemapPage, { items: { slug, updatedAt }[], nextCursor? }. The API always has the
        // date (the frontend's type leaves it optional for the demo data, which has none for sellers and services).
        foreach (var kind in new[] { "listing", "seller", "service" })
        {
            var sitemap = await api.GetAsync($"/api/v1/sitemap/{kind}?limit=2");
            NoProblems(Contract.Check(sitemap, "SitemapPage"));
            NoProblems(Contract.Check(sitemap, "{ items: Array<{ slug: string; updatedAt: string }>; nextCursor?: string }"));
        }
    }

    [Fact]
    public async Task No_public_response_contains_a_phone_number()
    {
        var phones = SeededPhoneNumbers();
        Assert.True(phones.Count >= 10);
        var bodies = new List<(string Path, JsonElement Body)>();
        async Task Add(string path) => bodies.Add((path, await api.GetAsync(path)));

        await Add("/api/v1/home");
        await Add($"/api/v1/listings?pageSize={Json.AllOnOnePage}");
        await Add($"/api/v1/services?pageSize={Json.AllOnOnePage}");
        await Add($"/api/v1/sellers?pageSize={Json.AllOnOnePage}");
        foreach (var listing in Json.Items(bodies[1].Body))
        {
            await Add($"/api/v1/listings/{listing.GetProperty("slug").GetString()}");
            await Add($"/api/v1/listings/{listing.GetProperty("id").GetString()}/related");
        }

        foreach (var service in Json.Items(bodies[2].Body))
        {
            await Add($"/api/v1/services/{service.GetProperty("slug").GetString()}");
            await Add($"/api/v1/services/{service.GetProperty("id").GetString()}/related");
            await Add($"/api/v1/providers/{service.GetProperty("providerId").GetString()}");
        }

        foreach (var seller in Json.Items(bodies[3].Body))
        {
            await Add($"/api/v1/sellers/{seller.GetProperty("slug").GetString()}");
        }

        foreach (var (path, body) in bodies)
        {
            foreach (var text in StringsOf(body).Where(s => !Guid.TryParse(s, out _)))
            {
                var digits = new string(text.Where(char.IsAsciiDigit).ToArray());
                foreach (var phone in phones)
                {
                    Assert.False(digits.Contains(phone[4..], StringComparison.Ordinal), $"{path} shows the phone number {phone} in \"{text}\"");
                }
            }
        }

        // The masked form is what they get instead.
        Assert.Contains(bodies, b => StringsOf(b.Body).Any(s => s.StartsWith("+994 ", StringComparison.Ordinal) && s.Contains("***", StringComparison.Ordinal)));
    }

    [Fact]
    public void The_enums_write_the_strings_of_the_TypeScript_unions()
    {
        Assert.Equal(Contract.Unions["RootSystem"], KebabCase.Values<RootSystem>());
        Assert.Equal(Contract.Unions["SunNeed"], KebabCase.Values<SunNeed>());
        Assert.Equal(Contract.Unions["WaterNeed"], KebabCase.Values<WaterNeed>());
        Assert.Equal(Contract.Unions["Foliage"], KebabCase.Values<Foliage>());
        Assert.Equal(Contract.Unions["PriceType"], KebabCase.Values<PriceType>());
        Assert.Equal(Contract.Unions["PriceUnit"], KebabCase.Values<PriceUnit>());
        Assert.Equal(Contract.Unions["BusinessKind"], KebabCase.Values<BusinessKind>());
        Assert.Equal(Contract.Unions["SellerOffer"], KebabCase.Values<SellerOffer>());
        Assert.Equal(Contract.Unions["CategoryKind"], KebabCase.Values<CategoryKind>());
        Assert.Equal(Contract.Unions["SellerType"].Order(), KebabCase.Values<AccountType>().Order());
        Assert.Equal(["company", "individual"], KebabCase.Values<ProviderKind>());
        Assert.Equal("'company' | 'individual'", Contract.Interfaces["ServiceProvider"]["kind"].Type);
        // A stored listing is never a draft (drafts live in listing_drafts, phase 3); every other status is the contract's.
        Assert.Equal(Contract.Unions["ListingStatus"].Where(s => s != "draft").Order(), KebabCase.Values<ListingStatus>().Order());
    }

    [Fact]
    public void The_approved_additions_are_not_in_src_types_twice()
    {
        // When the frontend adds an approved field to src/types, its entry in ApprovedAdditions is no longer needed.
        foreach (var (type, additions) in FrontendContract.ApprovedAdditions)
        {
            foreach (var property in additions.Keys)
            {
                Assert.False(Contract.Interfaces[type].ContainsKey(property), $"{type}.{property} is in src/types now: remove it from FrontendContract.ApprovedAdditions");
            }
        }
    }

    private static void NoProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));

    private static IEnumerable<string> StringsOf(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => [element.GetString()!],
        JsonValueKind.Array => element.EnumerateArray().SelectMany(StringsOf),
        JsonValueKind.Object => element.EnumerateObject().SelectMany(p => StringsOf(p.Value).Prepend(p.Name)),
        _ => [],
    };

    /// <summary>Every number in the demo seed: accounts, businesses and listing contacts (E.164).</summary>
    private static IReadOnlyList<string> SeededPhoneNumbers()
    {
        var numbers = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (file, property) in new[]
        {
            ("demo/users.json", "phone"),
            ("demo/sellers.json", "phone"),
            ("demo/listings.json", "contactPhone"),
            ("demo/services.json", "contactPhone"),
        })
        {
            using var document = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "seed", file)));
            foreach (var item in document.RootElement.GetProperty("items").EnumerateArray())
            {
                numbers.Add(item.GetProperty(property).GetString()!);
            }
        }

        return numbers.ToList();
    }
}
