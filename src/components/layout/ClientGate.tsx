'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

const subscribe = () => () => {}

/** false during server rendering and hydration, true afterwards (and immediately on client-side navigations). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

/**
 * Renders `children` only in the browser. Used for the private pages whose content depends entirely on
 * `localStorage` (demo session, favourites, wizard draft): the server sends an empty frame instead of guessing a
 * signed-out state that would flash and then change. These pages are `noindex`, so nothing is lost for SEO.
 */
export function ClientGate({ children }: { children: ReactNode }) {
  return useHydrated() ? children : <div aria-busy="true" className="min-h-[60vh] w-full" />
}
