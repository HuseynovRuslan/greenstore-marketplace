/**
 * Client-side query layer for the services catalogue ("Xidmətlər").
 * URL params: q · kateqoriya · erazi (city id; the home hero sends `seher`) · nov (sirketler|ustalar)
 *             · siralama (newest|price-asc|price-desc) · sehife · min/max (sent by the home hero, filter `priceFrom`).
 */
import { cities, cityName } from '@/data/cities'
import { categoryById } from '@/data/categories'
import { providerById, serviceCategories, services } from '@/data/services'
import { listingSortOptions, type ListingSort } from '@/services/marketplace'
import { normalizeSearch } from '@/lib/format'
import type { Service } from '@/types'

export type ServiceSort = ListingSort
export type ProviderTab = 'all' | 'sirketler' | 'ustalar'

/** Sort labels shared with the product search ("Ən yenilər" is the Figma default). */
export const serviceSortOptions = listingSortOptions

export const providerTabs: Array<{ value: ProviderTab; label: string }> = [
  { value: 'all', label: 'Bütün xidmətlər' },
  { value: 'sirketler', label: 'Təsdiqlənmiş şirkətlər' },
  { value: 'ustalar', label: 'Fərdi ustalar' },
]

/** Umbrella category on the home page ("Landşaft və bağçılıq xidmətləri · 252 elan"). */
const UMBRELLA_CATEGORY = 'landsaft-xidmetleri'

/** Platform-wide number of service listings shown in Figma ("252 xidmət elanı"). */
export const platformServiceTotal = categoryById(UMBRELLA_CATEGORY)?.listingCount ?? services.length

export const SERVICES_PAGE_SIZE = 6

export interface ServiceFilters {
  q: string
  categoryId?: string
  cityId?: string
  tab: ProviderTab
  minPrice?: number
  maxPrice?: number
}

export interface ServiceQuery extends ServiceFilters {
  sort: ServiceSort
  page: number
}

const sortValues = new Set<string>(serviceSortOptions.map((o) => o.value))
const tabValues = new Set<string>(providerTabs.map((t) => t.value))
const categoryIds = new Set(serviceCategories.map((c) => c.id))
const cityIds = new Set(cities.map((c) => c.id))

function toNumber(value: string | null): number | undefined {
  if (value == null || value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Reads the catalogue state from the URL, ignoring unknown values. */
export function parseServiceQuery(params: URLSearchParams): ServiceQuery {
  const category = params.get('kateqoriya') ?? ''
  const city = params.get('erazi') ?? params.get('seher')?.split(',')[0] ?? ''
  const tab = params.get('nov') ?? 'all'
  const sort = params.get('siralama') ?? 'newest'
  const page = Math.floor(Number(params.get('sehife') ?? '1'))
  return {
    q: params.get('q')?.trim() ?? '',
    categoryId: categoryIds.has(category) ? category : undefined,
    cityId: cityIds.has(city) ? city : undefined,
    tab: tabValues.has(tab) ? (tab as ProviderTab) : 'all',
    minPrice: toNumber(params.get('min')),
    maxPrice: toNumber(params.get('max')),
    sort: sortValues.has(sort) ? (sort as ServiceSort) : 'newest',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

export function hasActiveFilters(f: ServiceFilters): boolean {
  return Boolean(f.q || f.categoryId || f.cityId || f.tab !== 'all' || f.minPrice != null || f.maxPrice != null)
}

function searchText(service: Service): string {
  const provider = providerById(service.providerId)
  const category = serviceCategories.find((c) => c.id === service.categoryId)
  return normalizeSearch(
    [
      service.title,
      service.homeTitle ?? '',
      provider?.name ?? '',
      category?.name ?? '',
      ...service.areas,
      ...(service.description ?? []),
      ...(service.includes ?? []),
    ].join(' '),
  )
}

export function filterServices(source: Service[], f: ServiceFilters): Service[] {
  const words = normalizeSearch(f.q).split(/\s+/).filter(Boolean)
  const area = f.cityId ? cityName(f.cityId) : undefined
  return source.filter((s) => {
    if (words.length) {
      const haystack = searchText(s)
      if (!words.every((w) => haystack.includes(w))) return false
    }
    if (f.categoryId && s.categoryId !== f.categoryId) return false
    if (area && !s.areas.includes(area)) return false
    if (f.tab !== 'all') {
      const provider = providerById(s.providerId)
      if (f.tab === 'sirketler' && !(provider?.verified && provider.kind === 'company')) return false
      if (f.tab === 'ustalar' && provider?.kind !== 'individual') return false
    }
    if (f.minPrice != null || f.maxPrice != null) {
      if (s.priceFrom == null) return false
      if (f.minPrice != null && s.priceFrom < f.minPrice) return false
      if (f.maxPrice != null && s.priceFrom > f.maxPrice) return false
    }
    return true
  })
}

/** "Ən yenilər" keeps the publication order of the data (Figma grid order); price sorts use `priceFrom`,
 *  services priced "Razılaşma yolu ilə" (no `priceFrom`) go last. */
export function sortServices(source: Service[], sort: ServiceSort): Service[] {
  if (sort === 'newest') return [...source]
  const dir = sort === 'price-asc' ? 1 : -1
  return [...source].sort((a, b) => {
    if (a.priceFrom == null && b.priceFrom == null) return 0
    if (a.priceFrom == null) return 1
    if (b.priceFrom == null) return -1
    return (a.priceFrom - b.priceFrom) * dir
  })
}

export interface Page<T> {
  items: T[]
  page: number
  pageCount: number
}

export function paginate<T>(items: T[], page: number, size = SERVICES_PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { items: items.slice((current - 1) * size, current * size), page: current, pageCount }
}

/** Page numbers shown in "Səhifələmə": a window of up to 3 pages around the current one (Figma: "1 2 3 Növbəti"). */
export function pageWindow(page: number, pageCount: number, size = 3): number[] {
  const count = Math.min(size, pageCount)
  const start = Math.min(Math.max(1, page - 1), pageCount - count + 1)
  return Array.from({ length: count }, (_, i) => start + i)
}

export function searchServices(query: ServiceQuery) {
  const filtered = sortServices(filterServices(services, query), query.sort)
  const active = hasActiveFilters(query)
  return {
    ...paginate(filtered, query.page),
    total: filtered.length,
    /** Count label: platform total from Figma while nothing is filtered, the real match count otherwise. */
    displayTotal: active ? filtered.length : Math.max(platformServiceTotal, filtered.length),
    active,
  }
}
