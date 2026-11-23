using GreenStore.Api.Common.Security;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Accounts.Sms;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>Sign-in settings (section "Auth").</summary>
public sealed class AuthOptions
{
    public const string Section = "Auth";

    /// <summary>Wrong passwords from one client IP (IPv6: /64) within the window before it must wait (<see cref="FailedLoginThrottle"/>).</summary>
    public int FailedLoginsPerIp { get; set; } = 30;

    public int FailedLoginsWindowMinutes { get; set; } = 15;
}

public static class AccountsSetup
{
    public static IServiceCollection AddAccounts(this IServiceCollection services)
    {
        services.AddOptions<AuthOptions>()
            .BindConfiguration(AuthOptions.Section)
            .Validate(o => o.FailedLoginsPerIp > 0 && o.FailedLoginsWindowMinutes > 0, "Auth limits must be positive.")
            .ValidateOnStart();

        services.AddSingleton<ServerHash>();
        // ASP.NET Core Identity's hasher only (ARCHITECTURE.md §3): PBKDF2 with HMAC-SHA512, 100 000 iterations, salted.
        services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddSingleton(sp =>
        {
            var auth = sp.GetRequiredService<IOptions<AuthOptions>>().Value;
            return new FailedLoginThrottle(sp.GetRequiredService<TimeProvider>(), auth.FailedLoginsPerIp, TimeSpan.FromMinutes(auth.FailedLoginsWindowMinutes));
        });
        services.AddScoped<OtpService>();
        services.AddScoped<SessionService>();
        services.AddScoped<AccountService>();
        services.AddScoped<AccountsCleanup>();
        services.AddSms();
        services.AddSessionAuthentication();
        return services;
    }
}
