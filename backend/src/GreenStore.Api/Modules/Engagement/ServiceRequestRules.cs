using System.Globalization;
using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Modules.Taxonomy;

namespace GreenStore.Api.Modules.Engagement;

/// <summary>
/// <c>ServiceRequestInput</c> of src/types («Usta çağır»). Strings, so a wrong value is a field error, not a 400
/// <c>bad-request</c>; <c>preferredDate</c> is <c>YYYY-MM-DD</c>, as the form's date field sends it.
/// </summary>
public sealed record ServiceRequestInputDto
{
    /// <summary>The service whose page it is sent from: it goes to that service's provider.</summary>
    public string? ServiceId { get; init; }

    /// <summary>A chosen provider: the account id (<c>Service.providerId</c>) or a business's seller id.</summary>
    public string? ProviderId { get; init; }

    public string? CategoryId { get; init; }

    public string? CityId { get; init; }

    public string? Area { get; init; }

    public string? PreferredDate { get; init; }

    public string? Size { get; init; }

    public string? Description { get; init; }

    public string? Name { get; init; }

    public string? Phone { get; init; }
}

/// <summary>A request that passed the rules, before its provider is looked up.</summary>
public sealed record ServiceRequestDraft
{
    public Guid? ServiceId { get; init; }

    public Guid? ProviderId { get; init; }

    public required string CategoryId { get; init; }

    public required string CityId { get; init; }

    public string? Area { get; init; }

    public DateOnly? PreferredDate { get; init; }

    public string? Size { get; init; }

    public required string Description { get; init; }

    public required string Name { get; init; }

    /// <summary>E.164.</summary>
    public required string Phone { get; init; }
}

/// <summary>An active service of a provider, as the fan-out of <see cref="ServiceRequestRules.ChooseProviders"/> reads it.</summary>
public sealed record ProviderCandidate(
    Guid OwnerUserId,
    string CategoryId,
    string? SubcategoryId,
    string CityId,
    IReadOnlyList<string> ServedCityIds,
    bool Promoted,
    bool Verified,
    DateTimeOffset? SortAt);

/// <summary>
/// The rules of «Usta çağır» (src/features/services/actions.ts and the form's own checks), without ASP.NET or EF.
/// </summary>
public static class ServiceRequestRules
{
    public const int MaxAreaLength = 80;

    public const int MaxSizeLength = 40;

    public const int MinDescriptionLength = 10;

    public const int MaxDescriptionLength = 1000;

    public const int MaxNameLength = 60;

    /// <summary>How far ahead a preferred date may be.</summary>
    public const int MaxDaysAhead = 365;

    /// <summary>Field error: the preferred date is before today (Baku time).</summary>
    public const string InPast = "in-past";

    public const string OutOfRange = "out-of-range";

    /// <summary>
    /// The request, or the field errors: <c>categoryId</c> (an active service type: the service category or one of its
    /// sub-categories), <c>cityId</c> (an active city), <c>description</c> (10–1000), <c>name</c> (1–60),
    /// <c>phone</c> (an Azerbaijani number), <c>area</c> (≤ 80), <c>size</c> (≤ 40), <c>preferredDate</c> (today to a
    /// year ahead), <c>serviceId</c> and <c>providerId</c> (ids).
    /// </summary>
    public static (ServiceRequestDraft? Request, FieldErrors Errors) Validate(ServiceRequestInputDto input, TaxonomySnapshot taxonomy, DateOnly today)
    {
        var errors = new FieldErrors();
        var serviceId = OptionalId(input.ServiceId, "serviceId", errors);
        var providerId = OptionalId(input.ProviderId, "providerId", errors);

        var categoryId = Clean(input.CategoryId);
        if (categoryId is null)
        {
            errors.Add("categoryId", FieldErrors.Required);
        }
        else if (taxonomy.Category(categoryId) is not { Kind: CategoryKind.Service, IsActive: true })
        {
            errors.Add("categoryId", FieldErrors.Invalid);
        }

        var cityId = Clean(input.CityId);
        if (cityId is null)
        {
            errors.Add("cityId", FieldErrors.Required);
        }
        else if (taxonomy.City(cityId) is not { IsActive: true })
        {
            errors.Add("cityId", FieldErrors.Invalid);
        }

        var area = Clean(input.Area);
        errors.Add("area", area is { Length: > MaxAreaLength } ? FieldErrors.TooLong : null);
        var size = Clean(input.Size);
        errors.Add("size", size is { Length: > MaxSizeLength } ? FieldErrors.TooLong : null);

        DateOnly? preferredDate = null;
        var date = Clean(input.PreferredDate);
        if (date is not null)
        {
            if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            {
                errors.Add("preferredDate", FieldErrors.Invalid);
            }
            else if (parsed < today)
            {
                errors.Add("preferredDate", InPast);
            }
            else if (parsed > today.AddDays(MaxDaysAhead))
            {
                errors.Add("preferredDate", OutOfRange);
            }
            else
            {
                preferredDate = parsed;
            }
        }

        var description = Clean(input.Description);
        errors.Add("description", description switch
        {
            null => FieldErrors.Required,
            { Length: < MinDescriptionLength } => FieldErrors.TooShort,
            { Length: > MaxDescriptionLength } => FieldErrors.TooLong,
            _ => null,
        });

        var name = Clean(input.Name);
        errors.Add("name", name switch
        {
            null => FieldErrors.Required,
            { Length: > MaxNameLength } => FieldErrors.TooLong,
            _ => null,
        });

        var phone = PhoneNumbers.Normalize(input.Phone);
        errors.Add("phone", string.IsNullOrWhiteSpace(input.Phone) ? FieldErrors.Required : phone is null ? FieldErrors.Invalid : null);

        if (errors.Any)
        {
            return (null, errors);
        }

        return (new ServiceRequestDraft
        {
            ServiceId = serviceId,
            ProviderId = providerId,
            CategoryId = categoryId!,
            CityId = cityId!,
            Area = area,
            PreferredDate = preferredDate,
            Size = size,
            Description = description!,
            Name = name!,
            Phone = phone!,
        }, errors);
    }

    /// <summary>
    /// The providers a request without a chosen one goes to (DATABASE.md §3.8): the owners of active services of the
    /// request's type (the service category itself takes every type) who are in the city or serve it, never the
    /// customer, each once, at most <paramref name="max"/>. Promoted services first, then verified businesses, then the
    /// most recently published, so the order is the catalogue's.
    /// </summary>
    public static IReadOnlyList<Guid> ChooseProviders(IEnumerable<ProviderCandidate> services, string categoryId, string cityId, Guid? customerUserId, int max) =>
        services
            .Where(s => s.OwnerUserId != customerUserId && Fits(s, categoryId, cityId))
            .GroupBy(s => s.OwnerUserId)
            .Select(g => new
            {
                Owner = g.Key,
                Promoted = g.Any(s => s.Promoted),
                Verified = g.Any(s => s.Verified),
                Latest = g.Max(s => s.SortAt ?? DateTimeOffset.MinValue),
            })
            .OrderByDescending(p => p.Promoted)
            .ThenByDescending(p => p.Verified)
            .ThenByDescending(p => p.Latest)
            .ThenBy(p => p.Owner)
            .Take(max)
            .Select(p => p.Owner)
            .ToList();

    /// <summary>The service is of the request's type and in (or serving) its city.</summary>
    public static bool Fits(ProviderCandidate service, string categoryId, string cityId) =>
        (service.SubcategoryId == categoryId || service.CategoryId == categoryId)
        && (service.CityId == cityId || service.ServedCityIds.Contains(cityId));

    private static Guid? OptionalId(string? value, string field, FieldErrors errors)
    {
        var text = Clean(value);
        if (text is null)
        {
            return null;
        }

        if (Guid.TryParseExact(text, "D", out var id))
        {
            return id;
        }

        errors.Add(field, FieldErrors.Invalid);
        return null;
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
