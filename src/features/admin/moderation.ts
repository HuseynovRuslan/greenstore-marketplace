import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { listingById } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import {
  moderationQueue,
  moderationTotals,
  type ModerationItem,
  type ModerationKind,
  type ModerationReview,
  type ModerationStatus,
} from '@/data/admin'
import type { Listing } from '@/types'

/** Decision taken in this session for a queue entry. */
export interface ModerationDecision {
  status: ModerationStatus
  reason?: string
  explanation?: string
}

export interface QueueEntry {
  key: string
  number?: number
  title: string
  sellerName: string
  submittedAt: string
  categoryId: string
  kind: ModerationKind
  status: ModerationStatus
  review: ModerationReview
  /** Listings created through "Elan yerləşdir" that must follow the decision (`updateListing`) */
  submittedIds: string[]
  decision?: ModerationDecision
}

const listingStatusToModeration = (status: Listing['status']): ModerationStatus | undefined =>
  status === 'pending' ? 'pending' : status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : undefined

/** Review panel content derived from listing data (used when Figma has no dedicated review copy). */
function reviewFromListing(listing: Listing | undefined, fallbackSeller: string, categoryId: string): ModerationReview {
  const category = categoryById(listing?.categoryId ?? categoryId)
  if (!listing) return { details: category?.name, seller: fallbackSeller }
  const seller = sellerById(listing.sellerId)
  const images = listing.images.length ? listing.images : [listing.cover]
  const categoryLabel = category ? (listing.subcategory ? `${category.name} / ${listing.subcategory}` : category.name) : listing.subcategory
  const checks: string[] = []
  if (listing.price > 0) checks.push('Qiymət göstərilib')
  if (images.length) checks.push(`${images.length} şəkil əlavə edilib`)
  return {
    image: images[0],
    price: listing.price,
    details: [categoryLabel, ...listing.attributes, cityName(listing.cityId)].filter(Boolean).join(' · '),
    description: listing.description?.join(' '),
    seller: seller
      ? [
          seller.name,
          seller.contactPerson,
          seller.phone,
          seller.verified && seller.type === 'business' ? 'Təsdiqlənmiş biznes' : undefined,
          `${seller.activeListings} aktiv elan`,
        ]
          .filter(Boolean)
          .join(' · ')
      : fallbackSeller,
    checks,
  }
}

/**
 * Builds the moderation queue: the Figma queue (with this session's decisions applied) followed by the listings the
 * signed-in user submitted through the wizard. A submitted listing with the same "Elan №" as a Figma row is merged
 * into that row so both stay in sync.
 */
export function buildQueue(submitted: Listing[], decisions: Record<string, ModerationDecision>, userName: string): QueueEntry[] {
  const merged = new Set<string>()
  const fromFigma = moderationQueue.map((item: ModerationItem): QueueEntry => {
    const twins = submitted.filter((l) => l.id === item.listingId || (item.number != null && l.number === item.number))
    twins.forEach((l) => merged.add(l.id))
    const key = `figma:${item.id}`
    const decision = decisions[key]
    return {
      key,
      number: item.number,
      title: item.title,
      sellerName: item.sellerName,
      submittedAt: item.submittedAt,
      categoryId: item.categoryId,
      kind: item.kind,
      status: decision?.status ?? item.status,
      review: item.review ?? reviewFromListing(item.listingId ? listingById(item.listingId) : undefined, item.sellerName, item.categoryId),
      submittedIds: twins.map((l) => l.id),
      decision,
    }
  })

  const fromWizard = submitted
    .filter((l) => !merged.has(l.id))
    .flatMap((l): QueueEntry[] => {
      const status = listingStatusToModeration(l.status)
      if (!status) return []
      const key = `listing:${l.id}`
      const sellerName = sellerById(l.sellerId)?.name ?? userName
      return [
        {
          key,
          number: l.number,
          title: l.title,
          sellerName,
          submittedAt: l.publishedAt,
          categoryId: l.categoryId,
          kind: 'new',
          status,
          review: reviewFromListing(l, sellerName, l.categoryId),
          submittedIds: [l.id],
          decision: decisions[key],
        },
      ]
    })

  return [...fromFigma, ...fromWizard]
}

/** Chip and header counts: Figma totals (which include listings outside the visible queue) adjusted by the queue state. */
export function moderationCounts(entries: QueueEntry[]) {
  const figmaPending = moderationQueue.filter((i) => i.status === 'pending')
  const hiddenPending = moderationTotals.pending - figmaPending.length
  const hiddenRecheck = moderationTotals.recheck - figmaPending.filter((i) => i.kind === 'recheck').length
  const count = (status: ModerationStatus) => entries.filter((e) => e.status === status).length
  return {
    pending: hiddenPending + count('pending'),
    recheck: hiddenRecheck + entries.filter((e) => e.status === 'pending' && e.kind === 'recheck').length,
    approved: moderationTotals.approved + count('approved'),
    rejected: moderationTotals.rejected + count('rejected'),
  }
}
