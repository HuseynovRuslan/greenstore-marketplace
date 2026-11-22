using System.Net;
using System.Threading.RateLimiting;
using GreenStore.Api.Common.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace GreenStore.Api.Tests.Common;

public sealed class RateLimitingTests
{
    private static readonly IServiceProvider Services = new ServiceCollection()
        .Configure<RateLimitingOptions>(o => o.AnonymousWrites = new FixedWindowLimit { PermitLimit = 2, WindowSeconds = 60 })
        .BuildServiceProvider();

    private static HttpContext Request(string ip)
    {
        var context = new DefaultHttpContext { RequestServices = Services };
        context.Features.Set(new ClientIpFeature(IPAddress.Parse(ip), false));
        return context;
    }

    [Fact]
    public void Anonymous_writes_are_limited_per_client_ip()
    {
        using var limiter = PartitionedRateLimiter.Create<HttpContext, string>(RateLimitPolicies.AnonymousWritesPartition);

        Assert.True(limiter.AttemptAcquire(Request("203.0.113.7")).IsAcquired);
        Assert.True(limiter.AttemptAcquire(Request("203.0.113.7")).IsAcquired);
        Assert.False(limiter.AttemptAcquire(Request("203.0.113.7")).IsAcquired);

        Assert.True(limiter.AttemptAcquire(Request("203.0.113.8")).IsAcquired);
    }

    [Fact]
    public void Ipv6_addresses_of_one_64_network_share_a_limit()
    {
        using var limiter = PartitionedRateLimiter.Create<HttpContext, string>(RateLimitPolicies.AnonymousWritesPartition);

        Assert.True(limiter.AttemptAcquire(Request("2001:db8:1:2::1")).IsAcquired);
        Assert.True(limiter.AttemptAcquire(Request("2001:db8:1:2::2")).IsAcquired);
        Assert.False(limiter.AttemptAcquire(Request("2001:db8:1:2::3")).IsAcquired);
        Assert.True(limiter.AttemptAcquire(Request("2001:db8:1:3::1")).IsAcquired);
    }
}
