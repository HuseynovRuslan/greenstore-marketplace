using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Localization;
using GreenStore.Api.Modules.Promotion;

namespace GreenStore.Api.Tests.Promotion;

/// <summary>The promotion rules on their own (no database): what an order starts, the lifts, the end, the callbacks.</summary>
public sealed class PromotionRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);

    private static readonly PromotionTerms Feature7 = new(PromotionPackages.OneCixar, 7, null);
    private static readonly PromotionTerms Bump1 = new(PromotionPackages.IreliCek, null, 1);
    private static readonly PromotionTerms Bump5 = new(PromotionPackages.IreliCek, 5, 5);
    private static readonly PromotionTerms Bundle7 = new(PromotionPackages.Paket, 7, 7);

    [Theory]
    [InlineData(PromotionPackages.OneCixar, (short)3, null, true, false, true)]
    [InlineData(PromotionPackages.OneCixar, null, (short)3, false, false, false)]
    [InlineData(PromotionPackages.IreliCek, null, (short)1, false, true, true)]
    [InlineData(PromotionPackages.IreliCek, (short)5, (short)5, false, true, true)]
    [InlineData(PromotionPackages.IreliCek, (short)5, null, false, false, false)]
    [InlineData(PromotionPackages.Paket, (short)7, (short)7, true, true, true)]
    [InlineData(PromotionPackages.Paket, (short)7, null, true, false, false)]
    [InlineData(PromotionPackages.Paket, null, (short)7, false, true, false)]
    [InlineData("vip", (short)7, (short)7, false, false, false)]
    public void An_option_buys_what_its_package_promises(string package, short? days, short? bumps, bool feature, bool lifts, bool valid)
    {
        var terms = new PromotionTerms(package, days, bumps);

        Assert.Equal((feature, lifts, valid), (terms.HasFeature, terms.HasBumps, terms.IsValid));
    }

    [Theory]
    [InlineData((short)5, (short)5, 24)]
    [InlineData((short)10, (short)10, 24)]
    [InlineData((short)7, (short)14, 12)]
    [InlineData(null, (short)1, 24)]
    [InlineData((short)0, (short)3, 24)]
    public void Lifts_are_spread_evenly_over_the_days(short? days, short bumps, int hours) =>
        Assert.Equal(TimeSpan.FromHours(hours), PromotionRules.BumpInterval(days, bumps));

    [Fact]
    public void Feature_runs_its_days_from_now_and_lengthens_a_shorter_term()
    {
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(null, Now.AddDays(3), CanBumpNow: true), Now);

        Assert.Equal(new PlannedFeature(Now, Now.AddDays(7)), plan.Feature);
        Assert.Null(plan.Bump);
        Assert.Equal(Now.AddDays(7), plan.PromotedUntil);
        Assert.Equal(Now.AddDays(7), plan.ExpiresAt);
    }

    [Fact]
    public void A_longer_term_is_never_shortened()
    {
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(null, Now.AddDays(25), CanBumpNow: true), Now);

        Assert.Equal(Now.AddDays(25), plan.ExpiresAt);
    }

    [Fact]
    public void Feature_bought_while_one_runs_starts_when_it_ends()
    {
        var running = Now.AddDays(2);
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(running, Now.AddDays(10), CanBumpNow: true), Now);

        Assert.Equal(new PlannedFeature(running, running.AddDays(7)), plan.Feature);
        Assert.Equal(running.AddDays(7), plan.PromotedUntil);
        Assert.Equal(Now.AddDays(10), plan.ExpiresAt);
        Assert.Equal(Now.AddDays(12), PromotionRules.Plan(Feature7, new PromotedListing(Now.AddDays(5), Now.AddDays(10), CanBumpNow: true), Now).ExpiresAt);
    }

    [Fact]
    public void A_feature_that_ended_already_does_not_delay_the_new_one()
    {
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(Now.AddMinutes(-1), Now.AddDays(10), CanBumpNow: true), Now);

        Assert.Equal(Now, plan.Feature!.StartsAt);
    }

    [Fact]
    public void A_new_feature_puts_the_listing_first_in_the_promoted_group()
    {
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(null, Now.AddDays(3), CanBumpNow: true), Now);

        Assert.Equal(Now, plan.PromotedAt);
    }

    [Fact]
    public void Days_bought_on_top_of_a_running_feature_keep_its_place()
    {
        var began = Now.AddDays(-4);
        var plan = PromotionRules.Plan(Feature7, new PromotedListing(Now.AddDays(3), Now.AddDays(10), CanBumpNow: true) { PromotedAt = began }, Now);

        Assert.Equal((began, Now.AddDays(10)), (plan.PromotedAt, plan.PromotedUntil));
    }

    [Fact]
    public void Ireli_cek_leaves_the_promoted_place_alone()
    {
        var began = Now.AddDays(-1);
        var plan = PromotionRules.Plan(Bump1, new PromotedListing(Now.AddDays(3), Now.AddDays(10), CanBumpNow: true) { PromotedAt = began }, Now);

        Assert.Equal((began, Now.AddDays(3)), (plan.PromotedAt, plan.PromotedUntil));
    }

    [Fact]
    public void A_listing_promoted_without_an_end_keeps_no_end()
    {
        var published = Now.AddDays(-20);
        var state = PromotedListing.Of(isPromoted: true, promotedUntil: null, promotedAt: published, expiresAt: Now.AddDays(10), onSite: true, Now);

        var plan = PromotionRules.Plan(Feature7, state, Now);

        Assert.True(state.PromotedWithoutEnd);
        Assert.Null(state.FeatureUntil);
        Assert.Equal(new PlannedFeature(Now, Now.AddDays(7)), plan.Feature);
        Assert.Equal(((DateTimeOffset?)null, (DateTimeOffset?)Now), (plan.PromotedUntil, plan.PromotedAt));
        Assert.Equal(Now.AddDays(10), plan.ExpiresAt);
    }

    [Theory]
    [InlineData(false, null, false, null)]
    [InlineData(true, 2, false, 2)]
    [InlineData(true, -1, false, null)]
    [InlineData(true, null, true, null)]
    public void The_listing_fields_say_what_runs_now(bool promoted, int? untilDays, bool withoutEnd, int? featureDays)
    {
        var began = Now.AddDays(-3);

        var state = PromotedListing.Of(promoted, untilDays is { } d ? Now.AddDays(d) : null, promoted ? began : null, Now.AddDays(30), onSite: true, Now);

        Assert.Equal(featureDays is { } f ? Now.AddDays(f) : null, state.FeatureUntil);
        Assert.Equal(withoutEnd, state.PromotedWithoutEnd);
        Assert.Equal(promoted ? began : null, state.PromotedAt);
    }

    [Fact]
    public void Ireli_cek_lifts_the_listing_at_once_and_plans_the_next_lifts()
    {
        var plan = PromotionRules.Plan(Bump5, new PromotedListing(null, Now.AddDays(2), CanBumpNow: true), Now);

        Assert.Null(plan.Feature);
        Assert.Equal(new PlannedBump(Now, Now.AddDays(5), 4, Now.AddDays(1), BumpedNow: true), plan.Bump);
        Assert.Null(plan.PromotedUntil);
        Assert.Equal(Now.AddDays(5), plan.ExpiresAt);
    }

    [Fact]
    public void Ireli_cek_once_is_done_with_the_payment()
    {
        var plan = PromotionRules.Plan(Bump1, new PromotedListing(null, Now.AddDays(20), CanBumpNow: true), Now);

        Assert.Equal(new PlannedBump(Now, Now.AddDays(1), 0, null, BumpedNow: true), plan.Bump);
        Assert.Equal(Now.AddDays(20), plan.ExpiresAt);
    }

    [Fact]
    public void Off_the_site_the_first_lift_waits_until_the_listing_is_back()
    {
        var plan = PromotionRules.Plan(Bump5, new PromotedListing(null, Now.AddDays(2), CanBumpNow: false), Now);

        Assert.Equal(new PlannedBump(Now, Now.AddDays(5), 5, Now, BumpedNow: false), plan.Bump);
    }

    [Fact]
    public void The_bundle_starts_both()
    {
        var plan = PromotionRules.Plan(Bundle7, new PromotedListing(null, Now.AddDays(30), CanBumpNow: true), Now);

        Assert.Equal(new PlannedFeature(Now, Now.AddDays(7)), plan.Feature);
        Assert.Equal(new PlannedBump(Now, Now.AddDays(7), 6, Now.AddDays(1), BumpedNow: true), plan.Bump);
        Assert.Equal(Now.AddDays(7), plan.PromotedUntil);
        Assert.Equal(Now.AddDays(30), plan.ExpiresAt);
    }

    [Fact]
    public void A_listing_never_published_gets_no_term_from_a_payment()
    {
        var plan = PromotionRules.Plan(Bundle7, new PromotedListing(null, null, CanBumpNow: false), Now);

        Assert.Null(plan.ExpiresAt);
        Assert.Equal(Now.AddDays(7), plan.PromotedUntil);
    }

    [Fact]
    public void Each_lift_leaves_one_less_until_none_is_left()
    {
        var day = TimeSpan.FromDays(1);
        Assert.Equal(((short)3, (DateTimeOffset?)Now.AddDays(1)), PromotionRules.AfterBump(4, day, Now));
        Assert.Equal(((short)0, (DateTimeOffset?)null), PromotionRules.AfterBump(1, day, Now));
        Assert.Equal(((short)0, (DateTimeOffset?)null), PromotionRules.AfterBump(0, day, Now));
    }

    [Theory]
    [InlineData(2, -1, true, true)]
    [InlineData(2, 0, true, true)]
    [InlineData(2, 1, true, false)]
    [InlineData(0, -1, true, false)]
    [InlineData(2, -1, false, false)]
    public void A_lift_is_due_when_its_time_came_and_the_listing_is_on_the_site(int left, int minutes, bool onSite, bool due) =>
        Assert.Equal(due, PromotionRules.BumpDue((short)left, Now.AddMinutes(minutes), onSite, Now));

    [Fact]
    public void A_lift_without_a_time_is_not_due() => Assert.False(PromotionRules.BumpDue(3, null, true, Now));

    [Fact]
    public void Feature_ends_after_its_last_paid_moment_and_the_demo_data_stays()
    {
        Assert.True(PromotionRules.FeatureOver(true, Now, Now));
        Assert.True(PromotionRules.FeatureOver(true, Now.AddSeconds(-1), Now));
        Assert.False(PromotionRules.FeatureOver(true, Now.AddSeconds(1), Now));
        Assert.False(PromotionRules.FeatureOver(false, Now.AddDays(-1), Now));
        // Demo listings are «Önə çıxan» without an end.
        Assert.False(PromotionRules.FeatureOver(true, null, Now));
    }

    [Theory]
    [InlineData(PromotionOrderStatus.Pending, PaymentOutcome.Paid, PromotionOrderStatus.Paid, true)]
    [InlineData(PromotionOrderStatus.Pending, PaymentOutcome.Failed, PromotionOrderStatus.Failed, false)]
    [InlineData(PromotionOrderStatus.Pending, PaymentOutcome.Unknown, PromotionOrderStatus.Pending, false)]
    [InlineData(PromotionOrderStatus.Paid, PaymentOutcome.Paid, PromotionOrderStatus.Paid, false)]
    [InlineData(PromotionOrderStatus.Paid, PaymentOutcome.Failed, PromotionOrderStatus.Paid, false)]
    [InlineData(PromotionOrderStatus.Paid, PaymentOutcome.Unknown, PromotionOrderStatus.Paid, false)]
    [InlineData(PromotionOrderStatus.Failed, PaymentOutcome.Paid, PromotionOrderStatus.Paid, true)]
    [InlineData(PromotionOrderStatus.Failed, PaymentOutcome.Failed, PromotionOrderStatus.Failed, false)]
    [InlineData(PromotionOrderStatus.Failed, PaymentOutcome.Unknown, PromotionOrderStatus.Failed, false)]
    [InlineData(PromotionOrderStatus.Cancelled, PaymentOutcome.Paid, PromotionOrderStatus.Paid, true)]
    [InlineData(PromotionOrderStatus.Cancelled, PaymentOutcome.Failed, PromotionOrderStatus.Cancelled, false)]
    [InlineData(PromotionOrderStatus.Refunded, PaymentOutcome.Paid, PromotionOrderStatus.Refunded, false)]
    [InlineData(PromotionOrderStatus.Refunded, PaymentOutcome.Failed, PromotionOrderStatus.Refunded, false)]
    public void A_payment_is_counted_once(PromotionOrderStatus status, PaymentOutcome outcome, PromotionOrderStatus next, bool apply) =>
        Assert.Equal(new OrderChange(next, apply), PromotionRules.Next(status, outcome));

    [Fact]
    public void The_owner_sees_the_running_feature_first_then_a_running_lift()
    {
        var rows = new[]
        {
            new PromotionRun(PromotionKind.Bump, PromotionPackages.IreliCek, Now.AddDays(9)),
            new PromotionRun(PromotionKind.Feature, PromotionPackages.OneCixar, Now.AddDays(3)),
            new PromotionRun(PromotionKind.Feature, PromotionPackages.Paket, Now.AddDays(5)),
            new PromotionRun(PromotionKind.Feature, PromotionPackages.OneCixar, Now.AddDays(-1)),
        };

        Assert.Equal(rows[2], PromotionRules.Running(rows, Now));
        Assert.Equal(rows[0], PromotionRules.Running(rows.Where(r => r.Kind == PromotionKind.Bump), Now));
        Assert.Null(PromotionRules.Running([rows[3]], Now));
        Assert.Null(PromotionRules.Running([], Now));
    }

    [Theory]
    [InlineData(null, true, "/kabinet")]
    [InlineData("  ", true, "/kabinet")]
    [InlineData("/kabinet/elanlar/alma-10482", true, "/kabinet/elanlar/alma-10482")]
    [InlineData(" /reklam?elan=5 ", true, "/reklam?elan=5")]
    [InlineData("https://evil.example/x", false, "/kabinet")]
    [InlineData("//evil.example/x", false, "/kabinet")]
    [InlineData("/\\evil.example", false, "/kabinet")]
    [InlineData("kabinet", false, "/kabinet")]
    [InlineData("/kabinet#top", false, "/kabinet")]
    [InlineData("/kabinet elanlar", false, "/kabinet")]
    [InlineData("/kabinet/\nLocation: x", false, "/kabinet")]
    [InlineData("/elanlar/ağac", false, "/kabinet")]
    public void The_return_path_stays_on_the_site(string? value, bool ok, string path)
    {
        Assert.Equal(ok, PromotionRules.TryCleanReturnPath(value, out var cleaned));
        Assert.Equal(path, cleaned);
    }

    [Fact]
    public void A_too_long_return_path_is_refused() =>
        Assert.False(PromotionRules.TryCleanReturnPath("/" + new string('a', PromotionRules.MaxReturnPathLength), out _));

    [Fact]
    public void The_order_query_is_added_to_the_path() =>
        Assert.Equal(
            ("/kabinet?order=1", "/reklam?elan=5&order=1"),
            (PromotionRules.WithQuery("/kabinet", "order=1"), PromotionRules.WithQuery("/reklam?elan=5", "order=1")));

    [Fact]
    public void A_valid_order_names_a_listing_and_an_option_on_offer()
    {
        var listing = Guid.CreateVersion7(Now);
        var (request, errors) = PromotionRules.ValidateOrder(new PromotionOrderInputDto(listing.ToString(), "one-cixar", "one-cixar-7", "/kabinet/elanlar"), Catalogue());

        Assert.False(errors.Any);
        Assert.Equal((listing, "one-cixar-7", "/kabinet/elanlar"), (request!.ListingId, request.Option.Id, request.ReturnPath));
    }

    [Theory]
    [InlineData(null, "one-cixar", "one-cixar-7", null, "listingId", "required")]
    [InlineData("12", "one-cixar", "one-cixar-7", null, "listingId", "invalid")]
    [InlineData(ListingId, null, "one-cixar-7", null, "packageId", "required")]
    [InlineData(ListingId, "vip", "one-cixar-7", null, "packageId", "invalid")]
    [InlineData(ListingId, "ireli-cek", null, null, "optionId", "required")]
    [InlineData(ListingId, "ireli-cek", "one-cixar-7", null, "optionId", "invalid")]
    [InlineData(ListingId, "one-cixar", "one-cixar-30", null, "optionId", "invalid")]
    [InlineData(ListingId, "one-cixar", "one-cixar-old", null, "optionId", "invalid")]
    [InlineData(ListingId, "one-cixar", "one-cixar-broken", null, "optionId", "invalid")]
    [InlineData(ListingId, "paket", "paket-7", null, "packageId", "invalid")]
    [InlineData(ListingId, "one-cixar", "one-cixar-7", "https://evil.example", "returnPath", "invalid")]
    public void A_wrong_order_names_its_field(string? listingId, string? packageId, string? optionId, string? returnPath, string field, string code)
    {
        var (request, errors) = PromotionRules.ValidateOrder(new PromotionOrderInputDto(listingId, packageId, optionId, returnPath), Catalogue());

        Assert.Null(request);
        var problem = Assert.Throws<ApiProblemException>(errors.ThrowIfAny);
        Assert.Equal([code], problem.Errors![field]);
    }

    [Fact]
    public void Only_active_packages_and_options_that_buy_something_are_on_offer()
    {
        var catalogue = Catalogue();

        Assert.Equal(["ireli-cek", "one-cixar"], catalogue.OnOffer().Select(p => p.Package.Id));
        Assert.Equal(["one-cixar-3", "one-cixar-7"], catalogue.OnOffer().Single(p => p.Package.Id == "one-cixar").Options.Select(o => o.Id));
        Assert.Equal("one-cixar", catalogue.PackageOf("one-cixar-old"));
        Assert.Null(catalogue.Offered("one-cixar", "one-cixar-old"));
        Assert.Null(catalogue.PackageOf("nothing"));
    }

    private const string ListingId = "019a8b4e-0000-7000-8000-000000000001";

    private static PromotionCatalogue Catalogue()
    {
        static LocalizedText Text(string az) => new(az);
        var packages = new List<PromotionPackage>
        {
            new() { Id = "one-cixar", Name = Text("Önə çıxar"), Summary = Text("…"), SortOrder = 20 },
            new() { Id = "ireli-cek", Name = Text("İrəli çək"), Summary = Text("…"), SortOrder = 10 },
            new() { Id = "paket", Name = Text("Paket"), Summary = Text("…"), SortOrder = 30, IsActive = false },
        };
        var options = new List<PromotionOption>
        {
            new() { Id = "one-cixar-7", PackageId = "one-cixar", Label = Text("7 gün"), Price = 9, Days = 7, SortOrder = 20 },
            new() { Id = "one-cixar-3", PackageId = "one-cixar", Label = Text("3 gün"), Price = 5, Days = 3, SortOrder = 10 },
            new() { Id = "one-cixar-old", PackageId = "one-cixar", Label = Text("30 gün"), Price = 30, Days = 30, SortOrder = 30, IsActive = false },
            new() { Id = "one-cixar-broken", PackageId = "one-cixar", Label = Text("?"), Price = 1, Bumps = 3, SortOrder = 40 },
            new() { Id = "ireli-cek-1", PackageId = "ireli-cek", Label = Text("1 dəfə"), Price = 1, Bumps = 1 },
            new() { Id = "paket-7", PackageId = "paket", Label = Text("7 gün"), Price = 13, Days = 7, Bumps = 7 },
        };
        return new PromotionCatalogue(packages, options);
    }
}
