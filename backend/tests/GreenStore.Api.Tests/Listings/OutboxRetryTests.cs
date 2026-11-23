using GreenStore.Api.Jobs;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Listings;

public sealed class OutboxRetryTests
{
    [Theory]
    [InlineData(1, 5)]
    [InlineData(2, 10)]
    [InlineData(3, 20)]
    [InlineData(9, 1280)]
    [InlineData(10, 2560)]
    [InlineData(20, 3600)]
    public void A_failed_message_waits_longer_each_time_at_most_an_hour(int attempts, int seconds) =>
        Assert.Equal(TimeSpan.FromSeconds(Math.Min(seconds, 3600)), OutboxRetry.After(attempts));

    [Fact]
    public void Tags_go_out_each_once_in_notices_the_site_takes()
    {
        var tags = Enumerable.Range(1, 150).Select(i => $"listing:{i}").Concat(["listings", "home", "listing:1"]).ToList();

        var notices = Revalidation.Notices(tags);

        Assert.Equal([64, 64, 24], notices.Select(n => n.Length));
        Assert.Equal(tags.Distinct(), notices.SelectMany(n => n));
        Assert.Equal(["home"], Revalidation.Notices(["home", "home"]).Single());
        Assert.Empty(Revalidation.Notices([]));
    }

    [Fact]
    public void A_product_names_its_page_the_catalogue_the_home_page_and_its_seller()
    {
        var listing = new Listing
        {
            Id = Guid.Parse("019a8b4e-0000-7000-8000-000000000001"),
            Slug = "alma-tingi-20001",
            Kind = CategoryKind.Product,
            OwnerUserId = Guid.Parse("019a8b4e-0000-7000-8000-0000000000aa"),
            SellerId = Guid.Parse("019a8b4e-0000-7000-8000-0000000000bb"),
            CategoryId = "agaclar",
            Title = "Alma tingi",
            CityId = "baki",
            ContactName = "Test",
            ContactPhone = "+994501112233",
        };

        Assert.Equal(
            [
                "listing:019a8b4e-0000-7000-8000-000000000001", "listing:alma-tingi-20001", "listings", "home", "sitemap:listing",
                "listing:kohne-ad-20001", "seller:019a8b4e-0000-7000-8000-0000000000bb", "seller:abseron-tingcilik", "sellers",
            ],
            Revalidation.TagsFor(listing, "abseron-tingcilik", "kohne-ad-20001"));
    }

    [Fact]
    public void A_service_names_the_services_and_its_provider()
    {
        var service = new Listing
        {
            Id = Guid.Parse("019a8b4e-0000-7000-8000-000000000002"),
            Slug = "dizayn-20002",
            Kind = CategoryKind.Service,
            OwnerUserId = Guid.Parse("019a8b4e-0000-7000-8000-0000000000aa"),
            CategoryId = "landsaft-xidmetleri",
            Title = "Dizayn",
            CityId = "baki",
            ContactName = "Test",
            ContactPhone = "+994501112233",
        };

        Assert.Equal(
            ["service:019a8b4e-0000-7000-8000-000000000002", "service:dizayn-20002", "services", "home", "sitemap:service", "provider:019a8b4e-0000-7000-8000-0000000000aa"],
            Revalidation.TagsFor(service));
    }
}
