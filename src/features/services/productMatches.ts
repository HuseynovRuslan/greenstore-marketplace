import { parseSearchState } from '@/features/search/searchState'
import { getRepository } from '@/services/repository'

export interface ProductMatches {
  /** The search word, as typed. */
  q: string
  total: number
  /** /elanlar with the same word (and the city). */
  href: string
}

/**
 * Product listings that match a services search word, for the empty /xidmetler page: «zeytun» from the
 * «Xidmətlər» tab is a product, so the page points there instead of a dead end (the mirror of
 * features/search/serviceMatches.ts). Server only.
 */
export async function getProductMatches(q: string, cityId?: string): Promise<ProductMatches | undefined> {
  if (!q) return undefined
  const params = new URLSearchParams({ q })
  if (cityId) params.set('seher', cityId)
  const state = parseSearchState(params)
  const result = await getRepository().searchListings({ state, sort: 'newest', page: 1, pageSize: 1 })
  return result.total > 0 ? { q, total: result.total, href: `/elanlar?${params}` } : undefined
}
