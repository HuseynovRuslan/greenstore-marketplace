using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using GreenStore.Api.Data.Seed;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NetVips;
using static GreenStore.Api.Tests.Infrastructure.HttpAssert;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>
/// The listing lifecycle on a database of its own (phase 3): seeded like Development (reference data, the sample
/// marketplace, the dev staff accounts), with the test clock, the captured SMS and refresh notices of
/// <see cref="AccountsApi"/>, and helpers to upload a photo, send a listing and decide on it as the dev moderator.
/// </summary>
public sealed class LifecycleApi(PostgresDatabase database) : AccountsApi(database)
{
    protected override string DatabaseSuffix => "lifecycle";

    /// <summary>Asks for an upload address and sends the file; returns the photo id. Asserts both answers.</summary>
    public async Task<string> UploadPhotoAsync(string token, byte[]? file = null, string contentType = "image/jpeg")
    {
        file ??= TestImages.Jpeg(1200, 900);
        var created = await Client(token).PostAsJsonAsync("/api/v1/photos", new { fileName = "foto.jpg", contentType, bytes = file.Length }, Ct);
        var body = await JsonAsync(created);
        Assert.True(created.StatusCode == HttpStatusCode.Created, $"POST /photos: {(int)created.StatusCode} {body}");
        NoContractProblems(UploadContract.Check(body, "PhotoUpload"));
        var uploaded = await PutFileAsync(body.GetProperty("uploadUrl").GetString()!, file, contentType);
        Assert.True(uploaded.StatusCode == HttpStatusCode.OK, $"PUT upload: {(int)uploaded.StatusCode} {await uploaded.Content.ReadAsStringAsync(Ct)}");
        NoContractProblems(UploadContract.Check(await JsonAsync(uploaded), "UploadedPhoto"));
        return body.GetProperty("photoId").GetString()!;
    }

    /// <summary>The frontend's types, for the upload's answers (src/types <c>PhotoUpload</c>, <c>UploadedPhoto</c>).</summary>
    private static readonly FrontendContract UploadContract = FrontendContract.Load();

    private static void NoContractProblems(IReadOnlyList<string> problems) => Assert.True(problems.Count == 0, string.Join("\n", problems));

    /// <summary>PUTs the file to an upload address, as the browser does (no session, no internal key).</summary>
    public async Task<HttpResponseMessage> PutFileAsync(string uploadUrl, byte[] file, string contentType = "image/jpeg", WebApplicationFactory<Program>? factory = null)
    {
        var client = RawClient(factory);
        using var content = new ByteArrayContent(file);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return await client.PutAsync(new Uri(uploadUrl).PathAndQuery, content, Ct);
    }

    /// <summary>A valid <c>ListingInput</c> of a tree, with the given photos and the account's number; change it with <paramref name="edit"/>.</summary>
    public static JsonObject TreeInput(IEnumerable<string> photoIds, string phone, Action<JsonObject>? edit = null)
    {
        var input = new JsonObject
        {
            ["kind"] = "product",
            ["categoryId"] = "agaclar",
            ["subcategory"] = "Meyvə ağacları",
            ["title"] = "Alma tingi Golden — 150 sm",
            ["description"] = "Sağlam, iki yaşlı alma tingləri. Dibçəkdə, əkinə hazırdır.",
            ["attributes"] = new JsonObject { ["heightMin"] = "150", ["age"] = "2", ["rootSystem"] = "container", ["availability"] = "satisda" },
            ["plant"] = new JsonObject
            {
                ["heightCm"] = new JsonObject { ["min"] = 150 },
                ["ageYears"] = 2,
                ["rootSystem"] = "container",
                ["potLitres"] = 10,
                ["sun"] = "full-sun",
            },
            ["priceType"] = "fixed",
            ["price"] = 25,
            ["priceUnit"] = "piece",
            ["cityId"] = "baki",
            ["area"] = "Mərdəkan",
            ["deliveryAvailable"] = true,
            ["deliveryAreas"] = "Bakı",
            ["plantingAvailable"] = false,
            ["contactName"] = "Test Satıcı",
            ["contactPhone"] = phone,
            ["whatsapp"] = true,
            ["phoneHidden"] = false,
            ["photoIds"] = new JsonArray(photoIds.Select(id => (JsonNode)JsonValue.Create(id)!).ToArray()),
        };
        edit?.Invoke(input);
        return input;
    }

    /// <summary>Uploads a photo and sends a tree listing; returns the <c>ListingSubmitResult</c>.</summary>
    public async Task<JsonElement> SubmitAsync(Account account, Action<JsonObject>? edit = null)
    {
        var photo = await UploadPhotoAsync(account.Token);
        var response = await Client(account.Token).PostAsJsonAsync("/api/v1/listings", TreeInput([photo], account.Phone, edit), Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /listings: {(int)response.StatusCode} {body}");
        return body;
    }

    /// <summary>The dev moderator's session token.</summary>
    public async Task<string> ModeratorTokenAsync() => await SignInAsync(DevAccountsSeeder.Accounts[1]);

    /// <summary>The dev admin's session token.</summary>
    public async Task<string> AdminTokenAsync() => await SignInAsync(DevAccountsSeeder.Accounts[0]);

    /// <summary>
    /// A valid <c>ListingInput</c> of a service of the type <paramref name="subcategory"/> (its Azerbaijani name), in
    /// <paramref name="cityId"/>, serving <paramref name="areas"/> (city ids, comma-separated).
    /// </summary>
    public static JsonObject ServiceInput(IEnumerable<string> photoIds, string phone, string subcategory, string cityId, string areas, Action<JsonObject>? edit = null)
    {
        var input = new JsonObject
        {
            ["kind"] = "service",
            ["categoryId"] = "landsaft-xidmetleri",
            ["subcategory"] = subcategory,
            ["title"] = "Bağın baxımı və əkin işləri",
            ["description"] = "Budama, gübrələmə, suvarma və əkin. Həftədə bir dəfə gəlirik.",
            ["attributes"] = new JsonObject { ["areas"] = areas },
            ["priceType"] = "fixed",
            ["price"] = 40,
            ["priceUnit"] = "hour",
            ["cityId"] = cityId,
            ["deliveryAvailable"] = false,
            ["plantingAvailable"] = true,
            ["contactName"] = "Usta Test",
            ["contactPhone"] = phone,
            ["whatsapp"] = false,
            ["phoneHidden"] = false,
            ["photoIds"] = new JsonArray(photoIds.Select(id => (JsonNode)JsonValue.Create(id)!).ToArray()),
        };
        edit?.Invoke(input);
        return input;
    }

    /// <summary>Posts a service (see <see cref="ServiceInput"/>) and approves it; returns the <c>ListingSubmitResult</c>.</summary>
    public async Task<JsonElement> PublishServiceAsync(Account account, string subcategory, string cityId, string areas)
    {
        var photo = await UploadPhotoAsync(account.Token);
        var response = await Client(account.Token).PostAsJsonAsync("/api/v1/listings", ServiceInput([photo], account.Phone, subcategory, cityId, areas), Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, $"POST /listings (service): {(int)response.StatusCode} {body}");
        await ApproveAsync(body.GetProperty("id").GetString()!);
        return body;
    }

    /// <summary>Sends a tree listing and approves it: an active listing of <paramref name="account"/>.</summary>
    public async Task<JsonElement> PublishAsync(Account account, Action<JsonObject>? edit = null)
    {
        var sent = await SubmitAsync(account, edit);
        await ApproveAsync(sent.GetProperty("id").GetString()!);
        return sent;
    }

    /// <summary>Runs the outbox job until nothing is due, as its timer would (SMS notices, refresh notices); returns how many it sent.</summary>
    public async Task<int> DispatchOutboxAsync()
    {
        await using var factory = Variant();
        using var scope = factory.Services.CreateScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<GreenStore.Api.Jobs.OutboxDispatcher>();
        var total = 0;
        for (var sent = await dispatcher.DispatchAsync(Ct); sent > 0; sent = await dispatcher.DispatchAsync(Ct))
        {
            total += sent;
        }

        return total;
    }

    public async Task<string> SignInAsync(DevAccount account)
    {
        var response = await Client().PostAsJsonAsync("/api/v1/auth/login", new { login = account.Phone, password = account.Password }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await JsonAsync(response)).GetProperty("session").GetProperty("token").GetString()!;
    }

    /// <summary>The moderation item of a listing (asserts 200).</summary>
    public async Task<JsonElement> ModerationItemAsync(string moderator, string listingId) =>
        await GetAsync($"/api/v1/admin/moderation/{listingId}", moderator);

    /// <summary>Approves the listing's current version as the moderator; returns the answer.</summary>
    public async Task<JsonElement> ApproveAsync(string listingId, string? moderator = null)
    {
        moderator ??= await ModeratorTokenAsync();
        var version = (await ModerationItemAsync(moderator, listingId)).GetProperty("version").GetString();
        var response = await Client(moderator).PostAsJsonAsync($"/api/v1/admin/moderation/{listingId}/decision", new { decision = "approve", version }, Ct);
        var body = await JsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"approve: {(int)response.StatusCode} {body}");
        return body;
    }

    /// <summary>A business account, its seller row created with it.</summary>
    public Task<Account> RegisterBusinessAsync() =>
        RegisterAsync(accountType: "business", businessKinds: ["nursery"], companyName: $"Test Bağ {Guid.NewGuid().ToString("N")[..6]}");
}

/// <summary>Images made with libvips for the upload tests.</summary>
public static class TestImages
{
    /// <summary>A JPEG of the size, optionally with an EXIF orientation (6: the camera was turned, the image lies on its side).</summary>
    public static byte[] Jpeg(int width, int height, int? orientation = null)
    {
        using var image = Plain(width, height);
        if (orientation is { } turn)
        {
            using var turned = image.Mutate(m => m.Set(GValue.GIntType, "orientation", turn));
            return turned.JpegsaveBuffer(q: 85);
        }

        return image.JpegsaveBuffer(q: 85);
    }

    public static byte[] Png(int width, int height)
    {
        using var image = Plain(width, height);
        return image.PngsaveBuffer();
    }

    public static byte[] Webp(int width, int height)
    {
        using var image = Plain(width, height);
        return image.WebpsaveBuffer();
    }

    private static Image Plain(int width, int height) =>
        Image.Black(width, height, 3).Linear([1.0, 1.0, 1.0], [30.0, 120.0, 40.0]).Cast(Enums.BandFormat.Uchar);
}

[CollectionDefinition(Name)]
public sealed class LifecycleCollection : ICollectionFixture<LifecycleApi>
{
    public const string Name = "lifecycle";
}
