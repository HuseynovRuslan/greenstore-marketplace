using System.Text.Json;
using GreenStore.Api.Common.Errors;
using GreenStore.Api.Data;
using GreenStore.Api.Modules.Accounts;
using GreenStore.Api.Modules.Accounts.Auth;
using GreenStore.Api.Modules.Listings;
using GreenStore.Api.Modules.Platform;
using GreenStore.Api.Modules.Sellers;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace GreenStore.Api.Modules.Admin;

/// <summary><c>POST /admin/sellers/{id}/verify</c>: <c>verifySeller(sellerId, verified)</c> of backend-contract.md 3.5.</summary>
public sealed record VerifySellerRequest(bool? Verified = null);

/// <summary><c>POST /admin/users/{id}/block</c>: <c>blockUser(userId, blocked)</c> of backend-contract.md 3.5, with the admin's reason.</summary>
public sealed record BlockUserRequest(bool? Blocked = null, string? Reason = null);

public sealed record SellerVerificationDto(string SellerId, bool Verified, DateTimeOffset? VerifiedAt);

/// <summary>
/// The account after <c>block</c>: its status, the sessions ended, the listings taken off the site by this block, and
/// those put back by an unblock.
/// </summary>
public sealed record BlockResultDto(string UserId, UserStatus Status, int SessionsRevoked, int ListingsHidden, int ListingsRestored);

/// <summary>What a <c>user.block</c> entry of <c>audit_log</c> holds: the unblock puts these listings back.</summary>
public sealed record BlockAuditData(string? Reason, IReadOnlyList<Guid> HiddenListingIds, int SessionsRevoked);

/// <summary>
/// «Təsdiqlənmiş satıcı» and blocking (ARCHITECTURE.md §7, backend-contract.md 3.5): admins only, each change written to
/// <c>audit_log</c>. A blocked account cannot sign in, its sessions end at once, and its active listings leave the site;
/// unblocking puts back the listings this block took down (an expired one comes back expired).
/// </summary>
public static class AdminAccountsEndpoints
{
    public const int MaxReasonLength = 500;

    public static RouteGroupBuilder MapAdminAccounts(this RouteGroupBuilder api)
    {
        api.MapPost("/admin/sellers/{id:guid}/verify", Verify).WithTags("Admin").RequireAuthorization(Access.AdminPolicy);
        api.MapPost("/admin/users/{id:guid}/block", Block).WithTags("Admin").RequireAuthorization(Access.AdminPolicy);
        return api;
    }

    /// <summary>
    /// <c>POST /admin/sellers/{id}/verify</c> <c>{ verified }</c> → <c>{ sellerId, verified, verifiedAt? }</c>. The
    /// seller page, the directory and the business's services show it at once. 400 <c>validation</c>
    /// (<c>verified: required</c>), 404 <c>seller.not-found</c>.
    /// </summary>
    private static async Task<Ok<SellerVerificationDto>> Verify(Guid id, VerifySellerRequest body, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        if (body.Verified is not { } verified)
        {
            throw ApiProblemException.Validation("verified", FieldErrors.Required);
        }

        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw ApiProblemException.NotFound(SellersEndpoints.SellerNotFound);
        var now = clock.GetUtcNow();
        if (verified != (seller.VerifiedAt is not null))
        {
            seller.VerifiedAt = verified ? now : null;
            seller.VerifiedBy = verified ? me.UserId : null;
            Audit.Add(db, me.UserId, verified ? "seller.verify" : "seller.unverify", "seller", seller.Id.ToString(), new { seller.Slug, seller.Name }, now);
            Revalidation.Enqueue(db, SellerTags(seller), now);
            await db.SaveChangesAsync(ct);
        }

        return TypedResults.Ok(new SellerVerificationDto(seller.Id.ToString(), seller.VerifiedAt is not null, seller.VerifiedAt));
    }

    /// <summary>
    /// <c>POST /admin/users/{id}/block</c> <c>{ blocked, reason? }</c> → <c>{ userId, status, sessionsRevoked,
    /// listingsHidden, listingsRestored }</c>. Blocking ends every session and takes the active listings off the site
    /// (<c>inactive</c>); its pending listings cannot be approved while it lasts. Unblocking puts back the listings the
    /// last block took down, if nobody changed them since. Asking for the status the account has changes nothing.
    /// 400 <c>validation</c>, 404 <c>account.not-found</c> (no such account, or a deleted one), 409
    /// <c>account.cannot-block-self</c>.
    /// </summary>
    private static async Task<Ok<BlockResultDto>> Block(Guid id, BlockUserRequest body, CurrentUser me, AppDbContext db, TimeProvider clock, CancellationToken ct)
    {
        var errors = new FieldErrors();
        var reason = string.IsNullOrWhiteSpace(body.Reason) ? null : body.Reason.Trim();
        errors.Add("blocked", body.Blocked is null ? FieldErrors.Required : null);
        errors.Add("reason", reason is { Length: > MaxReasonLength } ? FieldErrors.TooLong : null);
        errors.ThrowIfAny();
        var blocked = body.Blocked!.Value;

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.Status != UserStatus.Deleted, ct)
            ?? throw ApiProblemException.NotFound(AdminErrors.AccountNotFound);
        if (user.Id == me.UserId)
        {
            throw ApiProblemException.Conflict(AdminErrors.CannotBlockSelf);
        }

        var wanted = blocked ? UserStatus.Blocked : UserStatus.Active;
        if (user.Status == wanted)
        {
            return TypedResults.Ok(new BlockResultDto(user.Id.ToString(), user.Status, 0, 0, 0));
        }

        var now = clock.GetUtcNow();
        user.Status = wanted;
        var sellerSlug = await db.Sellers.Where(s => s.OwnerUserId == user.Id).Select(s => s.Slug).FirstOrDefaultAsync(ct);
        var tags = new List<string>();
        int revoked = 0, hidden = 0, restored = 0;
        if (blocked)
        {
            revoked = await db.Sessions
                .Where(s => s.UserId == user.Id && s.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, now), ct);
            var listings = await db.Listings
                .Where(l => l.OwnerUserId == user.Id && l.Status == ListingStatus.Active && l.DeletedAt == null)
                .OrderBy(l => l.Number)
                .ToListAsync(ct);
            foreach (var listing in listings)
            {
                ListingLifecycle.Apply(LifecycleState.Of(listing), ListingAction.Deactivate, now).ApplyTo(listing);
                tags.AddRange(Revalidation.TagsFor(listing, sellerSlug));
            }

            hidden = listings.Count;
            Audit.Add(db, me.UserId, "user.block", "user", user.Id.ToString(), new BlockAuditData(reason, listings.Select(l => l.Id).ToList(), revoked), now);
        }
        else
        {
            var lastBlock = await db.AuditLog.AsNoTracking()
                .Where(e => e.TargetType == "user" && e.TargetId == user.Id.ToString() && e.Action == "user.block")
                .OrderByDescending(e => e.CreatedAt).ThenByDescending(e => e.Id)
                .Select(e => e.Data)
                .FirstOrDefaultAsync(ct);
            IReadOnlyList<Guid> ids = lastBlock is null ? [] : JsonSerializer.Deserialize<BlockAuditData>(lastBlock, ColumnMapping.StorageJson)?.HiddenListingIds ?? [];
            var listings = await db.Listings
                .Where(l => ids.Contains(l.Id) && l.OwnerUserId == user.Id && l.Status == ListingStatus.Inactive && l.DeletedAt == null)
                .OrderBy(l => l.Number)
                .ToListAsync(ct);
            foreach (var listing in listings)
            {
                ListingLifecycle.Apply(LifecycleState.Of(listing), ListingAction.Activate, now).ApplyTo(listing);
                tags.AddRange(Revalidation.TagsFor(listing, sellerSlug));
            }

            restored = listings.Count;
            Audit.Add(db, me.UserId, "user.unblock", "user", user.Id.ToString(), new { Reason = reason, RestoredListingIds = listings.Select(l => l.Id).ToList() }, now);
        }

        if (sellerSlug is not null)
        {
            tags.AddRange(["sellers", $"seller:{sellerSlug}", Revalidation.Home]);
        }

        Revalidation.Enqueue(db, tags, now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new BlockResultDto(user.Id.ToString(), user.Status, revoked, hidden, restored));
    }

    /// <summary>What a seller's «Təsdiqlənmiş» badge shows on: its page, the directory, the home page and its services.</summary>
    private static IReadOnlyList<string> SellerTags(Seller seller) =>
        [$"seller:{seller.Id}", $"seller:{seller.Slug}", "sellers", Revalidation.Home, "services", $"provider:{seller.OwnerUserId}"];
}
