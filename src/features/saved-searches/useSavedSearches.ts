'use client'

import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { activeChips, parseSearchState, searchHeading } from '@/features/search/searchState'
import { currentUser } from '@/data/user'
import type { SavedSearch, UserProfile } from '@/types'

/*
 * «Axtarışı yadda saxla» (Nov 2026). DEMO: saved searches live in this browser, one list per account; the API would
 * keep them and send the alerts (SavedSearch in src/types, docs/handoff/contract-additions.md). The demo account
 * starts with two, so the cabinet page shows what it looks like.
 */

export const MAX_SAVED_SEARCHES = 20
const keyFor = (userId: string) => `greenstore:saved-searches:${userId}`

const DEMO_SEARCHES: SavedSearch[] = [
  { id: 'ss-demo-1', name: 'Bakıda ağaclar', query: 'kateqoriya=agaclar&seher=baki', alerts: true, createdAt: '2026-10-20T09:00:00', newCount: 3 },
  { id: 'ss-demo-2', name: 'Tuya, 50 ₼-a qədər', query: 'q=tuya&max=50', alerts: false, createdAt: '2026-10-28T18:30:00', newCount: 0 },
]

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

export function useSavedSearches(user: UserProfile | null) {
  const [searches, setSearches] = useLocalStorage<SavedSearch[]>(keyFor(user?.id ?? 'guest'), user?.id === currentUser.id ? DEMO_SEARCHES : [])

  const save = useCallback(
    (input: { name: string; query: string; alerts: boolean }) => {
      const query = filterQuery(input.query)
      setSearches((prev) => [
        { id: `ss-${Date.now().toString(36)}`, name: input.name.trim(), query, alerts: input.alerts, createdAt: new Date().toISOString(), newCount: 0 },
        ...prev.filter((s) => s.query !== query),
      ].slice(0, MAX_SAVED_SEARCHES))
    },
    [setSearches],
  )
  const update = useCallback((id: string, patch: Partial<Pick<SavedSearch, 'name' | 'alerts' | 'newCount'>>) => setSearches((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s))), [setSearches])
  const remove = useCallback((id: string) => setSearches((prev) => prev.filter((s) => s.id !== id)), [setSearches])
  const find = useCallback((query: string) => searches.find((s) => s.query === filterQuery(query)), [searches])

  return { searches, save, update, remove, find }
}
