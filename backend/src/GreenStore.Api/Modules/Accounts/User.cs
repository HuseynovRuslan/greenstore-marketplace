using GreenStore.Api.Common.Localization;
using GreenStore.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>
/// An account (DATABASE.md §3.2): the final table, created in phase 1 because sellers and listings point to it.
/// Sign-up, sign-in and sessions arrive in phase 2. The phone is always one the user verified with an SMS code.
/// </summary>
public sealed class User : IHasUpdatedAt
{
    public Guid Id { get; set; }

    /// <summary>E.164 (<c>+994505551234</c>); null only for a deleted account.</summary>
    public string? Phone { get; set; }

    public string? Email { get; set; }

    public DateTimeOffset? EmailVerifiedAt { get; set; }

    /// <summary>PBKDF2 (ASP.NET Core Identity's hasher, phase 2).</summary>
    public string? PasswordHash { get; set; }

    public required string FullName { get; set; }

    public AccountType AccountType { get; set; }

    public UserRole Role { get; set; }

    public UserStatus Status { get; set; }

    /// <summary>The language of SMS and e-mail.</summary>
    public Language Locale { get; set; }

    public short FailedLogins { get; set; }

    public DateTimeOffset? LockedUntil { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public DateTimeOffset? DeletedAt { get; set; }
}

/// <summary><c>SellerType</c> in src/types.</summary>
public enum AccountType
{
    Individual,
    Business,
}

public enum UserRole
{
    User,
    Moderator,
    Admin,
}

public enum UserStatus
{
    Active,
    Blocked,
    Deleted,
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    // ux_users_email ON users (lower(email)) WHERE email IS NOT NULL is an expression index, which EF cannot model:
    // the migration AddCatalogueTables creates it with SQL.

    public void Configure(EntityTypeBuilder<User> user)
    {
        user.ToTable("users", t =>
        {
            t.HasCheckConstraint("ck_users_phone", @"phone ~ '^\+994[0-9]{9}$'");
            t.HasCheckConstraint("ck_users_email", "char_length(email) <= 254");
            t.HasCheckConstraint("ck_users_full_name", "char_length(full_name) BETWEEN 1 AND 60");
            t.HasCheckConstraint("ck_users_account_type", ColumnMapping.In<AccountType>("account_type"));
            t.HasCheckConstraint("ck_users_role", ColumnMapping.In<UserRole>("role"));
            t.HasCheckConstraint("ck_users_status", ColumnMapping.In<UserStatus>("status"));
            t.HasCheckConstraint("ck_users_locale", ColumnMapping.In<Language>("locale"));
            // A live account can always sign in: it has its verified phone and a password.
            t.HasCheckConstraint("ck_users_credentials", "status = 'deleted' OR (phone IS NOT NULL AND password_hash IS NOT NULL)");
        });

        user.Property(u => u.Id).ValueGeneratedNever();
        user.HasIndex(u => u.Phone).IsUnique().HasDatabaseName("ux_users_phone");
        user.Property(u => u.AccountType).IsKebabCase();
        // The sentinel is the value for which EF leaves the column out of an INSERT and the database default applies.
        // It is each enum's first member, which is also its database default, so either way the row gets the same value.
        user.Property(u => u.Role).IsKebabCase().HasDefaultValueSql("'user'").HasSentinel(UserRole.User);
        user.Property(u => u.Status).IsKebabCase().HasDefaultValueSql("'active'").HasSentinel(UserStatus.Active);
        user.Property(u => u.Locale).IsKebabCase().HasDefaultValueSql("'az'").HasSentinel(Language.Az);
        user.Property(u => u.FailedLogins).HasDefaultValue((short)0);
        user.Property(u => u.CreatedAt).HasDefaultValueSql("now()");
        user.Property(u => u.UpdatedAt).HasDefaultValueSql("now()");
    }
}
