import { parseServiceQuery } from '@/features/services/query'
import { getRepository } from '@/services/repository'
import type { SearchState } from './searchUrl'

export interface ServiceMatches {
  /** The search word, as typed. */
  q: string
  total: number
  /** /xidmetler with the same word (and the city, when one is chosen). */
  href: string
}

/**
 * Services that match the catalogue's search word, so a product search can point to them: «Hamısı» on the home
 * page opens /elanlar, and a word like «qazon» is a service, not a product. Only the word and a single city carry
 * over; the product filters mean nothing for services. Server only (reads the repository).
 */
export async function getServiceMatches(state: SearchState): Promise<ServiceMatches | undefined> {
  if (!state.q) return undefined
  const params = new URLSearchParams({ q: state.q })
  if (state.cityIds.length === 1) params.set('erazi', state.cityIds[0])
  const result = await getRepository().searchServices(parseServiceQuery(params))
  return result.total > 0 ? { q: state.q, total: result.total, href: `/xidmetler?${params}` } : undefined
}
