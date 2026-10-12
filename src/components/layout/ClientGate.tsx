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
 * `localStorage` (demo session, favourites, wizard draft): until then the server HTML shows `fallback`, a loading
 * skeleton shaped like the page (see SessionFallback for frames that differ for guests). These pages are `noindex`,
 * so nothing is lost for SEO.
 */
export function ClientGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return useHydrated() ? children : fallback
}
