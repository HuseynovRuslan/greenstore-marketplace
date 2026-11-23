/**
 * Query strings of the Web API's list endpoints (backend/ARCHITECTURE.md §7) from the site's own query objects.
 * Shared by the API repository and by the mock-parity vectors the API is tested with (backend/seed/buildSeed.ts),
 * so both run exactly the same requests. The «Növ» (species) filter has no API parameter: with DATA_SOURCE=api the
 * site knows no species (src/features/search/species.ts), so the state never carries one.
 *
 * The site's URL parsers accept any number a visitor types (`?min=-5`, `?sehife=99999999999`), while the API answers
 * 400 to values outside its ranges (backend Common/Http/QueryReader.cs). Every number is therefore brought into the
 * API's range here, in the way that keeps its meaning: a negative price becomes 0 (prices are never negative), one
 * above every possible price becomes the largest one, a huge height or age becomes int32's largest, and a page past
 * the end becomes int32's largest, which both repositories answer with the last page.
 */
import { toListingFilters, type SearchState } from '@/features/search/searchState'
import { SERVICES_PAGE_SIZE, type ServiceQuery } from '@/features/services/query'
import type { ListingSearchQuery, SellerQuery } from './repository'

/** The largest amount the API takes (`numeric(10,2)`, DATABASE.md §2). */
export const API_MAX_AMOUNT = 99_999_999.99
/** The largest whole number the API takes (int32): heights, ages and pages. */
export const API_MAX_INT = 2_147_483_647

/**
 * An amount within 0–99 999 999.99, in whole qəpik: prices are stored in qəpik, so a minimum rounds up and a maximum
 * down without changing which listings match. `toFixed` drops the float noise of `× 100` (1.1 × 100 = 110.00000000000001).
 */
function amountParam(value: number, round: (cents: number) => number): string {
  const clamped = Math.min(Math.max(value, 0), API_MAX_AMOUNT)
  return String(round(Number((clamped * 100).toFixed(4))) / 100)
}

/** A whole number within 0–int32 (heights in cm, ages in years). */
function intParam(value: number): string {
  return String(Math.min(Math.max(Math.floor(value), 0), API_MAX_INT))
}

/** A 1-based page within int32; anything that is not a page number is page 1. */
export function pageParam(page: number): string {
  const whole = Math.floor(page)
  return String(whole >= 1 ? Math.min(whole, API_MAX_INT) : 1)
}

function setPrices(params: URLSearchParams, min: number | undefined, max: number | undefined) {
  if (min != null && Number.isFinite(min)) params.set('minPrice', amountParam(min, Math.ceil))
  if (max != null && Number.isFinite(max)) params.set('maxPrice', amountParam(max, Math.floor))
}

/** The catalogue's filters: `GET /listings` and `GET /listings/facets`. */
export function listingFilterParams(state: SearchState): URLSearchParams {
  const f = toListingFilters(state)
  const params = new URLSearchParams()
  if (f.q) params.set('q', f.q)
  if (f.categoryId) params.set('categoryId', f.categoryId)
  if (state.subcategory) params.set('subcategoryId', state.subcategory)
  if (f.cityIds?.length) params.set('cityIds', f.cityIds.join(','))
  setPrices(params, f.minPrice, f.maxPrice)
  if (f.vipOnly) params.set('promoted', 'true')
  if (f.deliveryOnly) params.set('delivery', 'true')
  if (f.sellerType) params.set('sellerType', f.sellerType)
  if (f.heightMin != null) params.set('heightMin', intParam(f.heightMin))
  if (f.heightMax != null) params.set('heightMax', intParam(f.heightMax))
  if (f.ageMin != null) params.set('ageMin', intParam(f.ageMin))
  if (f.ageMax != null) params.set('ageMax', intParam(f.ageMax))
  if (f.rootSystem) params.set('rootSystem', f.rootSystem)
  return params
}

/** One catalogue page: `GET /listings`. */
export function listingSearchParams({ state, sort, page, pageSize, sellerId }: ListingSearchQuery): URLSearchParams {
  const params = listingFilterParams(state)
  if (sellerId) params.set('sellerId', sellerId)
  params.set('sort', sort)
  params.set('page', pageParam(page))
  params.set('pageSize', String(pageSize))
  return params
}

/** One services catalogue page: `GET /services`. */
export function serviceSearchParams(q: ServiceQuery, pageSize = SERVICES_PAGE_SIZE): URLSearchParams {
  const params = new URLSearchParams()
  if (q.q) params.set('q', q.q)
  if (q.categoryId) params.set('categoryId', q.categoryId)
  if (q.cityId) params.set('cityId', q.cityId)
  if (q.tab === 'sirketler') params.set('providerKind', 'company')
  if (q.tab === 'ustalar') params.set('providerKind', 'individual')
  setPrices(params, q.minPrice, q.maxPrice)
  params.set('sort', q.sort)
  params.set('page', pageParam(q.page))
  params.set('pageSize', String(pageSize))
  return params
}

/** The sellers directory: `GET /sellers`. */
export function sellerListParams({ businessKind, cityId, page, pageSize }: SellerQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (businessKind) params.set('businessKind', businessKind)
  if (cityId) params.set('cityId', cityId)
  params.set('page', pageParam(page))
  if (pageSize) params.set('pageSize', String(pageSize))
  return params
}
