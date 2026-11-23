using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Modules.Engagement;

/// <summary><c>ReportInput</c> of src/types (backend-contract.md 4.1). Strings, so a wrong value is a field error.</summary>
public sealed record ReportInputDto
{
    /// <summary><c>listing</c>, <c>seller</c> or <c>service</c>.</summary>
    public string? Target { get; init; }

    public string? TargetId { get; init; }

    /// <summary>A <see cref="ReportReason"/> code (<c>wrong-price</c>).</summary>
    public string? Reason { get; init; }

    public string? Comment { get; init; }
}

/// <summary>A report that passed the rules, before its target is looked up.</summary>
public sealed record ReportSubmission(ReportTarget Target, Guid TargetId, ReportReason Reason, string? Comment);

/// <summary>A staff member's change of a report (<c>PATCH /admin/reports/{id}</c>).</summary>
public sealed record ReportUpdateDto
{
    /// <summary><c>open</c>, <c>investigating</c> or <c>resolved</c>; not sent: unchanged.</summary>
    public string? Status { get; init; }

    /// <summary><c>action-taken</c> or <c>no-violation</c>: required to resolve, refused otherwise.</summary>
    public string? Resolution { get; init; }

    /// <summary>«Moderator qeydi»: kept in the report's history.</summary>
    public string? Note { get; init; }
}

/// <summary>What a report becomes: its status and resolution, and the note for the history.</summary>
public sealed record ReportChange(ReportStatus Status, ReportResolution? Resolution, string? Note);

/// <summary>
/// The rules of «Şikayət et» and of handling reports (backend-contract.md 4.1), without ASP.NET or EF: which reasons a
/// target allows, the comment, and the staff's status changes.
/// </summary>
public static class ReportRules
{
    public const int MaxCommentLength = 500;

    public const int MaxNoteLength = 500;

    /// <summary>Field error: the reason is not one of the target's (<see cref="ReasonsFor"/>).</summary>
    public const string ReasonNotForTarget = "not-for-target";

    /// <summary>
    /// The reasons each target offers, in the order of the site's dialog (src/features/seller/complaintReasons.ts).
    /// </summary>
    public static IReadOnlyList<ReportReason> ReasonsFor(ReportTarget target) => target switch
    {
        ReportTarget.Listing =>
        [
            ReportReason.Sold, ReportReason.WrongPrice, ReportReason.WrongPhotos, ReportReason.WrongInfo,
            ReportReason.Unreachable, ReportReason.Duplicate, ReportReason.Fraud, ReportReason.Other,
        ],
        ReportTarget.Seller =>
        [
            ReportReason.Unreachable, ReportReason.WrongInfo, ReportReason.Misconduct, ReportReason.Fraud, ReportReason.Other,
        ],
        _ =>
        [
            ReportReason.NotProvided, ReportReason.WrongPrice, ReportReason.StolenPhotos, ReportReason.Unreachable,
            ReportReason.Fraud, ReportReason.Other,
        ],
    };

    /// <summary>
    /// The report, or the field errors: <c>target</c>, <c>targetId</c> (<c>required</c>, <c>invalid</c>),
    /// <c>reason</c> (<c>required</c>, <c>invalid</c>, <c>not-for-target</c>), <c>comment</c> (<c>required</c> for
    /// <c>other</c>, <c>too-long</c>). A blank comment is none.
    /// </summary>
    public static (ReportSubmission? Report, FieldErrors Errors) Validate(ReportInputDto input)
    {
        var errors = new FieldErrors();
        ReportTarget? target = null;
        if (string.IsNullOrWhiteSpace(input.Target))
        {
            errors.Add("target", FieldErrors.Required);
        }
        else if (KebabCase.TryParse<ReportTarget>(input.Target.Trim(), out var parsedTarget))
        {
            target = parsedTarget;
        }
        else
        {
            errors.Add("target", FieldErrors.Invalid);
        }

        Guid targetId = default;
        if (string.IsNullOrWhiteSpace(input.TargetId))
        {
            errors.Add("targetId", FieldErrors.Required);
        }
        else if (!Guid.TryParseExact(input.TargetId.Trim(), "D", out targetId))
        {
            errors.Add("targetId", FieldErrors.Invalid);
        }

        ReportReason? reason = null;
        if (string.IsNullOrWhiteSpace(input.Reason))
        {
            errors.Add("reason", FieldErrors.Required);
        }
        else if (!KebabCase.TryParse<ReportReason>(input.Reason.Trim(), out var parsedReason))
        {
            errors.Add("reason", FieldErrors.Invalid);
        }
        else if (target is { } t && !ReasonsFor(t).Contains(parsedReason))
        {
            errors.Add("reason", ReasonNotForTarget);
        }
        else
        {
            reason = parsedReason;
        }

        var comment = Clean(input.Comment);
        if (comment is { Length: > MaxCommentLength })
        {
            errors.Add("comment", FieldErrors.TooLong);
        }
        else if (comment is null && reason == ReportReason.Other)
        {
            errors.Add("comment", FieldErrors.Required);
        }

        return errors.Any || target is null || reason is null
            ? (null, errors)
            : (new ReportSubmission(target.Value, targetId, reason.Value, comment), errors);
    }

    /// <summary>
    /// The report after a staff member's change, or the field errors. A resolved report needs a resolution
    /// (<c>resolution: required</c>); one that is not resolved has none (<c>resolution: invalid</c>, and reopening
    /// clears it). A change with nothing in it is <c>status: required</c>. The note is at most 500 characters.
    /// </summary>
    public static (ReportChange? Change, FieldErrors Errors) Update(ReportUpdateDto input, ReportStatus current, ReportResolution? currentResolution)
    {
        var errors = new FieldErrors();
        var status = current;
        if (input.Status is not null)
        {
            if (KebabCase.TryParse<ReportStatus>(input.Status.Trim(), out var parsed))
            {
                status = parsed;
            }
            else
            {
                errors.Add("status", FieldErrors.Invalid);
            }
        }

        ReportResolution? resolution = null;
        if (input.Resolution is not null)
        {
            if (KebabCase.TryParse<ReportResolution>(input.Resolution.Trim(), out var parsed))
            {
                resolution = parsed;
            }
            else
            {
                errors.Add("resolution", FieldErrors.Invalid);
            }
        }

        var note = Clean(input.Note);
        errors.Add("note", note is { Length: > MaxNoteLength } ? FieldErrors.TooLong : null);
        if (input.Status is null && input.Resolution is null && note is null)
        {
            errors.Add("status", FieldErrors.Required);
        }

        if (!errors.Any)
        {
            if (status == ReportStatus.Resolved)
            {
                // Resolving needs a resolution; a resolved report keeps its own unless a new one is sent.
                resolution ??= current == ReportStatus.Resolved ? currentResolution : null;
                errors.Add("resolution", resolution is null ? FieldErrors.Required : null);
            }
            else if (resolution is not null)
            {
                errors.Add("resolution", FieldErrors.Invalid);
            }
        }

        return errors.Any ? (null, errors) : (new ReportChange(status, status == ReportStatus.Resolved ? resolution : null, note), errors);
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
