using GreenStore.Api.Common;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Accounts;

public sealed class AccountRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData("Bagban-2026", null)]
    [InlineData("şifrə123", null)]
    [InlineData("Пароль12", null)]
    [InlineData("", "required")]
    [InlineData(null, "required")]
    [InlineData("abc123", "too-short")]
    [InlineData("abcdefgh", "too-weak")]
    [InlineData("12345678", "too-weak")]
    [InlineData("--------", "too-weak")]
    public void A_new_password_has_8_characters_a_letter_and_a_digit(string? password, string? error) =>
        Assert.Equal(error, PasswordRules.Check(password));

    [Fact]
    public void A_password_has_at_most_128_characters()
    {
        Assert.Null(PasswordRules.Check("a1" + new string('x', 126)));
        Assert.Equal("too-long", PasswordRules.Check("a1" + new string('x', 127)));
    }

    [Fact]
    public void The_fifth_wrong_password_locks_the_account_for_15_minutes()
    {
        var user = new User { FullName = "Test" };
        for (var i = 0; i < 4; i++)
        {
            Assert.False(LoginLockout.RecordFailure(user, Now));
            Assert.Null(LoginLockout.LockedFor(user, Now));
        }

        Assert.True(LoginLockout.RecordFailure(user, Now));
        Assert.Equal(TimeSpan.FromMinutes(15), LoginLockout.LockedFor(user, Now));
        Assert.Equal(TimeSpan.FromMinutes(5), LoginLockout.LockedFor(user, Now.AddMinutes(10)));
        Assert.Null(LoginLockout.LockedFor(user, Now.AddMinutes(15)));
        // The count starts again after a lock.
        Assert.Equal(0, user.FailedLogins);
    }

    [Fact]
    public void A_right_password_clears_the_count_and_the_lock()
    {
        var user = new User { FullName = "Test", FailedLogins = 3, LockedUntil = Now.AddMinutes(5) };

        LoginLockout.RecordSuccess(user);

        Assert.Equal(0, user.FailedLogins);
        Assert.Null(LoginLockout.LockedFor(user, Now));
    }

    [Fact]
    public void Session_tokens_are_256_random_bits_in_base64url()
    {
        var tokens = Enumerable.Range(0, 200).Select(_ => SessionTokens.New()).ToList();

        Assert.All(tokens, t => Assert.Matches("^[A-Za-z0-9_-]{43}$", t));
        Assert.All(tokens, t => Assert.True(SessionTokens.IsWellFormed(t)));
        Assert.Equal(tokens.Count, tokens.Distinct().Count());
        Assert.Equal(32, SessionTokens.Hash(tokens[0]).Length);
        Assert.Equal(SessionTokens.Hash(tokens[0]), SessionTokens.Hash(tokens[0]));
        Assert.NotEqual(SessionTokens.Hash(tokens[0]), SessionTokens.Hash(tokens[1]));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+")]
    [InlineData("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")]
    public void Anything_else_is_not_a_session_token(string? token) => Assert.False(SessionTokens.IsWellFormed(token));

    [Fact]
    public void A_session_lasts_30_days_from_its_last_use_written_every_5_minutes()
    {
        Assert.Equal(Now.AddDays(30), SessionPolicy.ExpiresAt(Now));
        Assert.False(SessionPolicy.ShouldTouch(Now, Now.AddMinutes(4.9)));
        Assert.True(SessionPolicy.ShouldTouch(Now, Now.AddMinutes(5)));
        Assert.True(SessionPolicy.IsLive(Now.AddSeconds(1), null, Now));
        Assert.False(SessionPolicy.IsLive(Now, null, Now));
        Assert.False(SessionPolicy.IsLive(Now.AddDays(1), Now, Now));
    }

    [Fact]
    public void An_ip_with_too_many_wrong_passwords_waits_until_its_window_ends()
    {
        var clock = new ManualTimeProvider(Now);
        var throttle = new FailedLoginThrottle(clock, limit: 3, TimeSpan.FromMinutes(15));

        for (var i = 0; i < 3; i++)
        {
            Assert.Null(throttle.Blocked("203.0.113.7"));
            throttle.RecordFailure("203.0.113.7");
            clock.Advance(TimeSpan.FromMinutes(1));
        }

        Assert.Equal(TimeSpan.FromMinutes(12), throttle.Blocked("203.0.113.7"));
        Assert.Null(throttle.Blocked("203.0.113.8"));

        clock.Advance(TimeSpan.FromMinutes(12));
        Assert.Null(throttle.Blocked("203.0.113.7"));
        throttle.RecordFailure("203.0.113.7");
        Assert.Null(throttle.Blocked("203.0.113.7"));
    }

    [Theory]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", "Chrome, Windows")]
    [InlineData("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0", "Edge, Windows")]
    [InlineData("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1", "Safari, iPhone")]
    [InlineData("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36", "Samsung Internet, Android")]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:132.0) Gecko/20100101 Firefox/132.0", "Firefox, macOS")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/114.0.0.0", "Opera, Linux")]
    [InlineData("node", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void A_browser_user_agent_names_the_device(string? userAgent, string? name) =>
        Assert.Equal(name, DeviceNames.FromUserAgent(userAgent));

    [Fact]
    public void A_device_name_from_the_client_is_trimmed_and_cut()
    {
        Assert.Equal("iPhone 15", DeviceNames.Clean("  iPhone 15 "));
        Assert.Null(DeviceNames.Clean("   "));
        Assert.Equal(80, DeviceNames.Clean(new string('x', 200))!.Length);
    }

    [Theory]
    [InlineData("+994505551234", "+994505551234")]
    [InlineData("+994 50 555 12 34", "+994505551234")]
    [InlineData("994505551234", "+994505551234")]
    [InlineData("0505551234", "+994505551234")]
    [InlineData("(050) 555-12-34", "+994505551234")]
    [InlineData("505551234", "+994505551234")]
    [InlineData("+994124405060", "+994124405060")]
    [InlineData("50555123", null)]
    [InlineData("+9945055512345", null)]
    [InlineData("+7 916 555 12 34", null)]
    [InlineData("50 555 12 34 ext", null)]
    [InlineData("50+5551234", null)]
    [InlineData("000000000", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void Phone_numbers_are_read_in_any_common_shape(string? input, string? e164) =>
        Assert.Equal(e164, PhoneNumbers.Normalize(input));

    [Theory]
    [InlineData("+994505551234", true)]
    [InlineData("+994515551234", true)]
    [InlineData("+994555551234", true)]
    [InlineData("+994705551234", true)]
    [InlineData("+994775551234", true)]
    [InlineData("+994995551234", true)]
    [InlineData("+994105551234", true)]
    [InlineData("+994605551234", true)]
    [InlineData("+994124405060", false)]
    [InlineData("+994225551234", false)]
    [InlineData("+99450555123", false)]
    [InlineData(null, false)]
    public void Codes_go_to_mobile_numbers_only(string? phone, bool mobile) => Assert.Equal(mobile, PhoneNumbers.IsMobile(phone));

    [Theory]
    [InlineData(" info@bag.az ", "info@bag.az", null)]
    [InlineData("ad.soyad@poct.co.az", "ad.soyad@poct.co.az", null)]
    [InlineData("", null, null)]
    [InlineData("   ", null, null)]
    [InlineData(null, null, null)]
    [InlineData("info@bag", null, "invalid")]
    [InlineData("info bag@bag.az", null, "invalid")]
    [InlineData("@bag.az", null, "invalid")]
    public void Emails_are_checked_like_the_forms_check_them(string? input, string? value, string? error) =>
        Assert.Equal((value, error), EmailAddresses.Clean(input));

    [Fact]
    public void An_email_has_at_most_254_characters() =>
        Assert.Equal((null, "too-long"), EmailAddresses.Clean(new string('a', 250) + "@b.az"));

    [Fact]
    public void Only_the_owner_manages_what_is_theirs()
    {
        var owner = Guid.CreateVersion7();
        var me = new CurrentUser(owner, Guid.CreateVersion7(), UserRole.User, AccountType.Business);
        var admin = new CurrentUser(Guid.CreateVersion7(), Guid.CreateVersion7(), UserRole.Admin, AccountType.Individual);

        Assert.True(Access.CanManage(me, owner));
        Assert.False(Access.CanManage(me, Guid.CreateVersion7()));
        Assert.False(Access.CanManage(me, null));
        // /me data is the caller's own: an admin acts through the admin endpoints (phase 4), not as the owner.
        Assert.False(Access.CanManage(admin, owner));

        var error = Assert.Throws<GreenStore.Api.Common.Errors.ApiProblemException>(() => Access.EnsureCanManage(me, Guid.CreateVersion7(), "session.not-found"));
        Assert.Equal(404, error.Status);
        Assert.Equal("session.not-found", error.Code);
        Access.EnsureCanManage(me, owner, "session.not-found");
    }

    [Fact]
    public void Staff_roles_are_moderator_and_admin()
    {
        Assert.False(Access.IsStaff(UserRole.User));
        Assert.True(Access.IsStaff(UserRole.Moderator));
        Assert.True(Access.IsStaff(UserRole.Admin));
        Assert.False(Access.IsAdmin(UserRole.Moderator));
        Assert.True(Access.IsAdmin(UserRole.Admin));
        Assert.Equal(["register", "login", "reset-password", "change-phone"], KebabCase.Values<OtpPurpose>());
        Assert.Equal(["web", "ios", "android"], KebabCase.Values<SessionClient>());
    }
}
