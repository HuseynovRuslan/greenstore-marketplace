'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { readStored, useLocalStorage, writeStored } from '@/hooks/useLocalStorage'
import { ACCOUNT_FAVORITES_KEY, GUEST_FAVORITES_KEY, readSessionHint, SESSION_KEY } from './bootstrap'
import { currentUser, DEMO_ACCOUNT_FAVORITES, type AccountProfile, type NotificationSettings } from '@/data/user'
import { loadSession, mergeFavorites, setFavorite, signOut as signOutAction, type SessionState } from '@/features/account/actions'
import type { DataSource } from '@/seo/env'
import type { Listing, UserProfile } from '@/types'

/*
 * The visitor's session, favourites and locally sent listings. Two implementations behind the same hooks, chosen once
 * by the deployment's data source (the root layout passes it):
 * - DATA_SOURCE=mock (DEMO ONLY, src/config/demo.ts): everything lives in this browser's localStorage, as before.
 * - DATA_SOURCE=api: the session is the httpOnly cookie on the server (src/services/session.ts). After hydration the
 *   store asks the server who is signed in (loadSession) when the `gs_hint` cookie says someone is, and keeps the
 *   account in memory; favourites of a signed-in visitor are the API's. Guests keep theirs in localStorage, and they
 *   join the account's on sign-in.
 */

/* ------------------------------------------------------------------ */
/* Favorites ("Seçilmişlər") — listings and services                    */
/* ------------------------------------------------------------------ */

export type FavoriteKind = 'listing' | 'service'
const favKey = (kind: FavoriteKind, id: string) => `${kind}:${id}`

interface FavoritesValue {
  favorites: string[]
  isFavorite: (kind: FavoriteKind, id: string) => boolean
  toggleFavorite: (kind: FavoriteKind, id: string) => void
  favoriteIds: (kind: FavoriteKind) => string[]
}

const FavoritesContext = createContext<FavoritesValue | null>(null)

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

interface SessionValue {
  user: UserProfile | null
  /**
   * `loading` while the server is asked who is signed in (DATA_SOURCE=api, right after the page loads); the mock knows
   * at once. Until `ready`, components show what the pre-hydration script decided (see useSessionKnown).
   */
  status: 'loading' | 'ready'
  source: DataSource
  /**
   * Mock: signs in the demo account, with `patch` laid over it (the e-mail typed at sign-in, or a whole new profile
   * after registration — pass `sellerId: undefined` for an account without a seller page).
   * API: the account a sign-in action answered with (it has set the session cookie already).
   */
  signIn: (patch?: Partial<AccountProfile>) => void
  signOut: () => Promise<void>
  updateProfile: (patch: Partial<AccountProfile>) => void
}

const SessionContext = createContext<SessionValue | null>(null)

/* ------------------------------------------------------------------ */
/* Listings created through "Elan yerləşdir" (kept locally, pending)    */
/* ------------------------------------------------------------------ */

interface MyListingsValue {
  submitted: Listing[]
  addListing: (listing: Listing) => void
  updateListing: (id: string, patch: Partial<Listing>) => void
  removeListing: (id: string) => void
}

const MyListingsContext = createContext<MyListingsValue | null>(null)

function useFavoriteHelpers(favorites: string[], toggle: (key: string, kind: FavoriteKind, id: string) => void): FavoritesValue {
  const isFavorite = useCallback((kind: FavoriteKind, id: string) => favorites.includes(favKey(kind, id)), [favorites])
  const toggleFavorite = useCallback((kind: FavoriteKind, id: string) => toggle(favKey(kind, id), kind, id), [toggle])
  const favoriteIds = useCallback(
    (kind: FavoriteKind) => favorites.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1)),
    [favorites],
  )
  return useMemo(() => ({ favorites, isFavorite, toggleFavorite, favoriteIds }), [favorites, isFavorite, toggleFavorite, favoriteIds])
}

const toggled = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key])

export function AppStoreProvider({ children, dataSource = 'mock' }: { children: ReactNode; dataSource?: DataSource }) {
  const [submitted, setSubmitted] = useLocalStorage<Listing[]>('greenstore:my-listings', [])
  const listingsValue = useMemo<MyListingsValue>(
    () => ({
      submitted,
      addListing: (listing) => setSubmitted((prev) => [listing, ...prev.filter((l) => l.id !== listing.id)]),
      updateListing: (id, patch) => setSubmitted((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
      removeListing: (id) => setSubmitted((prev) => prev.filter((l) => l.id !== id)),
    }),
    [submitted, setSubmitted],
  )
  const Session = dataSource === 'api' ? ApiSession : MockSession
  return (
    <Session>
      <MyListingsContext.Provider value={listingsValue}>{children}</MyListingsContext.Provider>
    </Session>
  )
}

/** DEMO ONLY — mock session, no backend; see src/config/demo.ts. */
function MockSession({ children }: { children: ReactNode }) {
  const [user, setUser] = useLocalStorage<UserProfile | null>(SESSION_KEY, null)
  // Guests start with an empty list (home/search frames show no saved hearts). The demo account
  // gets the five items saved in Figma "Seçilmişlər · 390" — as if loaded from the server on sign-in.
  const [guestFavorites, setGuestFavorites] = useLocalStorage<string[]>(GUEST_FAVORITES_KEY, [])
  const [accountFavorites, setAccountFavorites] = useLocalStorage<string[]>(ACCOUNT_FAVORITES_KEY, DEMO_ACCOUNT_FAVORITES)
  const favorites = user ? accountFavorites : guestFavorites
  const setFavorites = user ? setAccountFavorites : setGuestFavorites
  const toggle = useCallback((key: string) => setFavorites((prev) => toggled(prev, key)), [setFavorites])
  const favValue = useFavoriteHelpers(favorites, toggle)

  const sessionValue = useMemo<SessionValue>(
    () => ({
      user,
      status: 'ready',
      source: 'mock',
      signIn: (patch) => setUser({ ...currentUser, ...patch }),
      signOut: async () => setUser(null),
      updateProfile: (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev)),
    }),
    [user, setUser],
  )

  return (
    <SessionContext.Provider value={sessionValue}>
      <FavoritesContext.Provider value={favValue}>{children}</FavoritesContext.Provider>
    </SessionContext.Provider>
  )
}

/** The notification switches of /kabinet/profil have no API column yet: kept per account in this browser. */
const notificationsKey = (userId: string) => `greenstore:notifications:${userId}`

/** DATA_SOURCE=api: how long the store waits before asking again when the API could not be asked (then every 30 s). */
const UNAVAILABLE_RETRY_MS = [3_000, 10_000, 30_000]

const subscribeNever = () => () => {}
const hasSessionHint = () => Boolean(readSessionHint())

/** DATA_SOURCE=api: the session is the server's (see the top of this file). */
function ApiSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ status: 'loading' | 'ready'; user: AccountProfile | null }>({ status: 'loading', user: null })
  const [guestFavorites, setGuestFavorites] = useLocalStorage<string[]>(GUEST_FAVORITES_KEY, [])
  const [accountFavorites, setAccountFavorites] = useState<string[]>([])
  const user = session.user
  // Each sign-in (or sign-out) gets a number, so an answer that arrives after the next one is ignored.
  const generation = useRef(0)

  const adopt = useCallback((account: AccountProfile | null) => {
    const notifications = account ? readStored<NotificationSettings | undefined>(notificationsKey(account.id), undefined) : undefined
    setSession({ status: 'ready', user: account && (notifications ? { ...account, notifications } : account) })
  }, [])

  // The hint cookie, read in the browser only: `null` while server-rendering and hydrating (nothing known yet).
  const hinted = useSyncExternalStore(subscribeNever, hasSessionHint, () => null)
  // Known once the server has answered or a sign-in / sign-out decided; without a hint the visitor is a guest at once.
  const status = session.status === 'ready' || hinted === false ? 'ready' : 'loading'

  useEffect(() => {
    // No hint: a guest, nothing to ask the server.
    if (!readSessionHint()) return
    const mine = ++generation.current
    let timer: number | undefined
    const ask = (attempt: number) => {
      // A sign-in or sign-out since has decided already.
      if (mine !== generation.current) return
      loadSession()
        // The action itself could not be reached (the site's server, the network): as if the API could not be.
        .catch((): SessionState => ({ account: null, favorites: [], unavailable: true }))
        .then((state) => {
          if (mine !== generation.current) return
          // The API could not be asked: the hint stays (a signed-in visitor is not shown as a guest) and the store
          // asks again a little later. Only an answer from the API decides who is signed in.
          if (state.unavailable) {
            const delay = UNAVAILABLE_RETRY_MS[Math.min(attempt, UNAVAILABLE_RETRY_MS.length - 1)]
            timer = window.setTimeout(() => ask(attempt + 1), delay)
            return
          }
          adopt(state.account)
          setAccountFavorites(state.favorites)
        })
    }
    ask(0)
    return () => window.clearTimeout(timer)
  }, [adopt])

  const toggle = useCallback(
    (key: string, kind: FavoriteKind, id: string) => {
      if (!user) return setGuestFavorites((prev) => toggled(prev, key))
      const on = !accountFavorites.includes(key)
      setAccountFavorites((prev) => toggled(prev, key))
      // Not saved (refused, or the server could not be reached): the heart goes back.
      const undo = () => setAccountFavorites((prev) => (prev.includes(key) === on ? toggled(prev, key) : prev))
      setFavorite(kind, id, on).then((result) => {
        if (result.ok) return
        undo()
        // An ended session makes the visitor a guest.
        if (result.signedOut) {
          generation.current++
          setSession({ status: 'ready', user: null })
        }
      }, undo)
    },
    [user, accountFavorites, setGuestFavorites],
  )
  const favValue = useFavoriteHelpers(user ? accountFavorites : guestFavorites, toggle)

  const sessionValue = useMemo<SessionValue>(
    () => ({
      user,
      status,
      source: 'api',
      signIn: (account) => {
        const mine = ++generation.current
        if (account?.id && account.fullName !== undefined) adopt(account as AccountProfile)
        else
          loadSession()
            .then((state) => {
              if (mine === generation.current && !state.unavailable) adopt(state.account)
            })
            .catch(() => undefined)
        // The guest's hearts join the account's (backend-contract.md 2.3), then the browser's list is emptied.
        const guest = readStored<string[]>(GUEST_FAVORITES_KEY, [])
        mergeFavorites(guest)
          .then((result) => {
            if (!result.ok || mine !== generation.current) return
            setAccountFavorites(result.favorites)
            if (guest.length) writeStored(GUEST_FAVORITES_KEY, [])
          })
          // Not merged: the guest list stays in this browser for the next sign-in.
          .catch(() => undefined)
      },
      signOut: async () => {
        generation.current++
        setSession({ status: 'ready', user: null })
        setAccountFavorites([])
        await signOutAction().catch(() => undefined)
      },
      updateProfile: (patch) => {
        if (patch.notifications && user) writeStored(notificationsKey(user.id), patch.notifications)
        setSession((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev))
      },
    }),
    [user, status, adopt],
  )

  return (
    <SessionContext.Provider value={sessionValue}>
      <FavoritesContext.Provider value={favValue}>{children}</FavoritesContext.Provider>
    </SessionContext.Provider>
  )
}

function useRequired<T>(ctx: T | null, name: string): T {
  if (!ctx) throw new Error(`${name} must be used inside <AppStoreProvider>`)
  return ctx
}

export const useFavorites = () => useRequired(useContext(FavoritesContext), 'useFavorites')
export const useSession = () => useRequired(useContext(SessionContext), 'useSession')
export const useMyListings = () => useRequired(useContext(MyListingsContext), 'useMyListings')

/** The session's status outside the provider too (components rendered on their own in tests): `ready` there. */
export function useSessionStatus(): SessionValue['status'] {
  return useContext(SessionContext)?.status ?? 'ready'
}

/** The deployment's data source outside the provider too (components rendered on their own in tests): `mock` there. */
export function useDataSource(): DataSource {
  return useContext(SessionContext)?.source ?? 'mock'
}
