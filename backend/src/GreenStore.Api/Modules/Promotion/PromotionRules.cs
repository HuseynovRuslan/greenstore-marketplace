using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// What an option buys: «Önə çıxar» for <see cref="Days"/> days (a <see cref="PromotionKind.Feature"/>), «İrəli çək»
/// <see cref="Bumps"/> times (a <see cref="PromotionKind.Bump"/>), the bundle both.
/// </summary>
public sealed record PromotionTerms(string PackageId, short? Days, short? Bumps)
{
    public bool HasFeature => PackageId is PromotionPackages.OneCixar or PromotionPackages.Paket && Days is > 0;

    public bool HasBumps => PackageId is PromotionPackages.IreliCek or PromotionPackages.Paket && Bumps is > 0;

    /// <summary>The option buys what its package promises: days for «Önə çıxar», lifts for «İrəli çək», both for the bundle.</summary>
    public bool IsValid => PackageId switch
    {
        PromotionPackages.OneCixar => HasFeature,
        PromotionPackages.IreliCek => HasBumps,
        PromotionPackages.Paket => HasFeature && HasBumps,
        _ => false,
    };

    public static PromotionTerms Of(PromotionOption option) => new(option.PackageId, option.Days, option.Bumps);
}

/// <summary>The listing's promotion fields a payment reads.</summary>
/// <param name="FeatureUntil">The end of the paid «Önə çıxar» running now; null when none runs.</param>
/// <param name="ExpiresAt">The listing's term (null while it was never published).</param>
/// <param name="CanBumpNow">The listing is on the site, so the first lift can happen at once.</param>
public sealed record PromotedListing(DateTimeOffset? FeatureUntil, DateTimeOffset? ExpiresAt, bool CanBumpNow)
{
    /// <summary>«Önə çıxan» without an end (the demo data): a paid «Önə çıxar» does not give it one.</summary>
    public bool PromotedWithoutEnd { get; init; }

    /// <summary>When the running «Önə çıxan» began (<c>promoted_at</c>); null when the listing is not promoted.</summary>
    public DateTimeOffset? PromotedAt { get; init; }

    /// <summary>The listing's fields as they are at <paramref name="now"/>.</summary>
    public static PromotedListing Of(bool isPromoted, DateTimeOffset? promotedUntil, DateTimeOffset? promotedAt, DateTimeOffset? expiresAt, bool onSite, DateTimeOffset now) =>
        new(isPromoted && promotedUntil is { } until && until > now ? until : null, expiresAt, onSite)
        {
            PromotedWithoutEnd = isPromoted && promotedUntil is null,
            PromotedAt = isPromoted ? promotedAt : null,
        };
}

public sealed record PlannedFeature(DateTimeOffset StartsAt, DateTimeOffset EndsAt);

/// <param name="BumpedNow">The first lift happened with the payment (the listing went to the top of «Ən yenilər»).</param>
public sealed record PlannedBump(DateTimeOffset StartsAt, DateTimeOffset EndsAt, short BumpsLeft, DateTimeOffset? NextBumpAt, bool BumpedNow);

/// <summary>What a paid order changes: its rows, the listing's «Önə çıxan» end and its term.</summary>
/// <param name="PromotedUntil">The «Önə çıxan» end; null without an end (the demo data) or when not promoted.</param>
/// <param name="PromotedAt">When the running «Önə çıxan» began: the order inside the «Önə çıxan» group.</param>
public sealed record PromotionPlan(PlannedFeature? Feature, PlannedBump? Bump, DateTimeOffset? PromotedUntil, DateTimeOffset? ExpiresAt)
{
    public DateTimeOffset? PromotedAt { get; init; }
}

/// <summary>A promotion row as the owner's listing shows it: <c>ListingPromotion</c> of src/types.</summary>
public sealed record PromotionRun(PromotionKind Kind, string PackageId, DateTimeOffset EndsAt);

/// <summary>What a payment provider's callback does to an order.</summary>
/// <param name="Apply">Start the promotion now: the order was not paid before.</param>
public sealed record OrderChange(PromotionOrderStatus Status, bool Apply);

/// <summary>What the provider says about a payment.</summary>
public enum PaymentOutcome
{
    /// <summary>An event the API does not act on (it is stored all the same).</summary>
    Unknown,
    Paid,
    Failed,
}

/// <summary>A checked <c>POST /promotion-orders</c>.</summary>
public sealed record PromotionOrderRequest(Guid ListingId, PromotionOption Option, string ReturnPath);

/// <summary>
/// The promotion rules (ARCHITECTURE.md §3: plain classes, no ASP.NET or EF; unit-tested): what a paid order starts,
/// when «İrəli çək» lifts the listing again, when «Önə çıxar» ends, what a provider's callback does to an order, and
/// the order request itself.
/// </summary>
public static class PromotionRules
{
    /// <summary>Lifts of an option without days («1 dəfə») are a day apart.</summary>
    public static readonly TimeSpan DefaultBumpInterval = TimeSpan.FromDays(1);

    /// <summary>Where the site's visitor comes back to after paying, when the order does not say.</summary>
    public const string DefaultReturnPath = "/kabinet";

    public const int MaxReturnPathLength = 200;

    /// <summary>The time between two lifts: the option's days spread evenly («5 gün, hər gün»: a day).</summary>
    public static TimeSpan BumpInterval(short? days, short? bumps) =>
        days is > 0 && bumps is > 0 ? TimeSpan.FromDays(days.Value) / bumps.Value : DefaultBumpInterval;

    /// <summary>
    /// What paying <paramref name="terms"/> starts on <paramref name="listing"/> at <paramref name="now"/>:
    /// <list type="bullet">
    /// <item>«Önə çıxar» runs <c>days</c> days; bought while one runs, it starts when that one ends (paid days never
    /// overlap). A new run puts the listing first in the «Önə çıxan» group (<c>promoted_at</c> = now); days bought on
    /// top of a running one keep its place. A listing promoted without an end (the demo data) keeps no end.</item>
    /// <item>«İrəli çək» lifts the listing at once when it is on the site, then every <see cref="BumpInterval"/>;
    /// its row lasts until the last lift's day is over. Off the site, the first lift waits until it is back.</item>
    /// <item>The listing's term reaches at least the end of everything paid (ARCHITECTURE.md §6: paid days are
    /// never lost to the 30-day term).</item>
    /// </list>
    /// </summary>
    public static PromotionPlan Plan(PromotionTerms terms, PromotedListing listing, DateTimeOffset now)
    {
        PlannedFeature? feature = null;
        if (terms.HasFeature)
        {
            var starts = listing.FeatureUntil is { } running && running > now ? running : now;
            feature = new PlannedFeature(starts, starts + TimeSpan.FromDays(terms.Days!.Value));
        }

        PlannedBump? bump = null;
        if (terms.HasBumps)
        {
            var interval = BumpInterval(terms.Days, terms.Bumps);
            var bumps = terms.Bumps!.Value;
            var ends = now + (interval * bumps);
            bump = listing.CanBumpNow
                ? new PlannedBump(now, ends, (short)(bumps - 1), bumps > 1 ? now + interval : null, BumpedNow: true)
                : new PlannedBump(now, ends, bumps, now, BumpedNow: false);
        }

        var promotedUntil = listing.FeatureUntil;
        var promotedAt = listing.PromotedAt;
        if (feature is not null)
        {
            var extendsRunning = feature.StartsAt > now;
            promotedUntil = listing.PromotedWithoutEnd ? null : feature.EndsAt;
            promotedAt = extendsRunning ? listing.PromotedAt ?? now : now;
        }

        var expires = listing.ExpiresAt is { } term ? Latest(term, feature?.EndsAt, bump?.EndsAt) : (DateTimeOffset?)null;
        return new PromotionPlan(feature, bump, promotedUntil, expires) { PromotedAt = promotedAt };
    }

    /// <summary>One scheduled lift done at <paramref name="now"/>: one less left, the next one an interval later.</summary>
    public static (short BumpsLeft, DateTimeOffset? NextBumpAt) AfterBump(short bumpsLeft, TimeSpan interval, DateTimeOffset now)
    {
        var left = (short)Math.Max(0, bumpsLeft - 1);
        return (left, left > 0 ? now + interval : null);
    }

    /// <summary>Is a lift due: some left, its time come, and the listing on the site?</summary>
    public static bool BumpDue(short bumpsLeft, DateTimeOffset? nextBumpAt, bool listingOnSite, DateTimeOffset now) =>
        bumpsLeft > 0 && nextBumpAt is { } next && next <= now && listingOnSite;

    /// <summary>Has «Önə çıxan» run out? A listing promoted without an end (the demo data) stays promoted.</summary>
    public static bool FeatureOver(bool isPromoted, DateTimeOffset? promotedUntil, DateTimeOffset now) =>
        isPromoted && promotedUntil is { } until && until <= now;

    /// <summary>
    /// What a callback with <paramref name="outcome"/> does to an order in <paramref name="status"/>. Paid once is paid:
    /// a repeated «paid» changes nothing and a later «failed» does not undo it; a «paid» after a «failed» is money taken,
    /// so it starts the promotion all the same. A refunded order stays refunded.
    /// </summary>
    public static OrderChange Next(PromotionOrderStatus status, PaymentOutcome outcome) => (status, outcome) switch
    {
        (PromotionOrderStatus.Refunded, _) => new(status, Apply: false),
        (PromotionOrderStatus.Paid, _) => new(status, Apply: false),
        (_, PaymentOutcome.Paid) => new(PromotionOrderStatus.Paid, Apply: true),
        (PromotionOrderStatus.Pending, PaymentOutcome.Failed) => new(PromotionOrderStatus.Failed, Apply: false),
        _ => new(status, Apply: false),
    };

    /// <summary>
    /// The promotion the owner's listing shows («Önə çıxar» aktivdir … qədər): a running «Önə çıxar» (or bundle) first,
    /// until its last paid day; otherwise a running «İrəli çək». Null when nothing runs.
    /// </summary>
    public static PromotionRun? Running(IEnumerable<PromotionRun> rows, DateTimeOffset now)
    {
        var running = rows.Where(r => r.EndsAt > now).ToList();
        return running.Where(r => r.Kind == PromotionKind.Feature).MaxBy(r => r.EndsAt)
            ?? running.Where(r => r.Kind == PromotionKind.Bump).MaxBy(r => r.EndsAt);
    }

    /// <summary>
    /// A path on the site to come back to after paying («/kabinet/elanlar/alma-10482»): it must start with one «/»
    /// (never another site: «//x.az», «/\x.az»), at most <see cref="MaxReturnPathLength"/> printable ASCII characters,
    /// without a «#». Null or blank: <see cref="DefaultReturnPath"/>.
    /// </summary>
    public static bool TryCleanReturnPath(string? value, out string path)
    {
        path = DefaultReturnPath;
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var text = value.Trim();
        var ok = text.Length <= MaxReturnPathLength
            && text.StartsWith('/')
            && !text.StartsWith("//", StringComparison.Ordinal)
            && text.All(c => c is >= '!' and <= '~' && c is not '\\' and not '#');
        if (ok)
        {
            path = text;
        }

        return ok;
    }

    /// <summary>The path with the order's query added: <c>…?order=&lt;id&gt;</c> (or <c>&amp;order=</c> after a query).</summary>
    public static string WithQuery(string path, string query) => path + (path.Contains('?', StringComparison.Ordinal) ? "&" : "?") + query;

    /// <summary>
    /// Checks <c>POST /promotion-orders</c>: a listing id, an option on offer of the package named. Field errors:
    /// <c>listingId</c>, <c>packageId</c>, <c>optionId</c> (<c>required</c>, <c>invalid</c>), <c>returnPath</c>
    /// (<c>invalid</c>).
    /// </summary>
    public static (PromotionOrderRequest? Request, FieldErrors Errors) ValidateOrder(PromotionOrderInputDto input, PromotionCatalogue catalogue)
    {
        var errors = new FieldErrors();
        Guid listingId = default;
        errors.Add("listingId", string.IsNullOrWhiteSpace(input.ListingId) ? FieldErrors.Required : Guid.TryParse(input.ListingId, out listingId) ? null : FieldErrors.Invalid);
        var packageId = input.PackageId?.Trim();
        var optionId = input.OptionId?.Trim();
        var package = catalogue.Package(packageId);
        errors.Add("packageId", string.IsNullOrEmpty(packageId) ? FieldErrors.Required : package is { IsActive: true } ? null : FieldErrors.Invalid);
        var option = package is { IsActive: true } ? catalogue.Offered(packageId, optionId) : null;
        errors.Add("optionId", string.IsNullOrEmpty(optionId) ? FieldErrors.Required : option is null && package is { IsActive: true } ? FieldErrors.Invalid : null);
        errors.Add("returnPath", TryCleanReturnPath(input.ReturnPath, out var returnPath) ? null : FieldErrors.Invalid);
        return errors.Any ? (null, errors) : (new PromotionOrderRequest(listingId, option!, returnPath), errors);
    }

    private static DateTimeOffset Latest(DateTimeOffset value, params DateTimeOffset?[] others)
    {
        foreach (var other in others)
        {
            if (other is { } later && later > value)
            {
                value = later;
            }
        }

        return value;
    }
}
