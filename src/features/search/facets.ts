import { productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { getRepository } from '@/services/repository'
import { selectCategory, type SearchState } from './searchUrl'

export interface CategoryFacets {
  /** Per category for the current filters with the category set to it (`selectCategory`, what its row opens). */
  categories: { all: number; byId: Record<string, number> }
  /** Per sub-category id, every category's (the accordion shows any category's list). */
  subcategories: Record<string, number>
}

export interface FacetCounts extends CategoryFacets {
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

const subcategories = productCategories.flatMap((c) => c.subcategories.map((s) => ({ id: s.id, categoryId: c.id })))

/** The counts next to the category accordion's rows (sidebar and «Filtrlər» sheet). */
export async function getCategoryFacets(state: SearchState): Promise<CategoryFacets> {
  const [all, byId, bySub] = await Promise.all([
    count(selectCategory(state, '')),
    entries(productCategories, (c) => c.id, (c) => selectCategory(state, c.id)),
    entries(subcategories, (s) => s.id, (s) => selectCategory(state, s.categoryId, s.id)),
  ])
  return { categories: { all, byId }, subcategories: bySub }
}

/**
 * The counts next to the sidebar's categories and the search card's cities. Today they come from one
 * `searchListings` call per option (about 30 per page, cheap on the sample data); this is the one place to swap
 * for facet counts from the API once it has them (docs/handoff/elanlar.md).
 */
export async function getFacetCounts(state: SearchState): Promise<FacetCounts> {
  const [category, cityAll, byCity] = await Promise.all([
    getCategoryFacets(state),
    count({ ...state, cityIds: [] }),
    entries(cities, (c) => c.id, (c) => ({ ...state, cityIds: [c.id] })),
  ])
  return { ...category, cities: { all: cityAll, byCity } }
}

/** Listings left after removing each chip (the empty state's suggestions), keyed like the chips. */
export async function getRemovalCounts(chips: Array<{ key: string; without: SearchState }>): Promise<Record<string, number>> {
  return entries(chips, (chip) => chip.key, (chip) => chip.without)
}
