'use server'

import { getRepository } from '@/services/repository'
import type { SavedSearch, SavedSearchInput } from '@/types'

/*
 * «Axtarışlarım» of the signed-in account (DATA_SOURCE=api; backend-contract.md 2.3). The session decides whose; the
 * API keeps at most 20 and counts the new matches (`newCount`). Each answers `null` when it did not work (the API
 * refused, the session ended): the page then keeps what it showed.
 */

const ID = /^[A-Za-z0-9-]{1,80}$/
const NAME_MAX = 60
const QUERY_MAX = 2000

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch {
    return null
  }
}

export async function listSavedSearches(): Promise<SavedSearch[] | null> {
  return attempt(() => getRepository().listSavedSearches())
}

export async function saveSearch(input: SavedSearchInput): Promise<SavedSearch | null> {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  const query = typeof input?.query === 'string' ? input.query : ''
  if (!name || name.length > NAME_MAX || query.length > QUERY_MAX) return null
  return attempt(() => getRepository().saveSearch({ name, query, alerts: Boolean(input.alerts) }))
}

export async function updateSavedSearch(id: string, patch: { name?: string; alerts?: boolean }): Promise<SavedSearch | null> {
  if (typeof id !== 'string' || !ID.test(id)) return null
  const name = typeof patch?.name === 'string' ? patch.name.trim() : undefined
  if (name !== undefined && (!name || name.length > NAME_MAX)) return null
  return attempt(() => getRepository().updateSavedSearch(id, { ...(name !== undefined ? { name } : {}), ...(typeof patch?.alerts === 'boolean' ? { alerts: patch.alerts } : {}) }))
}

export async function deleteSavedSearch(id: string): Promise<boolean> {
  if (typeof id !== 'string' || !ID.test(id)) return false
  return (await attempt(async () => (await getRepository().deleteSavedSearch(id), true))) ?? false
}

/** The visitor opened the search: its matches until now are no longer new. */
export async function openSavedSearch(id: string): Promise<SavedSearch | null> {
  if (typeof id !== 'string' || !ID.test(id)) return null
  return attempt(() => getRepository().markSavedSearchOpened(id))
}
