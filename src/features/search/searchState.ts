/**
 * URL ⇄ filter state for "/elanlar" (Figma "Məhsul axtarışı" + "Mobil filtr paneli").
 *
 * Every filter lives in the query string so results are shareable and survive reloads (names in `PARAM`,
 * filterDefs.ts, which also holds the options and labels shared with the home search):
 *   q · kateqoriya · alt (sub-category slug) · seher (city id; old comma lists still parse) · min · max
 *   nov (species slug) · hundurluk ("100-200", "-100", "300-"; older ranges still work) · yas ("2-5")
 *   vip=1 · catdirilma=1 · saticiNovu=biznes|ferdi · siralama=ucuz|baha (default "Ən yenilər")
 *   gorunus=siyahi (default grid)
 */
import { categoryById, productCategories } from '@/data/categories'
import { cities, cityName } from '@/data/cities'
import { formatNumber, lowerAz } from '@/lib/format'
import { searchListings, type ListingFilters, type ListingSort } from '@/services/marketplace'
import type { Listing } from '@/types'
import {
  ageLabel,
  heightLabel,
  isRange,
  PARAM,
  parseRange,
  priceValueLabel,
  sellerChipLabel,
  toggleLabels,
  type SellerTypeParam,
} from './filterDefs'
import { speciesLabel, speciesSlug, subcategoryName, slugify } from './taxonomy'

export type { SellerTypeParam } from './filterDefs'
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

/* ---------- Sort ---------- */

const sortParam: Record<ListingSort, string> = { newest: '', 'price-asc': 'ucuz', 'price-desc': 'baha' }

export function parseSort(value: string | null): ListingSort {
  if (value === 'ucuz') return 'price-asc'
  if (value === 'baha') return 'price-desc'
  return 'newest'
}

/* ---------- Parsing / writing ---------- */

const isPrice = (v: string) => v !== '' && Number.isFinite(Number(v))

export function parseSearchState(params: URLSearchParams): SearchState {
  const categoryId = params.get(PARAM.category) ?? ''
  const category = productCategories.find((c) => c.id === categoryId)
  const sub = params.get(PARAM.subcategory) ?? ''
  const cityIds = (params.get(PARAM.city) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => cities.some((c) => c.id === id))
  const min = (params.get(PARAM.min) ?? '').trim()
  const max = (params.get(PARAM.max) ?? '').trim()
  const range = (key: string) => {
    const v = (params.get(key) ?? '').trim()
    return isRange(v) ? v : ''
  }
  const seller = params.get(PARAM.seller)
  const species = params.get(PARAM.species) ?? ''
  return {
    q: (params.get(PARAM.q) ?? '').trim(),
    categoryId: category ? category.id : '',
    subcategory: category && subcategoryName(category.id, sub) ? sub : '',
    // Keep the Figma order of the city list ("Bakı, Abşeron") regardless of the order in the URL.
    cityIds: cities.map((c) => c.id).filter((id) => cityIds.includes(id)),
    min: isPrice(min) ? min : '',
    max: isPrice(max) ? max : '',
    species: speciesLabel(species) ? species : '',
    height: range(PARAM.height),
    age: range(PARAM.age),
    vip: params.get(PARAM.vip) === '1',
    delivery: params.get(PARAM.delivery) === '1',
    sellerType: seller === 'biznes' || seller === 'ferdi' ? seller : '',
  }
}

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

/* ---------- Querying ---------- */

export function toListingFilters(state: SearchState): ListingFilters {
  const [heightMin, heightMax] = parseRange(state.height)
  const [ageMin, ageMax] = parseRange(state.age)
  const price = (v: string) => (isPrice(v.trim()) ? Number(v) : undefined)
  return {
    q: state.q.trim() || undefined,
    categoryId: state.categoryId || undefined,
    cityIds: state.cityIds.length ? state.cityIds : undefined,
    minPrice: price(state.min),
    maxPrice: price(state.max),
    vipOnly: state.vip || undefined,
    deliveryOnly: state.delivery || undefined,
    sellerType: state.sellerType === 'biznes' ? 'business' : state.sellerType === 'ferdi' ? 'individual' : undefined,
    heightMin,
    heightMax,
    ageMin,
    ageMax,
  }
}

/** `searchListings()` plus the two filters the shared query layer does not know (sub-category, species). */
export function runSearch(state: SearchState, sort: ListingSort = 'newest'): Listing[] {
  let results = searchListings(toListingFilters(state), sort)
  if (state.subcategory) results = results.filter((l) => l.subcategory != null && slugify(l.subcategory) === state.subcategory)
  if (state.species) results = results.filter((l) => speciesSlug(l) === state.species)
  return results
}

/* ---------- Derived copy (heading, breadcrumb, chips) ---------- */

/** "Bağınız üçün ağaclar" — Figma heading for the "Ağaclar" category; other states keep the same voice. */
export function searchHeading(state: SearchState): string {
  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  if (category) return `Bağınız üçün ${lowerAz(category.name)}`
  if (state.vip) return 'Önə çıxan elanlar'
  if (state.q) return 'Axtarış nəticələri'
  return 'Bütün elanlar'
}

/** "Seçiminizə uyğun 6 elan tapıldı" */
export function resultSummary(count: number): string {
  return count ? `Seçiminizə uyğun ${formatNumber(count)} elan tapıldı` : 'Seçiminizə uyğun elan tapılmadı'
}

/** "6 elan" (delivery has its own chip). */
export function resultCountLabel(count: number): string {
  return `${formatNumber(count)} elan`
}

export interface FilterChip {
  key: string
  label: string
  /** State after removing this chip. */
  without: SearchState
}

/**
 * Chips shown above the results, in page order: the search card (search word, city), then the filter groups
 * («zeytun» ×, Bakı ×, Ağaclar ×, 50–150 ₼ ×, 1–2 m ×, Çatdırılma ×).
 */
export function activeChips(state: SearchState): FilterChip[] {
  const chips: FilterChip[] = []
  const push = (key: string, label: string | undefined, without: Partial<SearchState>) =>
    label && chips.push({ key, label, without: { ...state, ...without } })

  push('q', state.q && `«${state.q}»`, { q: '' })
  push('city', state.cityIds.map(cityName).join(', '), { cityIds: [] })
  push('category', categoryById(state.categoryId)?.name, { categoryId: '', subcategory: '', species: '' })
  push('subcategory', state.subcategory && subcategoryName(state.categoryId, state.subcategory), { subcategory: '' })
  push('price', priceValueLabel(state.min, state.max), { min: '', max: '' })
  push('height', state.height && heightLabel(state.height), { height: '' })
  push('age', state.age && ageLabel(state.age), { age: '' })
  push('species', state.species && speciesLabel(state.species), { species: '' })
  push('seller', sellerChipLabel(state.sellerType), { sellerType: '' })
  push('delivery', state.delivery ? toggleLabels.delivery : undefined, { delivery: false })
  push('vip', state.vip ? toggleLabels.vip : undefined, { vip: false })
  return chips
}

/** Filters set, for «Filtrlər (n)» and «Sıfırla». The search word has its own chip but is not a filter. */
export function activeFilterCount(state: SearchState): number {
  return activeChips(state).filter((chip) => chip.key !== 'q').length
}
