/**
 * The catalogue's filter state and its URL, without any listing data: client components import this module, so
 * the sample listings never reach the browser bundle. Parsing (which validates against the data), the query and
 * the chips live in searchState.ts, which re-exports everything here.
 */
import type { ListingSort } from '@/services/marketplace'
import { PARAM, type SellerTypeParam } from './filterDefs'

export type SearchView = 'grid' | 'list'

export interface SearchState {
  q: string
  categoryId: string
  subcategory: string
  cityIds: string[]
  /** Raw price inputs ('' = not set) so the form can show exactly what the user typed. */
  min: string
  max: string
  species: string
  height: string
  age: string
  vip: boolean
  delivery: boolean
  sellerType: SellerTypeParam
}

export const emptySearchState: SearchState = {
  q: '',
  categoryId: '',
  subcategory: '',
  cityIds: [],
  min: '',
  max: '',
  species: '',
  height: '',
  age: '',
  vip: false,
  delivery: false,
  sellerType: '',
}

/** Every filter cleared; the search word stays (it has its own chip and is not a filter). */
export function withoutFilters(state: SearchState): SearchState {
  return { ...emptySearchState, q: state.q }
}

/* ---------- Sort ---------- */

const sortParam: Record<ListingSort, string> = { newest: '', 'price-asc': 'ucuz', 'price-desc': 'baha' }

export function parseSort(value: string | null): ListingSort {
  if (value === 'ucuz') return 'price-asc'
  if (value === 'baha') return 'price-desc'
  return 'newest'
}

/* ---------- Writing ---------- */

/** Builds the query string for `state`, keeping the non-filter params (sort, view) from `current`. */
export function writeSearchState(state: SearchState, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  const set = (key: string, value: string | false) => value && next.set(key, value)
  set(PARAM.q, state.q.trim())
  set(PARAM.category, state.categoryId)
  set(PARAM.subcategory, state.categoryId && state.subcategory)
  set(PARAM.city, state.cityIds.join(','))
  set(PARAM.min, state.min.trim())
  set(PARAM.max, state.max.trim())
  set(PARAM.species, state.species)
  set(PARAM.height, state.height)
  set(PARAM.age, state.age)
  set(PARAM.vip, state.vip && '1')
  set(PARAM.delivery, state.delivery && '1')
  set(PARAM.seller, state.sellerType)
  set(PARAM.sort, current.get(PARAM.sort) ?? '')
  set(PARAM.view, current.get(PARAM.view) ?? '')
  return next
}

/** "/elanlar?…" for a filter state: filter changes always continue on /elanlar (category pages included), page 1. */
export function catalogHref(state: SearchState, current: URLSearchParams): string {
  const query = writeSearchState(state, current)
  return query.size ? `/elanlar?${query}` : '/elanlar'
}

export function withSort(current: URLSearchParams, sort: ListingSort): URLSearchParams {
  const next = new URLSearchParams(current)
  if (sortParam[sort]) next.set(PARAM.sort, sortParam[sort])
  else next.delete(PARAM.sort)
  return next
}

export function withView(current: URLSearchParams, view: SearchView): URLSearchParams {
  const next = new URLSearchParams(current)
  if (view === 'list') next.set(PARAM.view, 'siyahi')
  else next.delete(PARAM.view)
  return next
}

/* ---------- Chips ---------- */

/** A chip above the results; `without` is the state after removing it. Built on the server (searchState.ts). */
export interface FilterChip {
  key: string
  label: string
  without: SearchState
}

/** Whether the filter behind a chip is still set in `state` (an optimistic state hides removed chips at once). */
export function chipActive(key: string, state: SearchState): boolean {
  switch (key) {
    case 'q':
      return state.q !== ''
    case 'city':
      return state.cityIds.length > 0
    case 'category':
      return state.categoryId !== ''
    case 'subcategory':
      return state.subcategory !== ''
    case 'price':
      return state.min !== '' || state.max !== ''
    case 'height':
      return state.height !== ''
    case 'age':
      return state.age !== ''
    case 'species':
      return state.species !== ''
    case 'seller':
      return state.sellerType !== ''
    case 'delivery':
      return state.delivery
    case 'vip':
      return state.vip
    default:
      return true
  }
}
