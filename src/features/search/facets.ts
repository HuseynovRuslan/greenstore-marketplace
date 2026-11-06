import { productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { getRepository } from '@/services/repository'
import type { SearchState } from './searchUrl'
import { subcategoryOptions } from './taxonomy'

export interface FacetCounts {
  /** Per category for the current filters with the category (and its sub-category and species) set to it. */
  categories: { all: number; byId: Record<string, number> }
  /** Per sub-category slug of the chosen category. */
  subcategories: Record<string, number>
  /** Per city for the current filters with the city set to it. */
  cities: { all: number; byCity: Record<string, number> }
}

/** Number of listings for a filter state (one page of one result; only the total is used). */
async function count(state: SearchState): Promise<number> {
  const result = await getRepository().searchListings({ state, sort: 'newest', page: 1, pageSize: 1 })
  return result.total
}

const entries = async <T,>(items: T[], key: (item: T) => string, state: (item: T) => SearchState) =>
  Object.fromEntries(await Promise.all(items.map(async (item) => [key(item), await count(state(item))] as const)))

/**
 * The counts next to the sidebar's categories and the search card's cities. Today they come from one
 * `searchListings` call per option (about 20 per page, cheap on the sample data); this is the one place to swap
 * for facet counts from the API once it has them (docs/handoff/elanlar.md).
 */
export async function getFacetCounts(state: SearchState): Promise<FacetCounts> {
  const noCategory = { ...state, categoryId: '', subcategory: '', species: '' }
  const [categoryAll, byId, subcategories, cityAll, byCity] = await Promise.all([
    count(noCategory),
    entries(productCategories, (c) => c.id, (c) => ({ ...noCategory, categoryId: c.id })),
    state.categoryId
      ? entries(subcategoryOptions(state.categoryId), (o) => o.value, (o) => ({ ...state, subcategory: o.value }))
      : Promise.resolve({}),
    count({ ...state, cityIds: [] }),
    entries(cities, (c) => c.id, (c) => ({ ...state, cityIds: [c.id] })),
  ])
  return { categories: { all: categoryAll, byId }, subcategories, cities: { all: cityAll, byCity } }
}

/** Listings left after removing each chip (the empty state's suggestions), keyed like the chips. */
export async function getRemovalCounts(chips: Array<{ key: string; without: SearchState }>): Promise<Record<string, number>> {
  return entries(chips, (chip) => chip.key, (chip) => chip.without)
}
