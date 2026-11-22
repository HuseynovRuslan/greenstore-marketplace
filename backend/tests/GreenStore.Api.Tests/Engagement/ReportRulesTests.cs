using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Modules.Engagement;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Şikayət et» and its handling (backend-contract.md 4.1), without a database.</summary>
public sealed class ReportRulesTests
{
    private static readonly string AnyId = Guid.CreateVersion7().ToString();

    [Fact]
    public void Each_target_offers_the_reasons_of_the_site_in_its_order()
    {
        Assert.Equal(
            ["sold", "wrong-price", "wrong-photos", "wrong-info", "unreachable", "duplicate", "fraud", "other"],
            ReportRules.ReasonsFor(ReportTarget.Listing).Select(KebabCase.Value));
        Assert.Equal(
            ["unreachable", "wrong-info", "misconduct", "fraud", "other"],
            ReportRules.ReasonsFor(ReportTarget.Seller).Select(KebabCase.Value));
        Assert.Equal(
            ["not-provided", "wrong-price", "stolen-photos", "unreachable", "fraud", "other"],
            ReportRules.ReasonsFor(ReportTarget.Service).Select(KebabCase.Value));
    }

    [Fact]
    public void Every_reason_belongs_to_some_target() =>
        Assert.All(Enum.GetValues<ReportReason>(), reason => Assert.Contains(Enum.GetValues<ReportTarget>(), t => ReportRules.ReasonsFor(t).Contains(reason)));

    [Fact]
    public void A_good_report_passes_with_its_comment_trimmed()
    {
        var (report, errors) = ReportRules.Validate(new ReportInputDto { Target = "listing", TargetId = AnyId, Reason = "wrong-price", Comment = "  Qiymət 2 dəfə baha deyildi  " });

        Assert.False(errors.Any);
        Assert.Equal(new ReportSubmission(ReportTarget.Listing, Guid.Parse(AnyId), ReportReason.WrongPrice, "Qiymət 2 dəfə baha deyildi"), report);
    }

    [Fact]
    public void A_blank_comment_is_none() =>
        Assert.Null(ReportRules.Validate(new ReportInputDto { Target = "seller", TargetId = AnyId, Reason = "fraud", Comment = "   " }).Report!.Comment);

    [Theory]
    [InlineData(null, "x", "sold", null, "target", FieldErrors.Required)]
    [InlineData("advert", "x", "sold", null, "target", FieldErrors.Invalid)]
    [InlineData("listing", null, "sold", null, "targetId", FieldErrors.Required)]
    [InlineData("listing", "leyland-servi-120", "sold", null, "targetId", FieldErrors.Invalid)]
    [InlineData("listing", "id", null, null, "reason", FieldErrors.Required)]
    [InlineData("listing", "id", "Satılıb və ya aktual deyil", null, "reason", FieldErrors.Invalid)]
    [InlineData("listing", "id", "misconduct", null, "reason", ReportRules.ReasonNotForTarget)]
    [InlineData("seller", "id", "sold", null, "reason", ReportRules.ReasonNotForTarget)]
    [InlineData("service", "id", "wrong-photos", null, "reason", ReportRules.ReasonNotForTarget)]
    [InlineData("listing", "id", "other", null, "comment", FieldErrors.Required)]
    [InlineData("listing", "id", "other", "  ", "comment", FieldErrors.Required)]
    public void A_bad_report_names_its_field(string? target, string? targetId, string? reason, string? comment, string field, string code)
    {
        var (report, errors) = ReportRules.Validate(new ReportInputDto { Target = target, TargetId = targetId == "id" ? AnyId : targetId, Reason = reason, Comment = comment });

        Assert.Null(report);
        Assert.Equal(code, Errors(errors)[field]);
    }

    [Fact]
    public void A_comment_is_at_most_500_characters()
    {
        Assert.Equal(FieldErrors.TooLong, Errors(ReportRules.Validate(new ReportInputDto { Target = "listing", TargetId = AnyId, Reason = "other", Comment = new string('a', 501) }).Errors)["comment"]);
        Assert.NotNull(ReportRules.Validate(new ReportInputDto { Target = "listing", TargetId = AnyId, Reason = "other", Comment = new string('a', 500) }).Report);
    }

    [Fact]
    public void Investigating_keeps_no_resolution_and_resolving_needs_one()
    {
        Assert.Equal(
            new ReportChange(ReportStatus.Investigating, null, "Satıcıdan şəkil istənildi."),
            ReportRules.Update(new ReportUpdateDto { Status = "investigating", Note = " Satıcıdan şəkil istənildi. " }, ReportStatus.Open, null).Change);

        var (change, errors) = ReportRules.Update(new ReportUpdateDto { Status = "resolved" }, ReportStatus.Investigating, null);
        Assert.Null(change);
        Assert.Equal(FieldErrors.Required, Errors(errors)["resolution"]);

        Assert.Equal(
            new ReportChange(ReportStatus.Resolved, ReportResolution.NoViolation, null),
            ReportRules.Update(new ReportUpdateDto { Status = "resolved", Resolution = "no-violation" }, ReportStatus.Open, null).Change);
    }

    [Fact]
    public void A_resolved_report_keeps_its_resolution_until_reopened()
    {
        Assert.Equal(
            new ReportChange(ReportStatus.Resolved, ReportResolution.ActionTaken, "Elan silindi."),
            ReportRules.Update(new ReportUpdateDto { Note = "Elan silindi." }, ReportStatus.Resolved, ReportResolution.ActionTaken).Change);
        Assert.Equal(
            new ReportChange(ReportStatus.Resolved, ReportResolution.NoViolation, null),
            ReportRules.Update(new ReportUpdateDto { Resolution = "no-violation" }, ReportStatus.Resolved, ReportResolution.ActionTaken).Change);
        Assert.Equal(
            new ReportChange(ReportStatus.Open, null, null),
            ReportRules.Update(new ReportUpdateDto { Status = "open" }, ReportStatus.Resolved, ReportResolution.ActionTaken).Change);
    }

    [Theory]
    [InlineData("done", null, null, "status", FieldErrors.Invalid)]
    [InlineData(null, null, null, "status", FieldErrors.Required)]
    [InlineData(null, null, "   ", "status", FieldErrors.Required)]
    [InlineData("investigating", "no-violation", null, "resolution", FieldErrors.Invalid)]
    [InlineData("resolved", "fixed", null, "resolution", FieldErrors.Invalid)]
    public void A_bad_change_names_its_field(string? status, string? resolution, string? note, string field, string code)
    {
        var (change, errors) = ReportRules.Update(new ReportUpdateDto { Status = status, Resolution = resolution, Note = note }, ReportStatus.Open, null);

        Assert.Null(change);
        Assert.Equal(code, Errors(errors)[field]);
    }

    [Fact]
    public void A_note_is_at_most_500_characters() =>
        Assert.Equal(FieldErrors.TooLong, Errors(ReportRules.Update(new ReportUpdateDto { Note = new string('n', 501) }, ReportStatus.Open, null).Errors)["note"]);

    /// <summary>The first error of each field, as the 400 answer would carry them.</summary>
    private static Dictionary<string, string> Errors(FieldErrors errors)
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
