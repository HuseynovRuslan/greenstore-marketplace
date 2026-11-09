'use server'

import { getRepository } from '@/services/repository'
import { getCategoryFacets, type CategoryFacets } from './facets'
import { parseSearchState } from './searchState'

export interface SheetCounts extends CategoryFacets {
  /** «N elanı göstər» */
  total: number
}

const none: SheetCounts = { total: 0, categories: { all: 0, byId: {} }, subcategories: {} }

/**
 * Live counts for the «Filtrlər» sheet: «N elanı göstər» and the category accordion's numbers, for a draft filter
 * state given as the query string the catalogue would open. Public and read-only (the catalogue is public); the
 * query is parsed and validated like the page's own, and anything unusually long is refused.
 */
export async function countCatalog(query: string): Promise<SheetCounts> {
  if (typeof query !== 'string' || query.length > 1000) return none
  const state = parseSearchState(new URLSearchParams(query))
  const [result, facets] = await Promise.all([getRepository().searchListings({ state, sort: 'newest', page: 1, pageSize: 1 }), getCategoryFacets(state)])
  return { total: result.total, ...facets }
}
