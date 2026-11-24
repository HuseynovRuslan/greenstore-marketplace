using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Common.Json;
using GreenStore.Api.Modules.Accounts;

namespace GreenStore.Api.Modules.Sellers;

/// <summary>
/// <c>PATCH /me/seller</c>: what is sent changes, what is not stays. The company name, kinds and city cannot be
/// removed; for the rest <c>null</c> or <c>""</c> (<c>[]</c> for lists) removes the value.
/// </summary>
public sealed class SellerPatch : PatchBody
{
    /// <summary>«Şirkətin adı». The slug (the page's address) stays as it is.</summary>
    public string? Name { get; set => field = Sent(value); }

    /// <summary>One or more; a kind sent twice counts once. <c>null</c> or <c>[]</c> is <c>required</c>.</summary>
    public List<BusinessKind>? BusinessKinds { get; set => field = Sent(value); }

    public string? CityId { get; set => field = Sent(value); }

    /// <summary>«Əlaqə şəxsi».</summary>
    public string? ContactPerson { get; set => field = Sent(value); }

    public string? Address { get; set => field = Sent(value); }

    /// <summary>«Şirkət haqqında».</summary>
    public string? About { get; set => field = Sent(value); }

    /// <summary>Delivery and visiting terms (the second paragraph of the seller page).</summary>
    public string? Terms { get; set => field = Sent(value); }

    public List<OpeningHours>? Hours { get; set => field = Sent(value); }

    public List<SellerOffer>? Offers { get; set => field = Sent(value); }

    /// <summary>The business's own number (any Azerbaijani number); removed, the owner's number is shown.</summary>
    public string? Phone { get; set => field = Sent(value); }

    public bool? Whatsapp { get; set => field = Sent(value); }

    /// <summary>The business's public e-mail (the account's e-mail is <c>PATCH /me</c>).</summary>
    public string? Email { get; set => field = Sent(value); }

    public string? Instagram { get; set => field = Sent(value); }

    public string? Website { get; set => field = Sent(value); }

    /// <summary>«Adətən 1 saat ərzində cavab verir»: minutes, 1–10 080 (a week).</summary>
    public int? ResponseMinutes { get; set => field = Sent(value); }

    public LocationDto? Location { get; set => field = Sent(value); }

    /// <summary>
    /// The logo: the id of one of the caller's ready <c>seller-logo</c> photos (<c>POST /photos</c>); <c>null</c>
    /// removes it (<see cref="SellerPhotos"/>).
    /// </summary>
    public Guid? LogoPhotoId { get; set => field = Sent(value); }

    /// <summary>The cover («üz şəkli»): the id of one of the caller's ready <c>seller-cover</c> photos; <c>null</c> removes it.</summary>
    public Guid? CoverPhotoId { get; set => field = Sent(value); }

    /// <summary>The <c>version</c> of <c>GET /me/seller</c>: when sent, a profile changed since then is a 409 instead of being overwritten.</summary>
    public string? Version { get; set => field = Sent(value); }
}

/// <summary>The rules of a business profile's fields (DATABASE.md §3.3 and the profile form), without the database.</summary>
public static class SellerProfileRules
{
    public const int NameMinLength = 2;
    public const int NameMaxLength = 80;
    public const int ContactPersonMaxLength = 60;
    public const int AddressMaxLength = 200;
    public const int AboutMaxLength = 2000;
    public const int TermsMaxLength = 1000;
    public const int InstagramMaxLength = 100;
    public const int WebsiteMaxLength = 200;
    public const int ResponseMinutesMax = 7 * 24 * 60;

    /// <summary>
    /// Applies <paramref name="patch"/> to <paramref name="seller"/> and returns the field errors (nothing should be
    /// saved when there are any). <paramref name="activeCityIds"/> are the cities a profile may be in.
    /// </summary>
    public static FieldErrors Apply(Seller seller, SellerPatch patch, IReadOnlySet<string> activeCityIds)
    {
        var errors = new FieldErrors();
        if (patch.Has(nameof(SellerPatch.Name)))
        {
            var name = patch.Name?.Trim() ?? string.Empty;
            errors.Add("name", name.Length switch
            {
                0 => FieldErrors.Required,
                < NameMinLength => FieldErrors.TooShort,
                > NameMaxLength => FieldErrors.TooLong,
                _ => null,
            });
            seller.Name = name;
        }

        if (patch.Has(nameof(SellerPatch.BusinessKinds)))
        {
            var kinds = patch.BusinessKinds ?? [];
            errors.Add("businessKinds", kinds.Count == 0 ? FieldErrors.Required : null);
            seller.BusinessKinds = kinds.Count == 0 ? seller.BusinessKinds : BusinessKindCodes.From(kinds);
        }

        if (patch.Has(nameof(SellerPatch.CityId)))
        {
            var cityId = patch.CityId?.Trim();
            errors.Add("cityId", string.IsNullOrEmpty(cityId) ? FieldErrors.Required : activeCityIds.Contains(cityId) ? null : FieldErrors.Invalid);
            seller.CityId = string.IsNullOrEmpty(cityId) ? seller.CityId : cityId;
        }

        if (patch.Has(nameof(SellerPatch.ContactPerson)))
        {
            seller.ContactPerson = Text(patch.ContactPerson, ContactPersonMaxLength, "contactPerson", errors);
        }

        if (patch.Has(nameof(SellerPatch.Address)))
        {
            seller.Address = Text(patch.Address, AddressMaxLength, "address", errors);
        }

        if (patch.Has(nameof(SellerPatch.About)))
        {
            seller.About = Text(patch.About, AboutMaxLength, "about", errors);
        }

        if (patch.Has(nameof(SellerPatch.Terms)))
        {
            seller.Terms = Text(patch.Terms, TermsMaxLength, "terms", errors);
        }

        if (patch.Has(nameof(SellerPatch.Hours)))
        {
            var hours = patch.Hours ?? [];
            errors.Add("hours", HoursAreValid(hours) ? null : FieldErrors.Invalid);
            seller.Hours = hours.Count == 0 ? null : hours.OrderBy(h => h.Day).ToList();
        }

        if (patch.Has(nameof(SellerPatch.Offers)))
        {
            seller.Offers = (patch.Offers ?? []).Distinct().Order().Select(o => KebabCase.Value(o)).ToList();
        }

        if (patch.Has(nameof(SellerPatch.Phone)))
        {
            var phone = patch.Phone?.Trim();
            var normalized = PhoneNumbers.Normalize(phone);
            errors.Add("phone", string.IsNullOrEmpty(phone) || normalized is not null ? null : FieldErrors.Invalid);
            seller.Phone = normalized;
        }

        if (patch.Has(nameof(SellerPatch.Whatsapp)))
        {
            errors.Add("whatsapp", patch.Whatsapp is null ? FieldErrors.Required : null);
            seller.Whatsapp = patch.Whatsapp ?? seller.Whatsapp;
        }

        if (patch.Has(nameof(SellerPatch.Email)))
        {
            var (email, error) = EmailAddresses.Clean(patch.Email);
            errors.Add("email", error);
            seller.Email = email;
        }

        if (patch.Has(nameof(SellerPatch.Instagram)))
        {
            var instagram = Text(patch.Instagram, InstagramMaxLength, "instagram", errors);
            errors.Add("instagram", instagram is not null && instagram.Any(char.IsWhiteSpace) ? FieldErrors.Invalid : null);
            seller.Instagram = instagram;
        }

        if (patch.Has(nameof(SellerPatch.Website)))
        {
            var website = Text(patch.Website, WebsiteMaxLength, "website", errors);
            errors.Add("website", website is null || IsWebAddress(website) ? null : FieldErrors.Invalid);
            seller.Website = website;
        }

        if (patch.Has(nameof(SellerPatch.ResponseMinutes)))
        {
            errors.Add("responseMinutes", patch.ResponseMinutes is null or (>= 1 and <= ResponseMinutesMax) ? null : FieldErrors.Invalid);
            seller.ResponseMinutes = patch.ResponseMinutes;
        }

        if (patch.Has(nameof(SellerPatch.Location)))
        {
            var location = patch.Location;
            errors.Add("location", location is null || (Math.Abs(location.Lat) <= 90 && Math.Abs(location.Lng) <= 180) ? null : FieldErrors.Invalid);
            seller.Lat = location is null ? null : Math.Round(location.Lat, 6);
            seller.Lng = location is null ? null : Math.Round(location.Lng, 6);
        }

        return errors;
    }

    /// <summary>Each weekday once; an open day from "HH:mm" to a later "HH:mm"; a closed day without times.</summary>
    public static bool HoursAreValid(IReadOnlyList<OpeningHours> hours)
    {
        if (hours.Select(h => h.Day).Distinct().Count() != hours.Count)
        {
            return false;
        }

        foreach (var day in hours)
        {
            if (day.Day is < 1 or > 7)
            {
                return false;
            }

            if (day.Closed == true)
            {
                if (day.Open is not null || day.Close is not null)
                {
                    return false;
                }

                continue;
            }

            if (!TryTime(day.Open, out var open) || !TryTime(day.Close, out var close) || close <= open)
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>An absolute http(s) address with a host.</summary>
    public static bool IsWebAddress(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
        && uri.Host.Contains('.', StringComparison.Ordinal);

    private static bool TryTime([NotNullWhen(true)] string? value, out TimeOnly time)
    {
        time = default;
        return value is { Length: 5 } && TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out time);
    }

    /// <summary>A trimmed optional text: null when empty, <c>too-long</c> beyond <paramref name="max"/>.</summary>
    private static string? Text(string? value, int max, string field, FieldErrors errors)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        errors.Add(field, trimmed.Length > max ? FieldErrors.TooLong : null);
        return trimmed;
    }
}
