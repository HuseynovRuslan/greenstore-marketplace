import { getRepository, type FacetCounts } from '@/services/repository'
import type { SearchState } from './searchUrl'

export type { FacetCounts } from '@/services/repository'

/** The category accordion's part of the facet counts (sidebar and «Filtrlər» sheet). */
export type CategoryFacets = Pick<FacetCounts, 'categories' | 'subcategories'>

/**
 * The counts next to the sidebar's categories and the search card's cities: one repository call (GET
 * /listings/facets with the API; the mock counts each option).
 */
export async function getFacetCounts(state: SearchState): Promise<FacetCounts> {
  return getRepository().getFacetCounts(state)
}

/** The counts next to the category accordion's rows. */
export async function getCategoryFacets(state: SearchState): Promise<CategoryFacets> {
  const { categories, subcategories } = await getFacetCounts(state)
  return { categories, subcategories }
}

/** Listings left after removing each chip (the empty state's suggestions), keyed like the chips. */
export async function getRemovalCounts(chips: Array<{ key: string; without: SearchState }>): Promise<Record<string, number>> {
  const repo = getRepository()
  const counts = await Promise.all(
    chips.map(async (chip) => [chip.key, (await repo.searchListings({ state: chip.without, sort: 'newest', page: 1, pageSize: 1 })).total] as const),
  )
  return Object.fromEntries(counts)
}
