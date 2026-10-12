import { publicListings } from '@/data/listings'
import { filterListings, sortListings, type ListingSort } from '@/services/marketplace'
import type { Listing } from '@/types'
import { sellerStatsFor } from './sellerStats'

export const SELLER_PAGE_SIZE = 6

/** "Ən yenilər" for one seller: the seller's stated order first (Figma grid), then the rest newest first. */
function sortByStatedOrder(source: Listing[], order: string[]): Listing[] {
  const rank = (l: Listing) => {
    const i = order.indexOf(l.id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...source].sort((a, b) => rank(a) - rank(b) || b.publishedAt.localeCompare(a.publishedAt))
}

export function sortSellerListings(sellerId: string, source: Listing[], sort: ListingSort): Listing[] {
  const order = sellerStatsFor(sellerId)?.listingOrder
  if (sort === 'newest' && order) return sortByStatedOrder(source, order)
  return sortListings(source, sort)
}

/** Public listings of a seller, optionally narrowed by category tab and in-seller search. */
export function sellerListings(sellerId: string, opts: { categoryId?: string; q?: string; sort?: ListingSort } = {}): Listing[] {
  const found = filterListings(publicListings, { sellerId, categoryId: opts.categoryId, q: opts.q })
  return sortSellerListings(sellerId, found, opts.sort ?? 'newest')
}

export function paginate<T>(items: T[], page: number, size = SELLER_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { page: current, pageCount, items: items.slice((current - 1) * size, current * size) }
}
