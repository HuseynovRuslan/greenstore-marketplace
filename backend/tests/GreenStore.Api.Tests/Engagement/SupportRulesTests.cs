using GreenStore.Api.Common.Errors;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>«Bizimlə əlaqə», without a database.</summary>
public sealed class SupportRulesTests
{
    private static SupportMessageInputDto Good(string contact = "+994 50 555 12 34") => new()
    {
        Topic = "listing",
        Name = " Rauf ",
        Contact = contact,
        Message = "  Elanım 3 gündür yoxlamadadır, nə vaxt dərc olunacaq?  ",
        ListingNumber = 10482,
    };

    [Fact]
    public void A_good_message_keeps_a_phone_in_E164()
    {
        var (message, errors) = SupportRules.Validate(Good());

        Assert.False(errors.Any);
        Assert.Equal(new SupportSubmission(SupportTopic.Listing, "Rauf", "+994505551234", "Elanım 3 gündür yoxlamadadır, nə vaxt dərc olunacaq?", 10482), message);
    }

    [Fact]
    public void An_email_contact_is_kept_as_typed() =>
        Assert.Equal("Rauf.M@example.az", SupportRules.Validate(Good(" Rauf.M@example.az ")).Message!.Contact);

    [Theory]
    [InlineData("topic", null, FieldErrors.Required)]
    [InlineData("topic", "billing", FieldErrors.Invalid)]
    [InlineData("name", "  ", FieldErrors.Required)]
    [InlineData("contact", null, FieldErrors.Required)]
    [InlineData("contact", "zəng edin", FieldErrors.Invalid)]
    [InlineData("contact", "1234", FieldErrors.Invalid)]
    [InlineData("contact", "rauf@", FieldErrors.Invalid)]
    [InlineData("message", "Salam", FieldErrors.TooShort)]
    [InlineData("message", null, FieldErrors.Required)]
    public void A_bad_message_names_its_field(string field, string? value, string code)
    {
        var good = Good();
        var input = field switch
        {
            "topic" => good with { Topic = value },
            "name" => good with { Name = value },
            "contact" => good with { Contact = value },
            _ => good with { Message = value },
        };

        var (message, errors) = SupportRules.Validate(input);

        Assert.Null(message);
        Assert.Equal(code, FieldErrorsReader.FirstErrors(errors)[field]);
    }

    [Fact]
    public void Lengths_and_the_listing_number_are_checked()
    {
        var errors = FieldErrorsReader.FirstErrors(SupportRules.Validate(Good() with
        {
            Name = new string('n', 61),
            Message = new string('m', 2001),
            ListingNumber = 0,
        }).Errors);

        Assert.Equal(FieldErrors.TooLong, errors["name"]);
        Assert.Equal(FieldErrors.TooLong, errors["message"]);
        Assert.Equal(FieldErrors.Invalid, errors["listingNumber"]);
        Assert.Null(SupportRules.Validate(Good() with { ListingNumber = null }).Message!.ListingNumber);
    }

    [Fact]
    public void Every_topic_of_the_form_is_known() =>
        Assert.All(new[] { "listing", "account", "payment", "complaint", "other" }, topic => Assert.NotNull(SupportRules.Validate(Good() with { Topic = topic }).Message));
}
