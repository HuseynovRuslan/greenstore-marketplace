using System.Globalization;
using System.Security.Cryptography;

namespace GreenStore.Api.Modules.Accounts;

/// <summary>The limits a new SMS code must pass (<see cref="Common.OtpOptions"/>, ARCHITECTURE.md §14).</summary>
public sealed record OtpLimits(
    TimeSpan Resend,
    int PerPhoneHourly,
    int PerPhoneDaily,
    int PerIpHourly,
    int PerIpDaily,
    int GlobalDailyCap);

/// <summary>Why a code is not sent, and when asking again can succeed (null: not known).</summary>
public sealed record OtpRefusal(string Code, TimeSpan? RetryAfter);

/// <summary>
/// Whether another SMS code may be sent: the rules against SMS fraud (a bot asking codes for many numbers to burn the
/// SMS budget) and against flooding one person's phone. Plain rules, no database: the caller passes the times of the
/// codes sent in the last 24 hours. Windows are rolling (the last hour, the last 24 hours), not calendar days.
/// </summary>
public static class OtpRules
{
    public const string TooSoon = "otp.too-soon";
    public const string PhoneLimit = "otp.phone-limit";
    public const string IpLimit = "otp.ip-limit";
    public const string Unavailable = "otp.unavailable";

    public static readonly TimeSpan Hour = TimeSpan.FromHours(1);
    public static readonly TimeSpan Day = TimeSpan.FromDays(1);

    /// <summary>
    /// Null when the code may be sent. Checked in this order: the resend wait for the number, its hourly and daily
    /// limits, the client IP's hourly and daily limits, the platform's daily cap.
    /// </summary>
    /// <param name="phoneTimes">When codes were sent to this number in the last 24 hours (any purpose).</param>
    /// <param name="ipTimes">When codes were asked from this client IP in the last 24 hours.</param>
    /// <param name="globalLastDay">Codes of the whole platform in the last 24 hours.</param>
    public static OtpRefusal? Check(
        OtpLimits limits,
        IReadOnlyCollection<DateTimeOffset> phoneTimes,
        IReadOnlyCollection<DateTimeOffset> ipTimes,
        int globalLastDay,
        DateTimeOffset now)
    {
        if (phoneTimes.Count > 0 && phoneTimes.Max() + limits.Resend > now)
        {
            return new OtpRefusal(TooSoon, phoneTimes.Max() + limits.Resend - now);
        }

        if (WindowFull(phoneTimes, limits.PerPhoneHourly, Hour, now) is { } phoneHour)
        {
            return new OtpRefusal(PhoneLimit, phoneHour);
        }

        if (WindowFull(phoneTimes, limits.PerPhoneDaily, Day, now) is { } phoneDay)
        {
            return new OtpRefusal(PhoneLimit, phoneDay);
        }

        if (WindowFull(ipTimes, limits.PerIpHourly, Hour, now) is { } ipHour)
        {
            return new OtpRefusal(IpLimit, ipHour);
        }

        if (WindowFull(ipTimes, limits.PerIpDaily, Day, now) is { } ipDay)
        {
            return new OtpRefusal(IpLimit, ipDay);
        }

        return globalLastDay >= limits.GlobalDailyCap ? new OtpRefusal(Unavailable, null) : null;
    }

    /// <summary>
    /// When the window already holds <paramref name="limit"/> codes: how long until the oldest of the newest
    /// <paramref name="limit"/> leaves it (then one more fits). Null while there is room.
    /// </summary>
    public static TimeSpan? WindowFull(IReadOnlyCollection<DateTimeOffset> times, int limit, TimeSpan window, DateTimeOffset now)
    {
        var inWindow = times.Where(t => t > now - window).OrderByDescending(t => t).ToList();
        if (inWindow.Count < limit)
        {
            return null;
        }

        return inWindow[limit - 1] + window - now;
    }

    /// <summary>A random code of <paramref name="length"/> digits, leading zeros kept ("0427").</summary>
    public static string NewCode(int length)
    {
        var max = (int)Math.Pow(10, length);
        return RandomNumberGenerator.GetInt32(0, max).ToString(new string('0', length), CultureInfo.InvariantCulture);
    }

    /// <summary>A code as the user may type it: <paramref name="length"/> ASCII digits, spaces around ignored.</summary>
    public static bool IsWellFormed(string? code, int length) =>
        code?.Trim() is { } trimmed && trimmed.Length == length && trimmed.All(char.IsAsciiDigit);
}
