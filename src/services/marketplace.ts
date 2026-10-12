/**
 * Read-side "API" for the frontend. Today it filters the typed mock data in `src/data`;
 * the function signatures mirror the query endpoints planned for the ASP.NET Core Web API
 * (GET /api/listings?q=&categoryId=&cityIds=&minPrice=&maxPrice=&vip=&delivery=&sellerType=&sort=).
 */
import { ageYears, heightRange, publicListings } from '@/data/listings'
import { cityName } from '@/data/cities'
import { categoryById } from '@/data/categories'
import { sellerById } from '@/data/sellers'
import { normalizeSearch } from '@/lib/format'
import type { Listing, SellerType } from '@/types'

export type ListingSort = 'newest' | 'price-asc' | 'price-desc'

export const listingSortOptions: Array<{ value: ListingSort; label: string }> = [
  { value: 'newest', label: 'Ən yenilər' },
  { value: 'price-asc', label: 'Əvvəlcə ucuz' },
  { value: 'price-desc', label: 'Əvvəlcə bahalı' },
]

export interface ListingFilters {
  q?: string
  categoryId?: string
  cityIds?: string[]
  minPrice?: number
  maxPrice?: number
  vipOnly?: boolean
  deliveryOnly?: boolean
  sellerType?: SellerType
  sellerId?: string
  heightMin?: number
  heightMax?: number
  ageMin?: number
  ageMax?: number
}

function matchesQuery(listing: Listing, q: string): boolean {
  const needle = normalizeSearch(q)
  if (!needle) return true
  const haystack = normalizeSearch(
    [listing.title, ...listing.attributes, cityName(listing.cityId), categoryById(listing.categoryId)?.name ?? '', listing.subcategory ?? ''].join(' '),
  )
  return needle.split(/\s+/).every((word) => haystack.includes(word))
}

export function filterListings(source: Listing[], f: ListingFilters): Listing[] {
  return source.filter((l) => {
    if (f.q && !matchesQuery(l, f.q)) return false
    if (f.categoryId && l.categoryId !== f.categoryId) return false
    if (f.cityIds?.length && !f.cityIds.includes(l.cityId)) return false
    if (f.minPrice != null && l.price < f.minPrice) return false
    if (f.maxPrice != null && l.price > f.maxPrice) return false
    if (f.vipOnly && !l.vip) return false
    if (f.deliveryOnly && !l.deliveryAvailable) return false
    if (f.sellerId && l.sellerId !== f.sellerId) return false
    if (f.sellerType) {
      const seller = sellerById(l.sellerId)
      if (!seller || seller.type !== f.sellerType) return false
    }
    if (f.heightMin != null || f.heightMax != null) {
      const h = heightRange(l)
      if (!h) return false
      if (f.heightMin != null && h[1] < f.heightMin) return false
      if (f.heightMax != null && h[0] > f.heightMax) return false
    }
    if (f.ageMin != null || f.ageMax != null) {
      const a = ageYears(l)
      if (a == null) return false
      if (f.ageMin != null && a < f.ageMin) return false
      if (f.ageMax != null && a > f.ageMax) return false
    }
    return true
  })
}

export function sortListings(source: Listing[], sort: ListingSort): Listing[] {
  const copy = [...source]
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price)
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price)
    default:
      // VIP listings stay on top of "Ən yenilər", like the Figma search results.
      return copy.sort((a, b) => Number(b.vip) - Number(a.vip) || b.publishedAt.localeCompare(a.publishedAt))
  }
}

export function searchListings(filters: ListingFilters, sort: ListingSort = 'newest'): Listing[] {
  return sortListings(filterListings(publicListings, filters), sort)
}
