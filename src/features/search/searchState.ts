/**
 * URL ⇄ filter state for "/elanlar" (Figma "Məhsul axtarışı" + "Mobil filtr paneli").
 *
 * Every filter lives in the query string so results are shareable and survive reloads:
 *   q · kateqoriya · alt (sub-category slug) · seher (comma list) · min · max · nov (species slug)
 *   hundurluk ("80-200", "-80", "200-") · yas ("2-5") · vip=1 · catdirilma=1 · saticiNovu=biznes|ferdi
 *   siralama=ucuz|baha (default "Ən yenilər") · gorunus=siyahi (default grid)
 */
import { categoryById, productCategories } from '@/data/categories'
import { cities, cityName } from '@/data/cities'
import { formatNumber } from '@/lib/format'
import { searchListings, type ListingFilters, type ListingSort } from '@/services/marketplace'
import type { Listing } from '@/types'
import { speciesLabel, speciesSlug, subcategoryName, slugify } from './taxonomy'

export type SellerTypeParam = '' | 'biznes' | 'ferdi'
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

/* ---------- Range presets ("Hündürlük seçin" / "Yaş seçin") ---------- */

export interface RangeOption {
  value: string
  label: string
}

/** "80–200 sm" is the Figma value; the other presets follow the same "A–B unit" pattern. */
export const heightPresets: RangeOption[] = [
  { value: '', label: 'Bütün hündürlüklər' },
  { value: '-80', label: '80 sm-dək' },
  { value: '80-200', label: '80–200 sm' },
  { value: '200-', label: '200 sm-dən' },
]

/** "2–5 yaş" is the Figma value. */
export const agePresets: RangeOption[] = [
  { value: '', label: 'Bütün yaşlar' },
  { value: '1-2', label: '1–2 yaş' },
  { value: '2-5', label: '2–5 yaş' },
  { value: '5-', label: '5 yaşdan' },
]

const RANGE_RE = /^(\d*)-(\d*)$/

export function parseRange(value: string): [number | undefined, number | undefined] {
  const m = RANGE_RE.exec(value)
  if (!m) return [undefined, undefined]
  return [m[1] ? Number(m[1]) : undefined, m[2] ? Number(m[2]) : undefined]
}

function rangeLabel(value: string, unit: 'sm' | 'yaş', presets: RangeOption[]): string {
  const preset = presets.find((p) => p.value === value)
  if (preset) return preset.label
  const [from, to] = parseRange(value)
  if (from != null && to != null) return `${from}–${to} ${unit}`
  if (from != null) return unit === 'sm' ? `${from} sm-dən` : `${from} yaşdan`
  return unit === 'sm' ? `${to} sm-dək` : `${to} yaşadək`
}

export const heightLabel = (value: string) => rangeLabel(value, 'sm', heightPresets)
export const ageLabel = (value: string) => rangeLabel(value, 'yaş', agePresets)

/** Adds a custom range coming from the URL (e.g. "hundurluk=100-150") to the preset list so the select can show it. */
export function withCustomRange(presets: RangeOption[], value: string, label: (v: string) => string): RangeOption[] {
  return !value || presets.some((p) => p.value === value) ? presets : [...presets, { value, label: label(value) }]
}

/* ---------- Seller type / sort ---------- */

export const sellerTypeOptions: Array<{ value: SellerTypeParam; label: string }> = [
  { value: '', label: 'Fərdi və biznes' },
  { value: 'biznes', label: 'Biznes' },
  { value: 'ferdi', label: 'Fərdi' },
]

const sortParam: Record<ListingSort, string> = { newest: '', 'price-asc': 'ucuz', 'price-desc': 'baha' }

export function parseSort(value: string | null): ListingSort {
  if (value === 'ucuz') return 'price-asc'
  if (value === 'baha') return 'price-desc'
  return 'newest'
}

/* ---------- Parsing / writing ---------- */

const isPrice = (v: string) => v !== '' && Number.isFinite(Number(v))

export function parseSearchState(params: URLSearchParams): SearchState {
  const categoryId = params.get('kateqoriya') ?? ''
  const category = productCategories.find((c) => c.id === categoryId)
  const sub = params.get('alt') ?? ''
  const cityIds = (params.get('seher') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => cities.some((c) => c.id === id))
  const min = (params.get('min') ?? '').trim()
  const max = (params.get('max') ?? '').trim()
  const range = (key: string) => {
    const v = (params.get(key) ?? '').trim()
    return RANGE_RE.test(v) && v !== '-' ? v : ''
  }
  const seller = params.get('saticiNovu')
  return {
    q: (params.get('q') ?? '').trim(),
    categoryId: category ? category.id : '',
    subcategory: category && subcategoryName(category.id, sub) ? sub : '',
    // Keep the Figma order of the city list ("Bakı, Abşeron") regardless of the order in the URL.
    cityIds: cities.map((c) => c.id).filter((id) => cityIds.includes(id)),
    min: isPrice(min) ? min : '',
    max: isPrice(max) ? max : '',
    species: speciesLabel(params.get('nov') ?? '') ? (params.get('nov') ?? '') : '',
    height: range('hundurluk'),
    age: range('yas'),
    vip: params.get('vip') === '1',
    delivery: params.get('catdirilma') === '1',
    sellerType: seller === 'biznes' || seller === 'ferdi' ? seller : '',
  }
}

/** Builds the query string for `state`, keeping the non-filter params (sort, view) from `current`. */
export function writeSearchState(state: SearchState, current: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams()
  const set = (key: string, value: string | false) => value && next.set(key, value)
  set('q', state.q.trim())
  set('kateqoriya', state.categoryId)
  set('alt', state.categoryId && state.subcategory)
  set('seher', state.cityIds.join(','))
  set('min', state.min.trim())
  set('max', state.max.trim())
  set('nov', state.species)
  set('hundurluk', state.height)
  set('yas', state.age)
  set('vip', state.vip && '1')
  set('catdirilma', state.delivery && '1')
  set('saticiNovu', state.sellerType)
  set('siralama', current.get('siralama') ?? '')
  set('gorunus', current.get('gorunus') ?? '')
  return next
}

export function withSort(current: URLSearchParams, sort: ListingSort): URLSearchParams {
  const next = new URLSearchParams(current)
  if (sortParam[sort]) next.set('siralama', sortParam[sort])
  else next.delete('siralama')
  return next
}

export function withView(current: URLSearchParams, view: SearchView): URLSearchParams {
  const next = new URLSearchParams(current)
  if (view === 'list') next.set('gorunus', 'siyahi')
  else next.delete('gorunus')
  return next
}

/* ---------- Validation / querying ---------- */

/** Same messages as the home hero search ("Qiymət sıfırdan az ola bilməz." is the Figma error copy). */
export function priceError(state: Pick<SearchState, 'min' | 'max'>): string | undefined {
  const min = state.min.trim() === '' ? undefined : Number(state.min)
  const max = state.max.trim() === '' ? undefined : Number(state.max)
  if ((min != null && min < 0) || (max != null && max < 0)) return 'Qiymət sıfırdan az ola bilməz.'
  if (min != null && max != null && min > max) return 'Minimum qiymət maksimumdan böyük ola bilməz.'
  return undefined
}

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
  if (category) return `Bağınız üçün ${category.name.toLocaleLowerCase('az')}`
  if (state.vip) return 'VIP elanlar'
  if (state.q) return 'Axtarış nəticələri'
  return 'Bütün elanlar'
}

/** "Seçiminizə uyğun 6 elan tapıldı" */
export function resultSummary(count: number): string {
  return count ? `Seçiminizə uyğun ${formatNumber(count)} elan tapıldı` : 'Seçiminizə uyğun elan tapılmadı'
}

/** "6 elan · çatdırılma ilə" */
export function resultCountLabel(count: number, state: SearchState): string {
  return `${formatNumber(count)} elan${state.delivery ? ' · çatdırılma ilə' : ''}`
}

export function priceLabel(min: string, max: string): string | undefined {
  const a = min.trim()
  const b = max.trim()
  if (a && b) return `${formatNumber(Number(a))}–${formatNumber(Number(b))} ₼`
  if (a) return `${formatNumber(Number(a))} ₼-dən`
  if (b) return `${formatNumber(Number(b))} ₼-dək`
  return undefined
}

export interface FilterChip {
  key: string
  label: string
  /** State after removing this chip. */
  without: SearchState
}

/** Chips shown above the results ("Ağaclar ×", "Bakı, Abşeron ×", "30–180 ₼ ×"). Delivery is reported in the count line instead, as in Figma. */
export function activeChips(state: SearchState): FilterChip[] {
  const chips: FilterChip[] = []
  const push = (key: string, label: string | undefined, without: Partial<SearchState>) =>
    label && chips.push({ key, label, without: { ...state, ...without } })

  push('q', state.q && `“${state.q}”`, { q: '' })
  push('category', categoryById(state.categoryId)?.name, { categoryId: '', subcategory: '', species: '' })
  push('subcategory', state.subcategory && subcategoryName(state.categoryId, state.subcategory), { subcategory: '' })
  push('city', state.cityIds.map(cityName).join(', '), { cityIds: [] })
  push('price', priceLabel(state.min, state.max), { min: '', max: '' })
  push('species', state.species && speciesLabel(state.species), { species: '' })
  push('height', state.height && heightLabel(state.height), { height: '' })
  push('age', state.age && ageLabel(state.age), { age: '' })
  push('vip', state.vip ? 'VIP elanlar' : undefined, { vip: false })
  push('seller', state.sellerType === 'biznes' ? 'Biznes satıcılar' : state.sellerType === 'ferdi' ? 'Fərdi satıcılar' : undefined, {
    sellerType: '',
  })
  return chips
}

export function activeFilterCount(state: SearchState): number {
  return activeChips(state).length + (state.delivery ? 1 : 0)
}
