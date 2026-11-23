using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Usta çağır»: the form's rules and who a request goes to, without a database.</summary>
public sealed class ServiceRequestRulesTests
{
    private static readonly DateOnly Today = new(2026, 11, 22);

    private static readonly TaxonomySnapshot Taxonomy = new(
        [
            new Category { Id = "landsaft-xidmetleri", Kind = CategoryKind.Service, Form = CategoryForm.Service, Name = new LocalizedText("Landşaft xidmətləri") },
            new Category { Id = "landsaft-dizayni", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Landşaft dizaynı") },
            new Category { Id = "kohne-xidmet", ParentId = "landsaft-xidmetleri", Kind = CategoryKind.Service, Name = new LocalizedText("Köhnə"), IsActive = false },
            new Category { Id = "agaclar", Kind = CategoryKind.Product, Form = CategoryForm.Plant, Name = new LocalizedText("Ağaclar") },
        ],
        [
            new City { Id = "baki", Name = new LocalizedText("Bakı") },
            new City { Id = "abseron", Name = new LocalizedText("Abşeron") },
            new City { Id = "naxcivan", Name = new LocalizedText("Naxçıvan"), IsActive = false },
        ]);

    private static ServiceRequestInputDto Good(Func<ServiceRequestInputDto, ServiceRequestInputDto>? edit = null)
    {
        var input = new ServiceRequestInputDto
        {
            CategoryId = "landsaft-dizayni",
            CityId = "baki",
            Area = " Mərdəkan ",
            PreferredDate = "2026-12-01",
            Size = "120 m²",
            Description = "  Həyətin dizaynı və əkin lazımdır  ",
            Name = " Aygün ",
            Phone = "(050) 555-12-34",
        };
        return edit is null ? input : edit(input);
    }

    [Fact]
    public void A_good_request_is_cleaned()
    {
        var (request, errors) = ServiceRequestRules.Validate(Good(), Taxonomy, Today);

        Assert.False(errors.Any);
        Assert.Equal("landsaft-dizayni", request!.CategoryId);
        Assert.Equal("Mərdəkan", request.Area);
        Assert.Equal(new DateOnly(2026, 12, 1), request.PreferredDate);
        Assert.Equal("Həyətin dizaynı və əkin lazımdır", request.Description);
        Assert.Equal("Aygün", request.Name);
        Assert.Equal("+994505551234", request.Phone);
        Assert.Null(request.ServiceId);
        Assert.Null(request.ProviderId);
    }

    [Fact]
    public void The_service_category_itself_and_today_are_allowed()
    {
        var (request, errors) = ServiceRequestRules.Validate(Good(i => i with { CategoryId = "landsaft-xidmetleri", PreferredDate = "2026-11-22", Area = null, Size = null }), Taxonomy, Today);

        Assert.False(errors.Any);
        Assert.Equal(Today, request!.PreferredDate);
        Assert.Null(request.Area);
    }

    public static TheoryData<string, string?, string, string> BadRequests() => new()
    {
        { "categoryId", null, "categoryId", FieldErrors.Required },
        { "categoryId", "agaclar", "categoryId", FieldErrors.Invalid },
        { "categoryId", "kohne-xidmet", "categoryId", FieldErrors.Invalid },
        { "categoryId", "yoxdur", "categoryId", FieldErrors.Invalid },
        { "cityId", null, "cityId", FieldErrors.Required },
        { "cityId", "naxcivan", "cityId", FieldErrors.Invalid },
        { "description", "  ", "description", FieldErrors.Required },
        { "description", "Kömək", "description", FieldErrors.TooShort },
        { "description", new string('d', 1001), "description", FieldErrors.TooLong },
        { "name", null, "name", FieldErrors.Required },
        { "name", new string('n', 61), "name", FieldErrors.TooLong },
        { "phone", null, "phone", FieldErrors.Required },
        { "phone", "12345", "phone", FieldErrors.Invalid },
        { "area", new string('a', 81), "area", FieldErrors.TooLong },
        { "size", new string('s', 41), "size", FieldErrors.TooLong },
        { "preferredDate", "01.12.2026", "preferredDate", FieldErrors.Invalid },
        { "preferredDate", "2026-11-21", "preferredDate", ServiceRequestRules.InPast },
        { "preferredDate", "2027-11-23", "preferredDate", ServiceRequestRules.OutOfRange },
        { "serviceId", "landsaft-dizayni", "serviceId", FieldErrors.Invalid },
        { "providerId", "yasil-mekan", "providerId", FieldErrors.Invalid },
    };

    [Theory]
    [MemberData(nameof(BadRequests))]
    public void A_bad_request_names_its_field(string property, string? value, string field, string code)
    {
        var input = property switch
        {
            "categoryId" => Good(i => i with { CategoryId = value }),
            "cityId" => Good(i => i with { CityId = value }),
            "description" => Good(i => i with { Description = value }),
            "name" => Good(i => i with { Name = value }),
            "phone" => Good(i => i with { Phone = value }),
            "area" => Good(i => i with { Area = value }),
            "size" => Good(i => i with { Size = value }),
            "preferredDate" => Good(i => i with { PreferredDate = value }),
            "serviceId" => Good(i => i with { ServiceId = value }),
            _ => Good(i => i with { ProviderId = value }),
        };

        var (request, errors) = ServiceRequestRules.Validate(input, Taxonomy, Today);

        Assert.Null(request);
        Assert.Equal(code, FirstErrors(errors)[field]);
    }

    private static readonly Guid A = Guid.Parse("019a8b4e-0000-7000-8000-00000000000a");
    private static readonly Guid B = Guid.Parse("019a8b4e-0000-7000-8000-00000000000b");
    private static readonly Guid C = Guid.Parse("019a8b4e-0000-7000-8000-00000000000c");
    private static readonly Guid D = Guid.Parse("019a8b4e-0000-7000-8000-00000000000d");
    private static readonly DateTimeOffset Day = new(2026, 11, 1, 8, 0, 0, TimeSpan.Zero);

    private static ProviderCandidate Service(Guid owner, string type = "landsaft-dizayni", string city = "baki", string[]? served = null, bool promoted = false, bool verified = false, int age = 0) =>
        new(owner, "landsaft-xidmetleri", type, city, served ?? [], promoted, verified, Day.AddDays(-age));

    [Fact]
    public void A_request_goes_to_the_providers_of_its_type_in_or_serving_its_city()
    {
        var providers = ServiceRequestRules.ChooseProviders(
            [
                Service(A),
                Service(B, city: "abseron", served: ["abseron", "baki"]),
                Service(C, city: "abseron"),
                Service(D, type: "bag-baximi"),
            ],
            "landsaft-dizayni",
            "baki",
            customerUserId: null,
            max: 10);

        Assert.Equal([A, B], providers.Order());
    }

    [Fact]
    public void The_service_category_takes_every_type() =>
        Assert.Equal(
            [A, D],
            ServiceRequestRules.ChooseProviders([Service(A), Service(D, type: "bag-baximi")], "landsaft-xidmetleri", "baki", null, 10).Order());

    [Fact]
    public void Each_provider_gets_it_once_and_never_the_customer()
    {
        var providers = ServiceRequestRules.ChooseProviders([Service(A), Service(A, served: ["baki"]), Service(B)], "landsaft-dizayni", "baki", customerUserId: B, max: 10);

        Assert.Equal([A], providers);
    }

    [Fact]
    public void Promoted_then_verified_then_the_newest_come_first_up_to_the_limit()
    {
        var providers = ServiceRequestRules.ChooseProviders(
            [
                Service(A, age: 1),
                Service(B, verified: true, age: 30),
                Service(C, promoted: true, age: 60),
                Service(D, age: 0),
            ],
            "landsaft-dizayni",
            "baki",
            null,
            max: 3);

        Assert.Equal([C, B, D], providers);
    }

    [Fact]
    public void Nobody_fits_nobody_gets_it() =>
        Assert.Empty(ServiceRequestRules.ChooseProviders([Service(A, city: "abseron")], "landsaft-dizayni", "baki", null, 10));

    internal static Dictionary<string, string> FirstErrors(FieldErrors errors)
    {
        try
        {
            errors.ThrowIfAny();
            return [];
        }
        catch (ApiProblemException problem)
        {
            return problem.Errors!.ToDictionary(e => e.Key, e => e.Value[0]);
        }
    }
}
