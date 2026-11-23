using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Modules.Engagement;

/// <summary><c>SupportMessageInput</c> of src/types («Bizimlə əlaqə»). Strings, so a wrong value is a field error.</summary>
public sealed record SupportMessageInputDto
{
    /// <summary><c>listing</c>, <c>account</c>, <c>payment</c>, <c>complaint</c> or <c>other</c>.</summary>
    public string? Topic { get; init; }

    public string? Name { get; init; }

    /// <summary>A phone or an e-mail.</summary>
    public string? Contact { get; init; }

    public string? Message { get; init; }

    /// <summary>«Elan №», when the question is about a listing.</summary>
    public long? ListingNumber { get; init; }
}

/// <summary>A message that passed the rules; a phone contact is in E.164.</summary>
public sealed record SupportSubmission(SupportTopic Topic, string Name, string Contact, string Message, long? ListingNumber);

/// <summary>The rules of «Bizimlə əlaqə» (src/features/support/actions.ts), without ASP.NET or EF.</summary>
public static class SupportRules
{
    public const int MaxNameLength = 60;

    public const int MinContactLength = 5;

    public const int MaxContactLength = 254;

    public const int MinMessageLength = 10;

    public const int MaxMessageLength = 2000;

    /// <summary>
    /// The message, or the field errors: <c>topic</c> (<c>required</c>, <c>invalid</c>), <c>name</c> (1–60),
    /// <c>contact</c> (an Azerbaijani phone or an e-mail: <c>required</c>, <c>invalid</c>), <c>message</c> (10–2000),
    /// <c>listingNumber</c> (positive).
    /// </summary>
    public static (SupportSubmission? Message, FieldErrors Errors) Validate(SupportMessageInputDto input)
    {
        var errors = new FieldErrors();
        SupportTopic? topic = null;
        if (string.IsNullOrWhiteSpace(input.Topic))
        {
            errors.Add("topic", FieldErrors.Required);
        }
        else if (KebabCase.TryParse<SupportTopic>(input.Topic.Trim(), out var parsed))
        {
            topic = parsed;
        }
        else
        {
            errors.Add("topic", FieldErrors.Invalid);
        }

        var name = Clean(input.Name);
        errors.Add("name", name switch
        {
            null => FieldErrors.Required,
            { Length: > MaxNameLength } => FieldErrors.TooLong,
            _ => null,
        });

        var contact = Contact(input.Contact, out var contactError);
        errors.Add("contact", contactError);

        var message = Clean(input.Message);
        errors.Add("message", message switch
        {
            null => FieldErrors.Required,
            { Length: < MinMessageLength } => FieldErrors.TooShort,
            { Length: > MaxMessageLength } => FieldErrors.TooLong,
            _ => null,
        });

        errors.Add("listingNumber", input.ListingNumber is <= 0 ? FieldErrors.Invalid : null);

        return errors.Any || topic is null
            ? (null, errors)
            : (new SupportSubmission(topic.Value, name!, contact!, message!, input.ListingNumber), errors);
    }

    /// <summary>A phone (any common spelling, kept as E.164) or an e-mail (kept as typed, trimmed).</summary>
    public static string? Contact(string? value, out string? error)
    {
        var text = Clean(value);
        error = null;
        if (text is null)
        {
            error = FieldErrors.Required;
            return null;
        }

        if (PhoneNumbers.Normalize(text) is { } phone)
        {
            return phone;
        }

        if (text.Length is < MinContactLength or > MaxContactLength)
        {
            error = FieldErrors.Invalid;
            return null;
        }

        var (email, emailError) = EmailAddresses.Clean(text);
        if (email is null || emailError is not null)
        {
            error = FieldErrors.Invalid;
            return null;
        }

        return email;
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
