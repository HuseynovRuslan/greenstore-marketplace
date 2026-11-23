using System.Net;
using GreenStore.Api.Common.Http;

namespace GreenStore.Api.Tests.Common;

public sealed class ClientIpResolverTests
{
    private const string Key = "s3cret-key";
    private static readonly IPAddress Connection = IPAddress.Parse("10.0.0.5");

    [Fact]
    public void Trusts_X_Client_IP_with_the_right_internal_key()
    {
        var client = ClientIpResolver.Resolve(Connection, "203.0.113.7", Key, Key);
        Assert.Equal(IPAddress.Parse("203.0.113.7"), client.Address);
        Assert.True(client.IsInternal);
    }

    [Theory]
    [InlineData("wrong-key")]
    [InlineData("s3cret-ke")]
    [InlineData("")]
    [InlineData(null)]
    public void Ignores_X_Client_IP_without_the_right_key(string? providedKey)
    {
        var client = ClientIpResolver.Resolve(Connection, "203.0.113.7", providedKey, Key);
        Assert.Equal(Connection, client.Address);
        Assert.False(client.IsInternal);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Trusts_nobody_when_no_key_is_configured(string? configuredKey)
    {
        var client = ClientIpResolver.Resolve(Connection, "203.0.113.7", configuredKey, configuredKey);
        Assert.Equal(Connection, client.Address);
        Assert.False(client.IsInternal);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-ip")]
    [InlineData("203.0.113.7, 198.51.100.1")]
    public void Falls_back_to_the_connection_when_the_forwarded_ip_is_unusable(string? header)
    {
        var client = ClientIpResolver.Resolve(Connection, header, Key, Key);
        Assert.Equal(Connection, client.Address);
        Assert.True(client.IsInternal);
    }

    [Fact]
    public void Ipv4_mapped_addresses_become_ipv4()
    {
        Assert.Equal(IPAddress.Parse("203.0.113.7"), ClientIpResolver.Resolve(Connection, " ::ffff:203.0.113.7 ", Key, Key).Address);
        Assert.Equal(IPAddress.Parse("10.0.0.5"), ClientIpResolver.Resolve(IPAddress.Parse("::ffff:10.0.0.5"), null, null, Key).Address);
    }

    [Fact]
    public void A_missing_connection_ip_stays_unknown() =>
        Assert.Null(ClientIpResolver.Resolve(null, null, null, Key).Address);

    [Theory]
    [InlineData("203.0.113.7", "203.0.113.7")]
    [InlineData("2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2:ffff::1", "2001:db8:1:2::/64")]
    public void Partition_keys_group_ipv6_by_64_network(string address, string expected) =>
        Assert.Equal(expected, ClientIpResolver.PartitionKey(IPAddress.Parse(address)));

    [Fact]
    public void Partition_key_of_an_unknown_address() => Assert.Equal("unknown", ClientIpResolver.PartitionKey(null));
}
