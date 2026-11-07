import { describe, expect, it } from 'vitest'
import { listingBySlug, listings } from '@/data/listings'
import type { Listing } from '@/types'
import { cabinetListingHref, ownerPreviewPath, resolveOwnerPreview } from './ownerPreview'

const seller = { sellerId: 'abseron-tingcilik' }
const pending = listingBySlug('leyland-servi-120-sm')!
// Catalogue listings without a known seller, and a listing of another seller.
const unowned = listings.find((l) => !l.sellerId)!
const otherSellers: Listing = { ...pending, id: 'x-1', slug: 'basqa-satici-elani', sellerId: 'yasil-bag-merkezi' }
const browserOnly: Listing = { ...pending, id: 'u-1', slug: 'test-elan-10600', status: 'pending' }

describe('owner preview access', () => {
  it('asks guests to sign in', () => {
    expect(resolveOwnerPreview(pending.slug, null, [], listingBySlug)).toEqual({ kind: 'signin' })
  })

  it("shows the seller's own catalogue listings in any status", () => {
    expect(pending.status).toBe('pending')
    expect(resolveOwnerPreview(pending.slug, seller, [], listingBySlug)).toEqual({ kind: 'listing', listing: pending })
  })

  it('shows ads posted in this browser', () => {
    expect(resolveOwnerPreview(browserOnly.slug, seller, [browserOnly], listingBySlug)).toEqual({ kind: 'listing', listing: browserOnly })
  })

  it("hides other sellers' listings and unknown slugs", () => {
    const find = (slug: string) => (slug === otherSellers.slug ? otherSellers : listingBySlug(slug))
    expect(resolveOwnerPreview(otherSellers.slug, seller, [], find)).toEqual({ kind: 'not-found' })
    expect(resolveOwnerPreview(unowned.slug, seller, [], listingBySlug)).toEqual({ kind: 'not-found' })
    expect(resolveOwnerPreview('yoxdur', seller, [], listingBySlug)).toEqual({ kind: 'not-found' })
    expect(resolveOwnerPreview(pending.slug, { sellerId: undefined }, [], listingBySlug)).toEqual({ kind: 'not-found' })
  })
})

describe('cabinet links', () => {
  const zeytun = listingBySlug('zeytun-agaci-olea-europaea')!

  it('links published catalogue listings to their public page', () => {
    expect(cabinetListingHref({ listing: zeytun, status: 'active', source: 'seed' })).toBe('/elanlar/zeytun-agaci-olea-europaea')
  })

  it('links everything else to the private preview, never to a public 404', () => {
    expect(cabinetListingHref({ listing: pending, status: 'pending', source: 'seed' })).toBe(ownerPreviewPath(pending.slug))
    expect(cabinetListingHref({ listing: zeytun, status: 'inactive', source: 'seed' })).toBe(ownerPreviewPath(zeytun.slug))
    // Approved in the demo moderation tool, but it only exists in this browser.
    expect(cabinetListingHref({ listing: { ...browserOnly, status: 'active' }, status: 'active', source: 'submitted' })).toBe('/kabinet/elanlar/test-elan-10600')
  })
})
