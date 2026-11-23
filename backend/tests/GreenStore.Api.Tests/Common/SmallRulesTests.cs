using GreenStore.Api.Common;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Tests.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting.Internal;

namespace GreenStore.Api.Tests.Common;

public sealed class IdsTests
{
    [Fact]
    public void New_ids_are_uuid_v7_from_the_clock_and_grow_with_time()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 11, 22, 8, 0, 0, TimeSpan.Zero));
        var first = Ids.New(clock);
        clock.Advance(TimeSpan.FromMilliseconds(5));
        var second = Ids.New(clock);

        Assert.Equal(7, first.Version);
        Assert.True(first.CompareTo(second) < 0);
        // The first 48 bits are the Unix time in milliseconds.
        var millis = Convert.ToInt64(first.ToString("N")[..12], 16);
        Assert.Equal(clock.Now.AddMilliseconds(-5).ToUnixTimeMilliseconds(), millis);
    }
}

public sealed class RowVersionTests
{
    [Fact]
    public void Tokens_are_decimal_strings()
    {
        Assert.Equal("7342", RowVersion.Format(7342));
        Assert.True(RowVersion.TryParse("7342", out var version));
        Assert.Equal(7342u, version);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("-1")]
    [InlineData(" 12")]
    [InlineData("12.0")]
    [InlineData("4294967296")]
    public void Malformed_tokens_do_not_parse(string? token) => Assert.False(RowVersion.TryParse(token, out _));
}

public sealed class ErrorCodesTests
{
    [Theory]
    [InlineData(400, "bad-request")]
    [InlineData(401, "unauthorized")]
    [InlineData(403, "forbidden")]
    [InlineData(404, "not-found")]
    [InlineData(405, "method-not-allowed")]
    [InlineData(409, "conflict")]
    [InlineData(413, "payload-too-large")]
    [InlineData(415, "unsupported-media-type")]
    [InlineData(422, "validation")]
    [InlineData(429, "rate-limited")]
    [InlineData(500, "internal-error")]
    [InlineData(503, "unavailable")]
    [InlineData(418, "error")]
    public void Every_status_has_a_generic_code(int status, string code) => Assert.Equal(code, ErrorCodes.ForStatus(status));
}

public sealed class MigrationPolicyTests
{
    [Theory]
    [InlineData("Development", "true", true)]
    [InlineData("Development", "false", false)]
    [InlineData("Development", null, false)]
    [InlineData("Staging", "true", false)]
    [InlineData("Production", "true", false)]
    [InlineData("Testing", "true", false)]
    public void Migrates_on_startup_only_in_development_when_configured(string environment, string? setting, bool expected)
    {
        var env = new HostingEnvironment { EnvironmentName = environment };
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Database:MigrateOnStartup"] = setting })
            .Build();
        Assert.Equal(expected, MigrationRunner.ShouldMigrateOnStartup(env, configuration));
    }

    [Fact]
    public void The_command_is_migrate() => Assert.Equal("migrate", MigrationRunner.Command);
}

public sealed class OtpOptionsTests
{
    [Fact]
    public void Defaults_follow_the_architecture()
    {
        var otp = new OtpOptions();
        Assert.Equal(4, otp.CodeLength);
        Assert.Equal(300, otp.LifetimeSeconds);
        Assert.Equal(60, otp.ResendSeconds);
        Assert.Equal(5, otp.MaxAttempts);
        Assert.False(otp.ExposeDemoCode);
    }
}
