/**
 * Read-side "API" for the frontend. Today it filters the typed mock data in `src/data`;
 * the function signatures mirror the query endpoints planned for the ASP.NET Core Web API
 * (GET /api/listings?q=&categoryId=&cityIds=&minPrice=&maxPrice=&vip=&delivery=&sellerType=&rootSystem=&sort=).
 */
import { ageYears, heightRange, publicListings } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import type { Listing, RootSystem, SellerType } from '@/types'

import { matchesListingQuery, sortListings } from './listingMatch'
import type { ListingSort } from './listingSort'

export { listingSortOptions, type ListingSort } from './listingSort'
export { sortListings } from './listingMatch'

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
  /** «Kök sistemi» (Nov 2026) */
  rootSystem?: RootSystem
}

export function filterListings(source: Listing[], f: ListingFilters): Listing[] {
  return source.filter((l) => {
    if (f.q && !matchesListingQuery(l, f.q)) return false
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
    if (f.rootSystem && l.plant?.rootSystem !== f.rootSystem) return false
    return true
  })
}

export function searchListings(filters: ListingFilters, sort: ListingSort = 'newest'): Listing[] {
  return sortListings(filterListings(publicListings, filters), sort)
}
