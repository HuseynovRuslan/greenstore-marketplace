using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Tests.Listings;

/// <summary>What the moderator sees changed between the approved and the pending version.</summary>
public sealed class RevisionDiffTests
{
    private static readonly Guid A = Guid.Parse("019a8b4e-0000-7000-8000-00000000000a");
    private static readonly Guid B = Guid.Parse("019a8b4e-0000-7000-8000-00000000000b");
    private static readonly Guid C = Guid.Parse("019a8b4e-0000-7000-8000-00000000000c");

    private static readonly ListingContent Approved = new()
    {
        Kind = CategoryKind.Product,
        CategoryId = "agaclar",
        SubcategoryId = "agaclar-meyve",
        Title = "Alma tingi",
        Description = "Sağlam tinglər.",
        Attributes = new() { ["heightMin"] = "150", ["pack"] = "10 ədəd" },
        HeightMinCm = 150,
        RootSystem = RootSystem.Container,
        PriceType = PriceType.Fixed,
        Price = 145.00m,
        PriceUnit = PriceUnit.Piece,
        CityId = "baki",
        ContactName = "Elvin",
        ContactPhone = "+994505551234",
        PhotoIds = [A, B],
    };

    [Fact]
    public void The_same_version_has_no_changes() => Assert.Empty(RevisionDiff.Compare(Approved, Approved with { }));

    [Fact]
    public void Each_changed_field_is_one_line_with_both_values()
    {
        var pending = Approved with
        {
            Title = "Alma tingi Golden",
            Price = 120m,
            HeightMinCm = 150,
            HeightMaxCm = 180,
            DeliveryAvailable = true,
            ContactPhone = "+994551112233",
            Attributes = new() { ["heightMin"] = "150", ["pack"] = "20 ədəd" },
        };

        var changes = RevisionDiff.Compare(Approved, pending);

        Assert.Equal(
            [
                new FieldChange("title", "Alma tingi", "Alma tingi Golden"),
                new FieldChange("plant.heightCm", "150", "150–180"),
                new FieldChange("price", "145", "120"),
                new FieldChange("deliveryAvailable", "false", "true"),
                new FieldChange("contactPhone", "+994505551234", "+994551112233"),
                new FieldChange("attributes.pack", "10 ədəd", "20 ədəd"),
            ],
            changes);
    }

    [Fact]
    public void Added_and_removed_photos_show_the_counts_and_a_new_cover_shows_as_order()
    {
        Assert.Equal([new FieldChange("photos", "2", "3")], RevisionDiff.Compare(Approved, Approved with { PhotoIds = [A, B, C] }));
        Assert.Equal([new FieldChange("photos", "2", "2")], RevisionDiff.Compare(Approved, Approved with { PhotoIds = [A, C] }));
        Assert.Equal([new FieldChange("photos.order")], RevisionDiff.Compare(Approved, Approved with { PhotoIds = [B, A] }));
    }

    [Fact]
    public void Removed_values_have_no_after()
    {
        var changes = RevisionDiff.Compare(Approved, Approved with { RootSystem = null, PriceType = PriceType.Agreement, Price = null, PriceUnit = null });

        Assert.Contains(new FieldChange("plant.rootSystem", "container", null), changes);
        Assert.Contains(new FieldChange("priceType", "fixed", "agreement"), changes);
        Assert.Contains(new FieldChange("price", "145", null), changes);
        Assert.Contains(new FieldChange("priceUnit", "piece", null), changes);
    }
}
