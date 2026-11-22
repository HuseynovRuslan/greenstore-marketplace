using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Promotion;

/// <summary>
/// Every promotion package and option, read once per request (a handful of rows), inactive ones included: old orders
/// and pending choices keep theirs. What may be bought now is <see cref="Offered"/>.
/// </summary>
public sealed class PromotionCatalogue
{
    private readonly Dictionary<string, PromotionPackage> packagesById;
    private readonly Dictionary<string, PromotionOption> optionsById;

    public PromotionCatalogue(IReadOnlyList<PromotionPackage> packages, IReadOnlyList<PromotionOption> options)
    {
        Packages = packages.OrderBy(p => p.SortOrder).ThenBy(p => p.Id, StringComparer.Ordinal).ToList();
        packagesById = packages.ToDictionary(p => p.Id, StringComparer.Ordinal);
        optionsById = options.ToDictionary(o => o.Id, StringComparer.Ordinal);
        Options = options.OrderBy(o => o.SortOrder).ThenBy(o => o.Id, StringComparer.Ordinal).ToList();
    }

    /// <summary>Every package in the site's order.</summary>
    public IReadOnlyList<PromotionPackage> Packages { get; }

    /// <summary>Every option in the site's order.</summary>
    public IReadOnlyList<PromotionOption> Options { get; }

    public PromotionPackage? Package(string? id) => id is not null && packagesById.TryGetValue(id, out var package) ? package : null;

    public PromotionOption? Option(string? id) => id is not null && optionsById.TryGetValue(id, out var option) ? option : null;

    /// <summary>The package of an option; null for an unknown option.</summary>
    public string? PackageOf(string? optionId) => Option(optionId)?.PackageId;

    /// <summary>
    /// Can <paramref name="optionId"/> of <paramref name="packageId"/> be bought now: both active, the option is the
    /// package's, and it buys what the package promises (<see cref="PromotionTerms.IsValid"/>)?
    /// </summary>
    public PromotionOption? Offered(string? packageId, string? optionId)
    {
        var option = Option(optionId);
        var package = Package(packageId);
        return option is { IsActive: true } && package is { IsActive: true } && option.PackageId == package.Id
            && PromotionTerms.Of(option).IsValid
            ? option
            : null;
    }

    /// <summary>The packages on offer with their options on offer, in the site's order; a package without any is left out.</summary>
    public IEnumerable<(PromotionPackage Package, IReadOnlyList<PromotionOption> Options)> OnOffer() =>
        Packages
            .Where(p => p.IsActive)
            .Select(p => (p, (IReadOnlyList<PromotionOption>)Options.Where(o => o.PackageId == p.Id && Offered(p.Id, o.Id) is not null).ToList()))
            .Where(p => p.Item2.Count > 0);

    public static async Task<PromotionCatalogue> LoadAsync(AppDbContext db, CancellationToken cancellationToken) =>
        new(
            await db.PromotionPackages.AsNoTracking().ToListAsync(cancellationToken),
            await db.PromotionOptions.AsNoTracking().ToListAsync(cancellationToken));
}
