/**
 * Indexing and canonical rules for the catalogue URLs (see SEO_ARCHITECTURE.md → "Catalogue URLs").
 *
 *   /elanlar                          index · canonical /elanlar
 *   /elanlar?sehife=N                 index · self-canonical (crawlable pagination)
 *   /elanlar?kateqoriya=X             canonical → /kateqoriyalar/X (same results, clean URL)
 *   /elanlar?kateqoriya=X&seher=Y     canonical → /kateqoriyalar/X/Y (one city only)
 *   /elanlar?q=… or any other filter  noindex, follow · no canonical (unbounded combinations, internal search)
 *   siralama / gorunus                presentation only — ignored for canonical URLs
 *
 * Category pages are only indexable with enough inventory, so empty or thin combinations do not
 * become soft-404 doorway pages. These rules only matter once the site-wide switch in env.ts allows indexing.
 */
import type { SearchState } from '@/features/search/searchState'

/** Results per catalogue page (/elanlar and the category pages). */
export const CATALOG_PAGE_SIZE = 24
/** Minimum active listings for a category page to be indexable. */
export const MIN_LISTINGS_CATEGORY = 1
/** Minimum active listings for a category × city page to be indexable. */
export const MIN_LISTINGS_CATEGORY_CITY = 3

export interface IndexRule {
  index: boolean
  follow: boolean
  canonical?: string
}

export function categoryPath(categoryId: string, cityId?: string): string {
  return cityId ? `/kateqoriyalar/${categoryId}/${cityId}` : `/kateqoriyalar/${categoryId}`
}

export function withPage(path: string, page: number): string {
  return page > 1 ? `${path}?sehife=${page}` : path
}

/** Parses `sehife`; anything that is not a positive integer counts as page 1. */
export function parsePage(value: string | null | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1
  const n = Number(value)
  return n >= 1 ? n : 1
}

export function categoryIndexRule(count: number, cityId?: string): boolean {
  return count >= (cityId ? MIN_LISTINGS_CATEGORY_CITY : MIN_LISTINGS_CATEGORY)
}

/** Rule for a category (or category × city) page at /kateqoriyalar/…. */
export function categoryPageRule(categoryId: string, cityId: string | undefined, count: number, page: number): IndexRule {
  return { index: categoryIndexRule(count, cityId), follow: true, canonical: withPage(categoryPath(categoryId, cityId), page) }
}

/** Rule for /elanlar with the parsed filter state, the result count and the requested page. */
export function catalogRule(state: SearchState, count: number, page: number): IndexRule {
  const filters = {
    q: state.q !== '',
    category: state.categoryId !== '',
    subcategory: state.subcategory !== '',
    cities: state.cityIds.length,
    price: state.min !== '' || state.max !== '',
    species: state.species !== '',
    height: state.height !== '',
    age: state.age !== '',
    vip: state.vip,
    delivery: state.delivery,
    seller: state.sellerType !== '',
  }
  const others =
    filters.q ||
    filters.subcategory ||
    filters.price ||
    filters.species ||
    filters.height ||
    filters.age ||
    filters.vip ||
    filters.delivery ||
    filters.seller

  if (!others && !filters.category && filters.cities === 0) {
    return { index: true, follow: true, canonical: withPage('/elanlar', page) }
  }
  if (!others && filters.category && filters.cities <= 1) {
    const rule = categoryPageRule(state.categoryId, state.cityIds[0], count, page)
    // Thin combinations stay noindex without pointing a canonical at another noindex page.
    return rule.index ? rule : { index: false, follow: true }
  }
  return { index: false, follow: true }
}
