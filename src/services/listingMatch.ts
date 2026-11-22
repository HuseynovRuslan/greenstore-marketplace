/**
 * Search-word matching and sorting of listings that are already loaded (the seller page filters the seller's
 * listings in the browser). Reference data only (categories, cities): no listing data, so client components can
 * import it.
 */
import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { normalizeSearch } from '@/lib/format'
import type { Listing } from '@/types'
import type { ListingSort } from './listingSort'

/** Every word of `q` occurs in the title, the card line, the city, the category or the sub-category. */
export function matchesListingQuery(listing: Listing, q: string): boolean {
  const needle = normalizeSearch(q)
  if (!needle) return true
  const haystack = normalizeSearch(
    [listing.title, ...listing.attributes, cityName(listing.cityId), categoryById(listing.categoryId)?.name ?? '', listing.subcategory ?? ''].join(' '),
  )
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

export function sortListings(source: Listing[], sort: ListingSort): Listing[] {
  const copy = [...source]
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price)
    default:
      // «Önə çıxan» listings stay on top of "Ən yenilər", like the Figma search results.
      return copy.sort((a, b) => Number(b.vip) - Number(a.vip) || b.publishedAt.localeCompare(a.publishedAt))
  }
}
