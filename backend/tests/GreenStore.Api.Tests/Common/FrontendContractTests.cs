using System.Text.Json;
using GreenStore.Api.Tests.Infrastructure;

namespace GreenStore.Api.Tests.Common;

/// <summary>The contract checker itself: it must find each kind of difference, or the contract tests prove nothing.</summary>
public sealed class FrontendContractTests
{
    private static readonly FrontendContract Contract = FrontendContract.Load();

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }

    [Fact]
    public void A_city_that_fits_has_no_problems() =>
        Assert.Empty(Contract.Check(Parse("""{"id":"baki","name":"Bakı"}"""), "City"));

    [Theory]
    [InlineData("""{"id":"baki"}""", "required City.name is missing")]
    [InlineData("""{"id":"baki","name":"Bakı","population":2300000}""", "City has no property \"population\"")]
    [InlineData("""{"id":"baki","name":7}""", "expected string")]
    [InlineData("""{"id":"baki","name":null}""", "null")]
    public void It_finds_a_missing_an_unknown_and_a_mistyped_property(string json, string problem) =>
        Assert.Contains(Contract.Check(Parse(json), "City"), p => p.Contains(problem, StringComparison.Ordinal));

    [Fact]
    public void It_checks_enum_strings_against_their_union()
    {
        var problems = Contract.Check(Parse("""{"rootSystem":"BareRoot","heightCm":{"min":100,"max":"200"}}"""), "PlantFacts");

        Assert.Contains(problems, p => p.Contains("\"BareRoot\" is not a RootSystem", StringComparison.Ordinal));
        Assert.Contains(problems, p => p.StartsWith("$.heightCm.max: expected number", StringComparison.Ordinal));
        Assert.Empty(Contract.Check(Parse("""{"rootSystem":"bare-root","heightCm":{"min":100}}"""), "PlantFacts"));
    }

    [Fact]
    public void It_refuses_withheld_phone_numbers_and_accepts_the_approved_additions()
    {
        var seller = Contract.Interfaces["Seller"].Where(p => !p.Value.Optional).ToDictionary(p => p.Key, p => p.Value.Type);
        var required = string.Join(",", seller.Select(p => $"\"{p.Key}\":{Sample(p.Value)}"));

        Assert.Empty(Contract.Check(Parse($$"""{{{required}},"phoneMasked":"+994 50 *** ** 34"}"""), "Seller"));
        Assert.Contains(
            Contract.Check(Parse($$"""{{{required}},"phone":"+994505551234"}"""), "Seller"),
            p => p.Contains("must not send Seller.phone", StringComparison.Ordinal));
    }

    [Fact]
    public void Dates_must_be_utc()
    {
        var problems = Contract.Check(Parse("""{"slug":"a-1","updatedAt":"2026-10-28T10:15:00+04:00"}"""), "{ slug: string; updatedAt: string }");

        Assert.Contains(problems, p => p.Contains("is not an ISO 8601 UTC date", StringComparison.Ordinal));
        Assert.Empty(Contract.Check(Parse("""{"slug":"a-1","updatedAt":"2026-10-28T06:15:00Z"}"""), "{ slug: string; updatedAt: string }"));
    }

    [Fact]
    public void Pages_and_literal_unions_are_understood()
    {
        Assert.Empty(Contract.CheckPage(Parse("""{"items":[{"id":"baki","name":"Bakı"}],"total":1,"page":1,"pageCount":1}"""), "City"));
        Assert.Contains(
            Contract.CheckPage(Parse("""{"items":[{"id":"baki"}],"total":1,"page":1}"""), "City"),
            p => p.Contains("required PageResult.pageCount is missing", StringComparison.Ordinal));
        Assert.Contains(Contract.Check(Parse("""{"day":8,"closed":true}"""), "OpeningHours"), p => p.Contains("is not one of", StringComparison.Ordinal));
    }

    private static string Sample(string type) => type switch
    {
        "string" => "\"x\"",
        "number" => "1",
        "boolean" => "true",
        "SellerType" => "\"business\"",
        _ => throw new InvalidOperationException($"No sample for {type}"),
    };
}
