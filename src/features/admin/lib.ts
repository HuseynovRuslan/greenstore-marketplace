import { useEffect, useState } from 'react'

/* ------------------------------------------------------------------ */
/* Session state for the admin screens                                   */
/* ------------------------------------------------------------------ */

const sessionCache = new Map<string, unknown>()

/**
 * useState that survives switching between the admin tabs (the pages unmount on navigation) but resets on a full
 * reload, so the demo always starts from the Figma state. Decisions about the user's own wizard listings are
 * persisted separately through `useMyListings().updateListing`.
 */
export function useAdminState<T>(key: string, init: () => T) {
  const [value, setValue] = useState<T>(() => (sessionCache.has(key) ? (sessionCache.get(key) as T) : init()))
  useEffect(() => {
    sessionCache.set(key, value)
  }, [key, value])
  return [value, setValue] as const
}

export { chipClass, formatQueueTime, historyTimestamp, localIsoNow, revealWhenStacked, rowClass } from './format'
