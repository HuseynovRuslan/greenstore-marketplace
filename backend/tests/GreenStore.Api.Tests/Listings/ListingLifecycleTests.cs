using GreenStore.Api.Modules.Listings;

namespace GreenStore.Api.Tests.Listings;

/// <summary>Every allowed and every forbidden transition of ARCHITECTURE.md §6, and what each one writes.</summary>
public sealed class ListingLifecycleTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Published = Now.AddDays(-20);

    /// <summary>The whole table: status × action → allowed?</summary>
    public static TheoryData<ListingStatus, ListingAction, bool> Table()
    {
        var allowed = new HashSet<(ListingStatus, ListingAction)>
        {
            (ListingStatus.Pending, ListingAction.Edit),
            (ListingStatus.Pending, ListingAction.Approve),
            (ListingStatus.Pending, ListingAction.Reject),
            (ListingStatus.Pending, ListingAction.Delete),
            (ListingStatus.Active, ListingAction.Edit),
            (ListingStatus.Active, ListingAction.Expire),
            (ListingStatus.Active, ListingAction.Deactivate),
            (ListingStatus.Active, ListingAction.Delete),
            (ListingStatus.Rejected, ListingAction.Edit),
            (ListingStatus.Rejected, ListingAction.Delete),
            (ListingStatus.Expired, ListingAction.Edit),
            (ListingStatus.Expired, ListingAction.Renew),
            (ListingStatus.Expired, ListingAction.Delete),
            (ListingStatus.Inactive, ListingAction.Edit),
            (ListingStatus.Inactive, ListingAction.Activate),
            (ListingStatus.Inactive, ListingAction.Delete),
        };
        var data = new TheoryData<ListingStatus, ListingAction, bool>();
        foreach (var status in Enum.GetValues<ListingStatus>())
        {
            foreach (var action in Enum.GetValues<ListingAction>())
            {
                data.Add(status, action, allowed.Contains((status, action)));
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Table))]
    public void Allows_exactly_the_transitions_of_the_design(ListingStatus status, ListingAction action, bool allowed)
    {
        Assert.Equal(allowed, ListingLifecycle.Allows(status, action));
        // Expiry also needs the term to be over (tested on its own below).
        var state = action == ListingAction.Expire ? StateOf(status) with { ExpiresAt = Now.AddMinutes(-1) } : StateOf(status);
        if (allowed)
        {
            var next = ListingLifecycle.Apply(state, action, Now, RejectionReason.WrongPrice);
            Assert.NotNull(next);
        }
        else
        {
            var refused = Assert.Throws<ListingTransitionException>(() => ListingLifecycle.Apply(state, action, Now, RejectionReason.WrongPrice));
            Assert.Equal(status, refused.Status);
            Assert.Equal(action, refused.Action);
        }
    }

    [Theory]
    [MemberData(nameof(Table))]
    public void A_deleted_listing_allows_nothing(ListingStatus status, ListingAction action, bool allowed)
    {
        _ = allowed;
        var deleted = StateOf(status) with { DeletedAt = Now.AddDays(-1) };
        Assert.Throws<ListingTransitionException>(() => ListingLifecycle.Apply(deleted, action, Now, RejectionReason.Other));
    }

    [Fact]
    public void A_new_listing_waits_for_the_moderator()
    {
        var state = ListingLifecycle.Submit(Now);

        Assert.Equal(ListingStatus.Pending, state.Status);
        Assert.Equal(Now, state.SubmittedAt);
        Assert.Null(state.PublishedAt);
        Assert.Null(state.ExpiresAt);
    }

    [Fact]
    public void The_first_approval_publishes_it_at_the_top_for_30_days()
    {
        var next = ListingLifecycle.Apply(ListingLifecycle.Submit(Now.AddHours(-2)), ListingAction.Approve, Now);

        Assert.Equal(ListingStatus.Active, next.Status);
        Assert.Equal(Now, next.PublishedAt);
        Assert.Equal(Now, next.SortAt);
        Assert.Equal(Now.AddDays(30), next.ExpiresAt);
    }

    [Fact]
    public void Approving_an_edit_keeps_the_place_in_the_feed_and_gives_a_new_term()
    {
        var edited = ListingLifecycle.Apply(StateOf(ListingStatus.Active), ListingAction.Edit, Now.AddHours(-1));
        var next = ListingLifecycle.Apply(edited, ListingAction.Approve, Now);

        Assert.Equal(Published, next.PublishedAt);
        Assert.Equal(Published, next.SortAt);
        Assert.Equal(Now.AddDays(30), next.ExpiresAt);
    }

    [Fact]
    public void Editing_an_active_listing_hides_it_until_approved()
    {
        var next = ListingLifecycle.Apply(StateOf(ListingStatus.Active), ListingAction.Edit, Now);

        Assert.Equal(ListingStatus.Pending, next.Status);
        Assert.Equal(Now, next.SubmittedAt);
        Assert.Equal(Now, next.EditedAt);
        Assert.Equal(Published, next.PublishedAt);
    }

    [Fact]
    public void Fixing_a_rejected_listing_clears_the_reason()
    {
        var rejected = ListingLifecycle.Apply(ListingLifecycle.Submit(Now.AddDays(-1)), ListingAction.Reject, Now.AddHours(-3), RejectionReason.BadPhotos, "  Şəkillər bulanıqdır  ");
        Assert.Equal(ListingStatus.Rejected, rejected.Status);
        Assert.Equal(RejectionReason.BadPhotos, rejected.RejectionReasonCode);
        Assert.Equal("Şəkillər bulanıqdır", rejected.RejectionNote);

        var fixedUp = ListingLifecycle.Apply(rejected, ListingAction.Edit, Now);
        Assert.Equal(ListingStatus.Pending, fixedUp.Status);
        Assert.Null(fixedUp.RejectionReasonCode);
        Assert.Null(fixedUp.RejectionNote);
    }

    [Fact]
    public void A_rejection_needs_a_reason() =>
        Assert.Throws<ArgumentNullException>(() => ListingLifecycle.Apply(ListingLifecycle.Submit(Now), ListingAction.Reject, Now));

    [Fact]
    public void Renewing_is_free_and_does_not_lift_the_listing()
    {
        var expired = StateOf(ListingStatus.Expired) with { ExpiresAt = Now.AddDays(-2), SortAt = Published };
        var next = ListingLifecycle.Apply(expired, ListingAction.Renew, Now);

        Assert.Equal(ListingStatus.Active, next.Status);
        Assert.Equal(Now.AddDays(30), next.ExpiresAt);
        Assert.Equal(Published, next.SortAt);
        Assert.Equal(Now, next.EditedAt);
    }

    [Fact]
    public void A_term_never_ends_before_a_paid_promotion()
    {
        var until = Now.AddDays(45);
        Assert.Equal(until, ListingLifecycle.ExpiryFrom(Now, until));
        Assert.Equal(Now.AddDays(30), ListingLifecycle.ExpiryFrom(Now, Now.AddDays(10)));
        Assert.Equal(Now.AddDays(30), ListingLifecycle.ExpiryFrom(Now, null));

        var approved = ListingLifecycle.Apply(ListingLifecycle.Submit(Now) with { PromotedUntil = until }, ListingAction.Approve, Now);
        Assert.Equal(until, approved.ExpiresAt);
    }

    [Fact]
    public void An_approval_never_shortens_a_running_term()
    {
        // A paid «İrəli çək» lengthened the term to 38 days; an edit approved on day 5 keeps it.
        var lengthened = StateOf(ListingStatus.Active) with { ExpiresAt = Now.AddDays(33) };
        var edited = ListingLifecycle.Apply(lengthened, ListingAction.Edit, Now.AddHours(-1));

        Assert.Equal(Now.AddDays(33), ListingLifecycle.Apply(edited, ListingAction.Approve, Now).ExpiresAt);
    }

    [Fact]
    public void Expiry_happens_only_once_the_term_is_over()
    {
        var active = StateOf(ListingStatus.Active) with { ExpiresAt = Now.AddMinutes(1) };
        Assert.Throws<ListingTransitionException>(() => ListingLifecycle.Apply(active, ListingAction.Expire, Now));

        var due = active with { ExpiresAt = Now };
        Assert.Equal(ListingStatus.Expired, ListingLifecycle.Apply(due, ListingAction.Expire, Now).Status);
    }

    [Fact]
    public void Deactivating_and_activating_keep_the_term()
    {
        var active = StateOf(ListingStatus.Active) with { ExpiresAt = Now.AddDays(5) };
        var off = ListingLifecycle.Apply(active, ListingAction.Deactivate, Now);
        Assert.Equal(ListingStatus.Inactive, off.Status);
        Assert.Equal(Now.AddDays(5), off.ExpiresAt);

        var on = ListingLifecycle.Apply(off, ListingAction.Activate, Now.AddDays(1));
        Assert.Equal(ListingStatus.Active, on.Status);
        Assert.Equal(Now.AddDays(5), on.ExpiresAt);
    }

    [Fact]
    public void Activating_after_the_term_ended_comes_back_as_expired()
    {
        var off = StateOf(ListingStatus.Inactive) with { ExpiresAt = Now.AddDays(-1) };

        Assert.Equal(ListingStatus.Expired, ListingLifecycle.Apply(off, ListingAction.Activate, Now).Status);
    }

    [Fact]
    public void Deleting_keeps_the_row_and_its_status()
    {
        var next = ListingLifecycle.Apply(StateOf(ListingStatus.Active), ListingAction.Delete, Now);

        Assert.Equal(Now, next.DeletedAt);
        Assert.True(next.IsDeleted);
        Assert.Equal(ListingStatus.Active, next.Status);
    }

    [Fact]
    public void The_category_is_locked_once_published()
    {
        Assert.False(ListingLifecycle.CategoryLocked(ListingLifecycle.Submit(Now)));
        Assert.True(ListingLifecycle.CategoryLocked(StateOf(ListingStatus.Active)));
        Assert.True(ListingLifecycle.CategoryLocked(StateOf(ListingStatus.Expired)));
        // A published listing that went back to the moderator after an edit stays locked.
        Assert.True(ListingLifecycle.CategoryLocked(ListingLifecycle.Apply(StateOf(ListingStatus.Active), ListingAction.Edit, Now)));
    }

    [Fact]
    public void The_state_round_trips_through_the_entity()
    {
        var listing = TestListing();
        var state = new LifecycleState
        {
            Status = ListingStatus.Rejected,
            SubmittedAt = Now,
            EditedAt = Now,
            PublishedAt = Published,
            BumpedAt = Now.AddDays(-1),
            SortAt = Now.AddDays(-1),
            ExpiresAt = Now.AddDays(3),
            RejectionReasonCode = RejectionReason.Duplicate,
            RejectionNote = "Təkrar",
        };

        state.ApplyTo(listing);

        Assert.Equal(state, LifecycleState.Of(listing));
    }

    /// <summary>A listing in the status, as it would be stored: published ones have their dates.</summary>
    private static LifecycleState StateOf(ListingStatus status) => status switch
    {
        ListingStatus.Pending => ListingLifecycle.Submit(Now.AddHours(-1)),
        ListingStatus.Rejected => ListingLifecycle.Submit(Now.AddHours(-1)) with { Status = ListingStatus.Rejected, RejectionReasonCode = RejectionReason.Other },
        _ => new LifecycleState
        {
            Status = status,
            SubmittedAt = Published,
            PublishedAt = Published,
            SortAt = Published,
            ExpiresAt = status == ListingStatus.Expired ? Now.AddDays(-1) : Now.AddDays(10),
        },
    };

    private static Listing TestListing() => new()
    {
        Slug = "x-1",
        CategoryId = "agaclar",
        Title = "Test elan",
        CityId = "baki",
        ContactName = "Test",
        ContactPhone = "+994501112233",
    };
}
