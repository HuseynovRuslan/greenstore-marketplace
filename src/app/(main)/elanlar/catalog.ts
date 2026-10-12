import { cache } from 'react'
import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { parseSearchState, parseSort, resultSummary, searchHeading, type SearchState, type SearchView } from '@/features/search/searchState'
import { getRepository } from '@/services/repository'
import { CATALOG_PAGE_SIZE, parsePage } from '@/seo/catalog'
import { describe } from '@/seo/metadata'
import { SITE_DESCRIPTION } from '@/seo/site'

/**
 * Loads one catalogue page (shared by /elanlar and the category pages, and by their `generateMetadata`; `cache`
 * runs the query once per request). `stateQuery` holds every filter, `pageParam` the requested `sehife`.
 */
export const loadCatalog = cache(async (stateQuery: string, pageParam: string | null) => {
  const params = new URLSearchParams(stateQuery)
  const state = parseSearchState(params)
  const sort = parseSort(params.get('siralama'))
  const view: SearchView = params.get('gorunus') === 'siyahi' ? 'list' : 'grid'
  const requestedPage = parsePage(pageParam)
  const result = await getRepository().searchListings({ state, sort, page: requestedPage, pageSize: CATALOG_PAGE_SIZE })
  return { state, sort, view, result, requestedPage, outOfRange: requestedPage > result.pageCount }
})

/** Title and description of a catalogue page ("Bağınız üçün ağaclar", "Ağaclar · Bakı", page suffix). */
export function catalogCopy(state: SearchState, total: number, page: number, opts: { cityPage?: boolean } = {}) {
  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  const city = opts.cityPage && state.cityIds[0] ? cityName(state.cityIds[0]) : undefined
  const base = city && category ? `${category.name} · ${city}` : searchHeading(state)
  const title = page > 1 ? `${base} — səhifə ${page}` : base
  const lead = [category?.description, resultSummary(total)].filter(Boolean).join('. ')
  return { title, description: describe(`${lead}. ${SITE_DESCRIPTION}`) }
}
