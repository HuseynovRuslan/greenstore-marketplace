'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { useSessionStatus } from '@/state/store'

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
 * Whether React knows the session: hydrated, and (DATA_SOURCE=api) the server has said who is signed in. Until then
 * session-dependent UI renders both variants and CSS shows the one the pre-hydration script chose (bootstrap.ts).
 */
export function useSessionKnown(): boolean {
  const hydrated = useHydrated()
  const status = useSessionStatus()
  return hydrated && status === 'ready'
}

/**
 * Renders `children` only in the browser, once the session is known. Used for the private pages whose content depends
 * on the session and browser storage (session, favourites, wizard draft): until then the server HTML shows
 * `fallback`, a loading skeleton shaped like the page (see SessionFallback for frames that differ for guests). These
 * pages are `noindex`, so nothing is lost for SEO.
 */
export function ClientGate({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return useSessionKnown() ? children : fallback
}
