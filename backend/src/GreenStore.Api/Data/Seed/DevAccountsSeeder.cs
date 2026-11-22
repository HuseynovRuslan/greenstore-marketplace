using GreenStore.Api.Common;
using GreenStore.Api.Modules.Accounts;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Data.Seed;

/// <summary>A staff account with a known password, for local work only.</summary>
public sealed record DevAccount(string Phone, string Email, string FullName, UserRole Role, string Password);

/// <summary>
/// A moderator and an admin with dev-only passwords (<c>Seed:DevAccounts</c>, true in appsettings.Development.json
/// only; the API refuses to start with it in Production). Listed in backend/README.md. Insert-if-missing by phone, like
/// the rest of the seed: a changed password is not reset. Their numbers are mobiles, so signing in with an SMS code
/// (the demo code in Development) works too.
/// </summary>
public static class DevAccountsSeeder
{
    public static readonly IReadOnlyList<DevAccount> Accounts =
    [
        new("+994500000001", "admin@greenstore.local", "GreenStore Admin", UserRole.Admin, "Admin-dev-2026"),
        new("+994500000002", "moderator@greenstore.local", "GreenStore Moderator", UserRole.Moderator, "Moderator-dev-2026"),
    ];

    /// <returns>The number of accounts added.</returns>
    public static async Task<int> SeedAsync(AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var phones = Accounts.Select(a => a.Phone).ToList();
        var existing = await db.Users.Where(u => u.Phone != null && phones.Contains(u.Phone)).Select(u => u.Phone!).ToListAsync(ct);
        var hasher = new PasswordHasher<User>();
        var added = 0;
        foreach (var account in Accounts.Where(a => !existing.Contains(a.Phone)))
        {
            var user = new User
            {
                Id = Ids.New(clock),
                Phone = account.Phone,
                Email = account.Email,
                FullName = account.FullName,
                AccountType = AccountType.Individual,
                Role = account.Role,
                CreatedAt = clock.GetUtcNow(),
            };
            user.PasswordHash = hasher.HashPassword(user, account.Password);
            db.Users.Add(user);
            added++;
        }

        await db.SaveChangesAsync(ct);
        return added;
    }
}
