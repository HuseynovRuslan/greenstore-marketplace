using System.Reflection;

namespace GreenStore.Api.Modules.Accounts.Auth;

/// <summary>
/// Who is calling: the account and the session the request's Bearer token belongs to, set by
/// <see cref="SessionAuthenticationHandler"/>. An endpoint that requires authorization takes it as a parameter
/// (<c>CurrentUser me</c>); minimal APIs bind it through <see cref="BindAsync"/>.
/// </summary>
public sealed record CurrentUser(Guid UserId, Guid SessionId, UserRole Role, AccountType AccountType)
{
    /// <summary>The caller of this request; null when it is anonymous.</summary>
    public static CurrentUser? Of(HttpContext context) => context.Features.Get<CurrentUser>();

    public static ValueTask<CurrentUser?> BindAsync(HttpContext context, ParameterInfo parameter) => ValueTask.FromResult(Of(context));
}
