using System.Runtime.CompilerServices;

namespace GreenStore.Api.Common.Json;

/// <summary>
/// A PATCH body that knows which properties the JSON had: the serializer calls a setter only for a property present
/// in the body (even as <c>null</c>), so "not sent" (unchanged) and <c>null</c> (cleared) can be told apart. Each
/// property's setter is <c>set => field = Sent(value);</c>.
/// </summary>
public abstract class PatchBody
{
    private readonly HashSet<string> sent = new(StringComparer.Ordinal);

    /// <summary>True when the body had the property (by its C# name: <c>nameof(MePatch.Email)</c>).</summary>
    public bool Has(string property) => sent.Contains(property);

    protected T Sent<T>(T value, [CallerMemberName] string property = "")
    {
        sent.Add(property);
        return value;
    }
}
