/**
 * The seller page's listings: the page loads the seller's public listings on the server (`loadSellerListings`), and
 * the «Elanlar» section narrows, sorts and pages them in the browser. No listing data is imported here, so the
 * client component stays small.
 */
import { emptySearchState } from '@/features/search/searchUrl'
import { matchesListingQuery, sortListings } from '@/services/listingMatch'
import type { ListingSort } from '@/services/listingSort'
import type { MarketplaceRepository } from '@/services/repository'
import type { Listing } from '@/types'
import { sellerStatsFor } from './sellerStats'

export const SELLER_PAGE_SIZE = 6

/**
 * The most listings a seller page loads (4 API pages of 60). A business with more shows its newest ones; paging
 * through the API instead of loading them all waits until a seller gets near this.
 */
export const SELLER_LISTINGS_MAX = 240
const LOAD_PAGE_SIZE = 60

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

/** A seller's public listings (`source`, from the page), optionally narrowed by category tab and in-seller search. */
export function sellerListings(source: Listing[], sellerId: string, opts: { categoryId?: string; q?: string; sort?: ListingSort } = {}): Listing[] {
  const found = source.filter((l) => (!opts.categoryId || l.categoryId === opts.categoryId) && (!opts.q || matchesListingQuery(l, opts.q)))
  return sortSellerListings(sellerId, found, opts.sort ?? 'newest')
}

export function paginate<T>(items: T[], page: number, size = SELLER_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { page: current, pageCount, items: items.slice((current - 1) * size, current * size) }
}

/** The seller's public listings for the seller page, newest first, up to `SELLER_LISTINGS_MAX`. */
export async function loadSellerListings(repo: MarketplaceRepository, sellerId: string): Promise<Listing[]> {
  const listings: Listing[] = []
  for (let page = 1; listings.length < SELLER_LISTINGS_MAX; page++) {
    const result = await repo.searchListings({ state: emptySearchState, sort: 'newest', page, pageSize: LOAD_PAGE_SIZE, sellerId })
    listings.push(...result.items)
    if (page >= result.pageCount) break
  }
  return listings.slice(0, SELLER_LISTINGS_MAX)
}
