import type { Listing, UserProfile } from '@/types'

/** Private owner preview of a listing: /kabinet/elanlar/[slug] (noindex, never linked publicly). */
export const ownerPreviewPath = (slug: string) => `/kabinet/elanlar/${slug}`

export type OwnerPreview = { kind: 'signin' } | { kind: 'not-found' } | { kind: 'listing'; listing: Listing }

/**
 * Who may open a listing in the owner preview: the signed-in seller, for ads they posted in this browser
 * (`submitted`) or catalogue listings that belong to their seller account, whatever the status.
 * Everyone else gets "not found"; without a session the page asks to sign in.
 * With a backend this becomes an authenticated "my listing" API call.
 */
export function resolveOwnerPreview(
  slug: string,
  user: Pick<UserProfile, 'sellerId'> | null | undefined,
  submitted: Listing[],
  findListing: (slug: string) => Listing | undefined,
): OwnerPreview {
  if (!user) return { kind: 'signin' }
  const own = submitted.find((l) => l.slug === slug)
  if (own) return { kind: 'listing', listing: own }
  const listing = findListing(slug)
  if (listing && user.sellerId && listing.sellerId === user.sellerId) return { kind: 'listing', listing }
  return { kind: 'not-found' }
}

/**
 * Where a cabinet row links: the public page only when the listing is published on the site (an active catalogue
 * listing that the seller has not deactivated); every other own listing opens the private preview. Linking a
 * pending, expired or browser-only listing to its public URL would point at a 404.
 */
export function cabinetListingHref(row: { listing: Listing; status: Listing['status']; source: string }): string {
  const isPublic = row.source !== 'submitted' && row.listing.status === 'active' && row.status === 'active'
  return isPublic ? `/elanlar/${row.listing.slug}` : ownerPreviewPath(row.listing.slug)
}
