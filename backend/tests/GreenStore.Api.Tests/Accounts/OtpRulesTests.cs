using GreenStore.Api.Common.Security;
using GreenStore.Api.Modules.Accounts;

namespace GreenStore.Api.Tests.Accounts;

public sealed class OtpRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 12, 0, 0, TimeSpan.Zero);

    private static readonly OtpLimits Limits = new(TimeSpan.FromSeconds(60), PerPhoneHourly: 5, PerPhoneDaily: 10, PerIpHourly: 20, PerIpDaily: 100, GlobalDailyCap: 2000);

    private static DateTimeOffset[] Ago(params double[] minutes) => minutes.Select(m => Now.AddMinutes(-m)).ToArray();

    [Fact]
    public void A_first_code_is_sent() => Assert.Null(OtpRules.Check(Limits, [], [], 0, Now));

    [Fact]
    public void Another_code_to_the_same_number_waits_60_seconds()
    {
        var refusal = OtpRules.Check(Limits, Ago(0.25), [], 0, Now);

        Assert.Equal(OtpRules.TooSoon, refusal?.Code);
        Assert.Equal(TimeSpan.FromSeconds(45), refusal?.RetryAfter);
        Assert.Null(OtpRules.Check(Limits, Ago(1), [], 0, Now));
    }

    [Fact]
    public void A_number_gets_5_codes_an_hour()
    {
        Assert.Null(OtpRules.Check(Limits, Ago(2, 10, 20, 30), [], 0, Now));

        var refusal = OtpRules.Check(Limits, Ago(2, 10, 20, 30, 50), [], 0, Now);

        Assert.Equal(OtpRules.PhoneLimit, refusal?.Code);
        // The 5th newest (50 minutes ago) leaves the hour in 10 minutes.
        Assert.Equal(TimeSpan.FromMinutes(10), refusal?.RetryAfter);
    }

    [Fact]
    public void A_number_gets_10_codes_a_day()
    {
        var nine = Ago(70, 130, 190, 250, 310, 370, 430, 490, 550);
        Assert.Null(OtpRules.Check(Limits, nine, [], 0, Now));

        var refusal = OtpRules.Check(Limits, [.. nine, Now.AddHours(-23)], [], 0, Now);

        Assert.Equal(OtpRules.PhoneLimit, refusal?.Code);
        Assert.Equal(TimeSpan.FromHours(1), refusal?.RetryAfter);
    }

    [Fact]
    public void Codes_older_than_the_windows_do_not_count()
    {
        var old = Enumerable.Range(0, 30).Select(i => Now.AddHours(-25 - i)).ToArray();

        Assert.Null(OtpRules.Check(Limits, old, old, 0, Now));
    }

    [Fact]
    public void An_ip_gets_20_codes_an_hour_and_100_a_day()
    {
        var hour = Enumerable.Range(1, 20).Select(i => Now.AddMinutes(-i * 2)).ToArray();
        Assert.Equal(OtpRules.IpLimit, OtpRules.Check(Limits, [], hour, 0, Now)?.Code);
        Assert.Null(OtpRules.Check(Limits, [], hour[..19], 0, Now));

        var day = Enumerable.Range(1, 100).Select(i => Now.AddMinutes(-70 - i * 10)).ToArray();
        var refusal = OtpRules.Check(Limits, [], day, 0, Now);
        Assert.Equal(OtpRules.IpLimit, refusal?.Code);
        Assert.NotNull(refusal?.RetryAfter);
    }

    [Fact]
    public void The_platform_stops_at_its_daily_cap()
    {
        Assert.Null(OtpRules.Check(Limits, [], [], 1999, Now));

        var refusal = OtpRules.Check(Limits, [], [], 2000, Now);

        Assert.Equal(OtpRules.Unavailable, refusal?.Code);
        Assert.Null(refusal?.RetryAfter);
    }

    [Fact]
    public void The_number_is_checked_before_the_ip_and_the_cap()
    {
        var full = Enumerable.Range(1, 100).Select(i => Now.AddMinutes(-i)).ToArray();

        Assert.Equal(OtpRules.TooSoon, OtpRules.Check(Limits, Ago(0.1), full, 5000, Now)?.Code);
        Assert.Equal(OtpRules.IpLimit, OtpRules.Check(Limits, [], full, 5000, Now)?.Code);
    }

    [Fact]
    public void Codes_have_the_configured_digits_with_leading_zeros_kept()
    {
        var codes = Enumerable.Range(0, 2000).Select(_ => OtpRules.NewCode(4)).ToList();

        Assert.All(codes, c => Assert.Matches("^[0-9]{4}$", c));
        Assert.Contains(codes, c => c.StartsWith('0'));
        Assert.True(codes.Distinct().Count() > 1000);
        Assert.Matches("^[0-9]{6}$", OtpRules.NewCode(6));
    }

    [Theory]
    [InlineData("1234", true)]
    [InlineData(" 0427 ", true)]
    [InlineData("123", false)]
    [InlineData("12345", false)]
    [InlineData("12a4", false)]
    [InlineData("١٢٣٤", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void A_typed_code_is_digits_of_the_right_length(string? code, bool wellFormed) =>
        Assert.Equal(wellFormed, OtpRules.IsWellFormed(code, 4));

    [Fact]
    public void Codes_and_ips_are_hashed_with_the_server_key()
    {
        var hash = new ServerHash("key-one");
        var id = Guid.CreateVersion7();
        var stored = hash.OtpCode(id, "1234");

        Assert.Equal(32, stored.Length);
        Assert.True(hash.OtpCodeMatches(id, "1234", stored));
        Assert.False(hash.OtpCodeMatches(id, "1235", stored));
        // The same code differs per challenge and per key, so a leaked table cannot be read by trying 0000–9999.
        Assert.NotEqual(stored, hash.OtpCode(Guid.CreateVersion7(), "1234"));
        Assert.NotEqual(stored, new ServerHash("key-two").OtpCode(id, "1234"));
        Assert.False(new ServerHash("key-two").OtpCodeMatches(id, "1234", stored));

        var ip = hash.Ip(System.Net.IPAddress.Parse("203.0.113.7"));
        Assert.Equal(ip, hash.Ip(System.Net.IPAddress.Parse("203.0.113.7")));
        Assert.NotEqual(ip, hash.Ip(System.Net.IPAddress.Parse("203.0.113.8")));
        // An IPv6 /64 is one bucket.
        Assert.Equal(hash.Ip(System.Net.IPAddress.Parse("2001:db8::1")), hash.Ip(System.Net.IPAddress.Parse("2001:db8::ffff")));
        Assert.Throws<InvalidOperationException>(() => new ServerHash(string.Empty));
    }
}
