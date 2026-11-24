using System.Reflection;
using System.Text.Json;
using GreenStore.Api.Common;
using GreenStore.Api.Modules.Engagement;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Engagement;

/// <summary>The request bodies of the public forms take exactly the fields of the frontend's input types.</summary>
public sealed class EngagementContractTests
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    [Theory]
    [InlineData(typeof(ReportInputDto), "ReportInput")]
    [InlineData(typeof(SupportMessageInputDto), "SupportMessageInput")]
    public void A_form_body_has_the_fields_of_its_input_type(Type dto, string type) =>
        Assert.Equal(
            Contract.Interfaces[type].Keys.Order(StringComparer.Ordinal),
            dto.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(p => JsonNamingPolicy.CamelCase.ConvertName(p.Name)).Order(StringComparer.Ordinal));

    [Fact]
    public void The_support_topics_and_report_targets_are_the_frontends_unions()
    {
        Assert.Equal(
            Contract.Interfaces["SupportMessageInput"]["topic"].Type.Split('|', StringSplitOptions.TrimEntries).Select(v => v.Trim('\'')),
            KebabCase.Values<SupportTopic>());
        Assert.Equal(Contract.Unions["ReportTarget"], KebabCase.Values<ReportTarget>());
    }
}
