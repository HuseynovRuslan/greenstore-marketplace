using GreenStore.Api.Common.Errors;

namespace GreenStore.Api.Tests.Infrastructure;

/// <summary>Reads what a rule found wrong, field by field, without an HTTP round trip.</summary>
public static class FieldErrorsReader
{
    /// <summary>The first error code of each field, or none when the input is valid.</summary>
    internal static Dictionary<string, string> FirstErrors(FieldErrors errors)
    {
        try
        {
            errors.ThrowIfAny();
            return [];
        }
        catch (ApiProblemException problem)
        {
            return problem.Errors!.ToDictionary(e => e.Key, e => e.Value[0]);
        }
    }
}
