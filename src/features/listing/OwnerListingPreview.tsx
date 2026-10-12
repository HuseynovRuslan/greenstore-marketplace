'use client'

import { useEffect } from 'react'
import { categoryById } from '@/data/categories'
import { listingBySlug } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { useMyListings, useSession } from '@/state/store'
import { ListingDetail, ListingNotFound } from '@/views/ListingDetailPage'
import { otherSellerListings, similarListings } from './detail'
import { ownerPreviewPath, resolveOwnerPreview } from './ownerPreview'

/**
 * /kabinet/elanlar/[slug] — the signed-in seller's preview of their own listing (pending, expired, deactivated or
 * posted in this browser), in the same layout as the public listing page, with its status notice.
 * Rendered in the browser only (session and submitted ads live in localStorage); the route is private and noindex.
 */
export function OwnerListingPreview({ slug }: { slug: string }) {
  const { user } = useSession()
  const { submitted } = useMyListings()
  const preview = resolveOwnerPreview(slug, user, submitted, listingBySlug)
  const listing = preview.kind === 'listing' ? preview.listing : undefined

  useEffect(() => {
    if (!listing) return
    const previous = document.title
    document.title = `${listing.title} — GreenStore`
    return () => {
      document.title = previous
    }
  }, [listing])

  if (preview.kind === 'signin') return <SignInPrompt next={ownerPreviewPath(slug)} />
  if (!listing) return <ListingNotFound />
  const others = otherSellerListings(listing)
  return (
    <ListingDetail
      key={listing.id}
      listing={listing}
      seller={sellerById(listing.sellerId)}
      category={categoryById(listing.categoryId)}
      others={others}
      similar={similarListings(listing, others)}
    />
  )
}
