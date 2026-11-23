import { activeChips, parseSearchState, searchHeading } from '@/features/search/searchState'

/*
 * Saved-search queries, shared by the browser (useSavedSearches) and the server (the mock repository): a plain
 * module, so server code can call it (a 'use client' module's functions cannot run on the server).
 */

/** The most searches one account keeps; the oldest goes (the API's limit too). */
export const MAX_SAVED_SEARCHES = 20

/** The filters of a saved query as chip labels («Ağaclar», «Bakı», «50 ₼-a qədər»). */
export function searchSummary(query: string): string[] {
  const state = parseSearchState(new URLSearchParams(query))
  return activeChips(state).map((c) => c.label)
}

/** Suggested name: the catalogue heading plus what narrows it («Ağaclar · Bakı · 1–2 m»). */
export function suggestedName(query: string): string {
  const state = parseSearchState(new URLSearchParams(query))
  const heading = searchHeading(state)
  const extra = activeChips(state)
    .map((c) => c.label)
    .filter((l) => !heading.includes(l))
  return [heading, ...extra].join(' · ').slice(0, 60)
}

/** Only the filters: page, sort and view are not part of a saved search. */
export function filterQuery(query: string): string {
  const params = new URLSearchParams(query)
  for (const key of ['sehife', 'siralama', 'gorunus']) params.delete(key)
  params.sort()
  return params.toString()
}
