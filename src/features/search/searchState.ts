/**
 * URL ⇄ filter state for "/elanlar" and the category pages: parsing, the query, headings and chips.
 * Server-side (it reads the sample data to validate species and to search); the data-free half that client
 * components use is searchUrl.ts, re-exported here.
 *
 * Every filter lives in the query string so results are shareable and survive reloads (names in `PARAM`,
 * filterDefs.ts, which also holds the options and labels shared with the home search):
 *   q · kateqoriya · alt (sub-category slug) · seher (city id; old comma lists still parse) · min · max
 *   nov (species slug) · hundurluk ("100-200", "-100", "300-"; older ranges still work) · yas ("2-5")
 *   kok (dibcek | torpaq-kuresi | aciq-kok)
 *   vip=1 · catdirilma=1 · saticiNovu=biznes|ferdi · siralama=ucuz|baha (default "Ən yenilər")
 *   gorunus=siyahi (default grid)
 */
import { categoryById, productCategories } from '@/data/categories'
import { cities, cityName } from '@/data/cities'
import { formatNumber, locativeAz, lowerAz } from '@/lib/format'
import { searchListings, type ListingFilters, type ListingSort } from '@/services/marketplace'
import { subcategoryIdOf } from '@/data/categories'
import type { Listing } from '@/types'
import { ageLabel, heightLabel, isRange, PARAM, parseRange, priceValueLabel, rootLabel, rootSystemOf, sellerChipLabel, toggleLabels } from './filterDefs'
import type { FilterChip, SearchState } from './searchUrl'
import { speciesLabel, speciesSlug } from './species'
import { subcategoryName } from './taxonomy'

export type { SellerTypeParam } from './filterDefs'
export {
  catalogHref,
  chipActive,
  emptySearchState,
  parseSort,
  selectCategory,
  withoutFilters,
  withSort,
  withView,
  writeSearchState,
  type FilterChip,
  type SearchState,
  type SearchView,
} from './searchUrl'

/* ---------- Parsing ---------- */

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
  const root = params.get(PARAM.root) ?? ''
  return {
    q: (params.get(PARAM.q) ?? '').trim(),
    categoryId: category ? category.id : '',
    subcategory: category && subcategoryName(category.id, sub) ? sub : '',
    // Keep the order of the city list ("Bakı, Abşeron") regardless of the order in the URL.
    cityIds: cities.map((c) => c.id).filter((id) => cityIds.includes(id)),
    min: isPrice(min) ? min : '',
    max: isPrice(max) ? max : '',
    species: speciesLabel(species) ? species : '',
    height: range(PARAM.height),
    age: range(PARAM.age),
    root: rootLabel(root) ? root : '',
    vip: params.get(PARAM.vip) === '1',
    delivery: params.get(PARAM.delivery) === '1',
    sellerType: seller === 'biznes' || seller === 'ferdi' ? seller : '',
  }
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
    rootSystem: state.root ? rootSystemOf[state.root] : undefined,
  }
}

/** `searchListings()` plus the two filters the shared query layer does not know (sub-category, species). */
export function runSearch(state: SearchState, sort: ListingSort = 'newest'): Listing[] {
  let results = searchListings(toListingFilters(state), sort)
  if (state.subcategory) results = results.filter((l) => subcategoryIdOf(l.categoryId, l.subcategory) === state.subcategory)
  if (state.species) results = results.filter((l) => speciesSlug(l) === state.species)
  return results
}

/* ---------- Derived copy (heading, counts, chips) ---------- */

/**
 * The page heading names what is shown, in the words the visitor clicked: «Məhsullar» (the menu link),
 * «Ağaclar» / «Meyvə ağacları» (the category or sub-category), «Bakıda ağaclar» (one city), «Önə çıxan elanlar»,
 * or ««zeytun» üzrə elanlar» for a search word. It is also the page title (with « — GreenStore»).
 */
export function searchHeading(state: SearchState): string {
  if (state.q) return `«${state.q}» üzrə elanlar`
  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  const subcategory = category && state.subcategory ? subcategoryName(category.id, state.subcategory) : undefined
  const subject = subcategory ?? category?.name ?? (state.vip ? 'Önə çıxan elanlar' : 'Məhsullar')
  if (state.cityIds.length === 1) return `${locativeAz(cityName(state.cityIds[0]))} ${lowerAz(subject)}`
  return subject
}

/** "Seçiminizə uyğun 6 elan tapıldı" (meta description). */
export function resultSummary(count: number): string {
  return count ? `Seçiminizə uyğun ${formatNumber(count)} elan tapıldı` : 'Seçiminizə uyğun elan tapılmadı'
}

/** "6 elan", shown once, next to the heading. */
export function resultCountLabel(count: number): string {
  return `${formatNumber(count)} elan`
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
  push('category', categoryById(state.categoryId)?.name, { categoryId: '', subcategory: '', species: '', root: '' })
  push('subcategory', state.subcategory && subcategoryName(state.categoryId, state.subcategory), { subcategory: '' })
  push('price', priceValueLabel(state.min, state.max), { min: '', max: '' })
  push('height', state.height && heightLabel(state.height), { height: '' })
  push('age', state.age && ageLabel(state.age), { age: '' })
  push('root', state.root && rootLabel(state.root), { root: '' })
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
