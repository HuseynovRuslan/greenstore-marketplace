/**
 * Home hero search (docs/design/variant-2): tabs, filter definitions, chip labels and the URL the form opens.
 *
 * Options, labels and URL param names come from the filter model shared with the catalogue (search/filterDefs.ts):
 *   /elanlar   q · kateqoriya · seher · min · max · hundurluk (cm) · catdirilma=1
 *   /xidmetler q · kateqoriya (service category) · seher · min · max
 * Filters without a backend param are never sent (docs/handoff/categories.md, "Filters waiting for backend").
 */
import { listingTotals, productCategories } from '@/data/categories'
import { serviceCategories } from '@/data/services'
import { filterTitles, heightOptions, PARAM, priceValueLabel, toggleLabels, type FilterOption } from '@/features/search/filterDefs'

/**
 * Kök sistemi, Mövcudluq, Əkin daxil and Çatdırılma on services have no param yet, and the catalogue cannot show
 * them, so they are hidden until the backend confirms the params (the code stays). `true` shows them again.
 */
export const SHOW_PENDING_FILTERS = false

/* ---------- Tabs ---------- */

export type HeroTab = 'all' | 'products' | 'services'

/** The placeholder is an example only; the field keeps its visually hidden label «Axtarış sözü». */
export const heroTabs: Array<{ value: HeroTab; label: string; count: number; placeholder: string }> = [
  { value: 'all', label: 'Hamısı', count: listingTotals.all, placeholder: 'Məsələn, zeytun ağacı' },
  { value: 'products', label: 'Məhsullar', count: listingTotals.products, placeholder: 'Məsələn, zeytun ağacı' },
  { value: 'services', label: 'Xidmətlər', count: listingTotals.services, placeholder: 'Məsələn, çim salınması' },
]

/* ---------- Filters ---------- */

export interface HeroFilters {
  category: string
  /** Raw price inputs, digits only ('' = not set). */
  min: string
  max: string
  /** `hundurluk` value in cm, e.g. "100-200". */
  height: string
  root: string
  availability: string
  delivery: boolean
  planting: boolean
}

export const emptyHeroFilters: HeroFilters = {
  category: '',
  min: '',
  max: '',
  height: '',
  root: '',
  availability: '',
  delivery: false,
  planting: false,
}

export type ChoiceFilterId = 'category' | 'height' | 'root' | 'availability'
export type FilterId = ChoiceFilterId | 'price' | 'delivery' | 'planting'

interface FilterDef {
  id: FilterId
  label: string
  /** Popover heading and accessible name. */
  title: string
  kind: 'choice' | 'price' | 'toggle'
  /** Hidden on the services tab. */
  productsOnly?: boolean
  /** Tabs on which the catalogue has no param for it yet. */
  pendingOn?: HeroTab[]
}

const ALL_TABS: HeroTab[] = ['all', 'products', 'services']

export const heroFilterDefs: FilterDef[] = [
  { id: 'category', label: 'Kateqoriya', title: filterTitles.category, kind: 'choice' },
  { id: 'price', label: 'Qiymət', title: filterTitles.price, kind: 'price' },
  { id: 'height', label: 'Hündürlük', title: filterTitles.height, kind: 'choice', productsOnly: true },
  { id: 'root', label: 'Kök sistemi', title: 'Kök sistemi', kind: 'choice', productsOnly: true, pendingOn: ALL_TABS },
  { id: 'availability', label: 'Mövcudluq', title: 'Mövcudluq', kind: 'choice', pendingOn: ALL_TABS },
  { id: 'delivery', label: toggleLabels.delivery, title: toggleLabels.delivery, kind: 'toggle', pendingOn: ['services'] },
  { id: 'planting', label: 'Əkin daxil', title: 'Əkin daxil', kind: 'toggle', pendingOn: ALL_TABS },
]

/** Chips shown on a tab, in mockup order. */
export function visibleFilters(tab: HeroTab, showPending = SHOW_PENDING_FILTERS): FilterDef[] {
  return heroFilterDefs.filter((f) => !(f.productsOnly && tab === 'services') && (showPending || !f.pendingOn?.includes(tab)))
}

/** Pending: values proposed for the `kok` param. */
export const rootOptions: FilterOption[] = [
  { value: 'dibcek', label: 'Dibçəkdə' },
  { value: 'torpaq-kuresi', label: 'Torpaq kürəsi ilə' },
  { value: 'aciq-kok', label: 'Açıq kök' },
]

/** Pending: values proposed for the `movcudluq` param. */
export const availabilityOptions: FilterOption[] = [
  { value: 'satisda', label: 'Satışdadır' },
  { value: 'sifarisle', label: 'Sifarişlə' },
]

export function choiceOptions(id: ChoiceFilterId, tab: HeroTab): FilterOption[] {
  switch (id) {
    case 'category':
      return (tab === 'services' ? serviceCategories : productCategories).map((c) => ({ value: c.id, label: c.name }))
    case 'height':
      return heightOptions
    case 'root':
      return rootOptions
    case 'availability':
      return availabilityOptions
  }
}

/** The value part of a chip label ("Qiymət: 50–150 ₼"), or undefined when the filter is not set. */
export function filterValueLabel(id: FilterId, filters: HeroFilters, tab: HeroTab): string | undefined {
  if (id === 'price') return priceValueLabel(filters.min, filters.max)
  if (id === 'delivery' || id === 'planting') return undefined
  const value = filters[id]
  return value ? choiceOptions(id, tab).find((o) => o.value === value)?.label : undefined
}

export function isFilterSet(id: FilterId, filters: HeroFilters): boolean {
  if (id === 'price') return Boolean(filters.min || filters.max)
  return Boolean(filters[id])
}

/** Number of filters set among the chips visible on `tab` (the «Filtrlər» badge, «Sıfırla»). */
export function activeFilterCount(tab: HeroTab, filters: HeroFilters, showPending = SHOW_PENDING_FILTERS): number {
  return visibleFilters(tab, showPending).filter((f) => isFilterSet(f.id, filters)).length
}

/** Switching tabs drops what the new tab cannot show (product-only filters, a category from the other list). */
export function filtersForTab(tab: HeroTab, filters: HeroFilters, showPending = SHOW_PENDING_FILTERS): HeroFilters {
  const visible = new Set(visibleFilters(tab, showPending).map((f) => f.id))
  const next = { ...filters }
  if (!visible.has('height')) next.height = ''
  if (!visible.has('root')) next.root = ''
  if (!visible.has('availability')) next.availability = ''
  if (!visible.has('delivery')) next.delivery = false
  if (!visible.has('planting')) next.planting = false
  if (next.category && !choiceOptions('category', tab).some((o) => o.value === next.category)) next.category = ''
  return next
}

/* ---------- URL ---------- */

export interface HeroSearchInput {
  tab: HeroTab
  q: string
  city: string
  filters: HeroFilters
}

/**
 * The catalogue URL for a search. «Hamısı» has no combined results page yet, so it opens /elanlar like «Məhsullar».
 * Pending filters are never sent.
 */
export function heroSearchUrl({ tab, q, city, filters }: HeroSearchInput): string {
  const services = tab === 'services'
  const params = new URLSearchParams()
  const set = (key: string, value: string | false) => value && params.set(key, value)
  set(PARAM.q, q.trim())
  set(PARAM.category, filters.category)
  set(PARAM.city, city)
  set(PARAM.min, filters.min)
  set(PARAM.max, filters.max)
  if (!services) {
    set(PARAM.height, filters.height)
    set(PARAM.delivery, filters.delivery && '1')
  }
  const base = services ? '/xidmetler' : '/elanlar'
  return params.size ? `${base}?${params}` : base
}
