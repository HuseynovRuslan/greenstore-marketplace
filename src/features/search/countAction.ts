'use server'

import { getRepository } from '@/services/repository'
import { parseSearchState } from './searchState'

/**
 * Live count for the «Filtrlər» sheet's «N elanı göstər»: listings for a draft filter state, given as the query
 * string the catalogue would open. Public and read-only (the catalogue is public); the query is parsed and
 * validated like the page's own, and anything unusually long is refused.
 */
export async function countCatalog(query: string): Promise<number> {
  if (typeof query !== 'string' || query.length > 1000) return 0
  const state = parseSearchState(new URLSearchParams(query))
  const result = await getRepository().searchListings({ state, sort: 'newest', page: 1, pageSize: 1 })
  return result.total
}
