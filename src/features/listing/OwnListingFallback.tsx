'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useHydrated } from '@/components/layout/ClientGate'
import { categoryById } from '@/data/categories'
import { listingBySlug } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { useMyListings, useSession } from '@/state/store'
import { ListingDetail, ListingNotFound } from '@/views/ListingDetailPage'
import { otherSellerListings, similarListings } from './detail'

/**
 * 404 body of /elanlar/[slug]. Unknown and unpublished listings are a real 404 for everyone, but the signed-in demo
 * seller may still open their own pending / expired listings (data, or ads posted in this browser), as in the Vite
 * build. Those exist only in the browser (localStorage), so they are resolved here after hydration.
 * With a real backend this becomes an authenticated "my listing" API call.
 */
export function OwnListingFallback() {
  const pathname = usePathname()
  const slug = decodeURIComponent(pathname.split('/')[2] ?? '')
  const hydrated = useHydrated()
  const { user } = useSession()
  const { submitted } = useMyListings()

  const own = submitted.find((l) => l.slug === slug)
  const fromData = listingBySlug(slug)
  const candidate = fromData ?? own
  const isOwner = Boolean(candidate && (own || (user?.sellerId && candidate.sellerId === user.sellerId)))
  const listing = hydrated && isOwner ? candidate : undefined

  useEffect(() => {
    if (!listing) return
    const previous = document.title
    document.title = `${listing.title} — GreenStore`
    return () => {
      document.title = previous
    }
  }, [listing])

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
