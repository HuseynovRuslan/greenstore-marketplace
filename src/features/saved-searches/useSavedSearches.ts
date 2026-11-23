'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { currentUser, DEMO_SAVED_SEARCHES } from '@/data/user'
import { useSession } from '@/state/store'
import type { SavedSearch, SavedSearchInput, UserProfile } from '@/types'
import { deleteSavedSearch, listSavedSearches, openSavedSearch, saveSearch, updateSavedSearch } from './actions'
import { filterQuery, MAX_SAVED_SEARCHES } from './query'

/*
 * «Axtarışı yadda saxla» (Nov 2026): a named catalogue search with optional alerts.
 * - DATA_SOURCE=mock (DEMO): saved searches live in this browser, one list per account. The demo account starts with
 *   two, so the cabinet page shows what it looks like.
 * - DATA_SOURCE=api: the account's list is the API's (backend-contract.md 2.3; it counts `newCount`). Changes show at
 *   once and are sent to the server; one that fails reloads the list from it.
 */

export { filterQuery, MAX_SAVED_SEARCHES, searchSummary, suggestedName } from './query'

type Patch = Partial<Pick<SavedSearch, 'name' | 'alerts' | 'newCount'>>

export interface SavedSearchesValue {
  searches: SavedSearch[]
  save: (input: SavedSearchInput) => void
  update: (id: string, patch: Patch) => void
  remove: (id: string) => void
  find: (query: string) => SavedSearch | undefined
}

const keyFor = (userId: string) => `greenstore:saved-searches:${userId}`

/* ---------- DATA_SOURCE=api: one list per page, shared by every component that shows it ---------- */

interface RemoteState {
  userId: string | null
  searches: SavedSearch[]
}

let remote: RemoteState = { userId: null, searches: [] }
const listeners = new Set<() => void>()
const NO_SEARCHES: RemoteState = { userId: null, searches: [] }

function setRemote(next: RemoteState) {
  remote = next
  listeners.forEach((notify) => notify())
}

const subscribeRemote = (onChange: () => void) => {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/** Loads the account's list the first time a component of this account asks (and again after a failed change). */
function loadRemote(userId: string) {
  setRemote({ userId, searches: remote.userId === userId ? remote.searches : [] })
  listSavedSearches()
    .then((list) => {
      if (list && remote.userId === userId) setRemote({ userId, searches: list })
    })
    .catch(() => undefined)
}

function changeRemote(apply: (list: SavedSearch[]) => SavedSearch[]) {
  setRemote({ ...remote, searches: apply(remote.searches) })
}

/** After a change the server refused: its list is the truth. */
const resync = () => remote.userId && loadRemote(remote.userId)

/** Test hook: forget the API list (each test starts signed out). */
export function resetRemoteSavedSearches() {
  setRemote({ userId: null, searches: [] })
}

const remoteActions: Omit<SavedSearchesValue, 'searches' | 'find'> = {
  save(input) {
    const query = filterQuery(input.query)
    const temporary: SavedSearch = { id: `tmp-${Date.now().toString(36)}`, name: input.name.trim(), query, alerts: input.alerts, createdAt: new Date().toISOString(), newCount: 0 }
    changeRemote((list) => [temporary, ...list.filter((s) => s.query !== query)].slice(0, MAX_SAVED_SEARCHES))
    saveSearch({ ...input, query })
      .then((saved) => {
        if (!saved) return resync()
        changeRemote((list) => [saved, ...list.filter((s) => s.id !== temporary.id && s.id !== saved.id)])
      })
      .catch(resync)
  },
  update(id, patch) {
    changeRemote((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    const { newCount, ...rest } = patch
    if (newCount === 0) openSavedSearch(id).then((s) => s ?? resync(), resync)
    if (rest.name !== undefined || rest.alerts !== undefined) updateSavedSearch(id, rest).then((s) => s ?? resync(), resync)
  },
  remove(id) {
    changeRemote((list) => list.filter((s) => s.id !== id))
    deleteSavedSearch(id).then((ok) => ok || resync(), resync)
  },
}

function useRemoteSavedSearches(userId: string | null): RemoteState {
  useEffect(() => {
    if (userId && remote.userId !== userId) loadRemote(userId)
  }, [userId])
  const state = useSyncExternalStore(subscribeRemote, () => remote, () => NO_SEARCHES)
  return state.userId === userId ? state : NO_SEARCHES
}

/* ---------- Both ---------- */

export function useSavedSearches(user: UserProfile | null): SavedSearchesValue {
  const { source } = useSession()
  const api = source === 'api'
  const [local, setLocal] = useLocalStorage<SavedSearch[]>(keyFor(user?.id ?? 'guest'), user?.id === currentUser.id ? DEMO_SAVED_SEARCHES : [])
  const fromApi = useRemoteSavedSearches(api && user ? user.id : null)
  const searches = api ? fromApi.searches : local

  const save = useCallback(
    (input: SavedSearchInput) => {
      if (api) return remoteActions.save(input)
      const query = filterQuery(input.query)
      setLocal((prev) =>
        [{ id: `ss-${Date.now().toString(36)}`, name: input.name.trim(), query, alerts: input.alerts, createdAt: new Date().toISOString(), newCount: 0 }, ...prev.filter((s) => s.query !== query)].slice(
          0,
          MAX_SAVED_SEARCHES,
        ),
      )
    },
    [api, setLocal],
  )
  const update = useCallback(
    (id: string, patch: Patch) => (api ? remoteActions.update(id, patch) : setLocal((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))),
    [api, setLocal],
  )
  const remove = useCallback((id: string) => (api ? remoteActions.remove(id) : setLocal((prev) => prev.filter((s) => s.id !== id))), [api, setLocal])
  const find = useCallback((query: string) => searches.find((s) => s.query === filterQuery(query)), [searches])

  return { searches, save, update, remove, find }
}
