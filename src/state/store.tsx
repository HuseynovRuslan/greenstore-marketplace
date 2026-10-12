'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { ACCOUNT_FAVORITES_KEY, GUEST_FAVORITES_KEY, SESSION_KEY } from './bootstrap'
import { currentUser } from '@/data/user'
import type { Listing, UserProfile } from '@/types'

/* ------------------------------------------------------------------ */
/* Favorites ("Seçilmişlər") — listings and services                    */
/* ------------------------------------------------------------------ */

export type FavoriteKind = 'listing' | 'service'
const favKey = (kind: FavoriteKind, id: string) => `${kind}:${id}`

const ACCOUNT_FAVORITES = [
  'listing:terrakota-dibcek',
  'listing:monstera-deliciosa',
  'listing:mavi-kuknar',
  'listing:zeytun-agaci',
  'service:landsaft-dizayni',
]

interface FavoritesValue {
  favorites: string[]
  isFavorite: (kind: FavoriteKind, id: string) => boolean
  toggleFavorite: (kind: FavoriteKind, id: string) => void
  favoriteIds: (kind: FavoriteKind) => string[]
}

const FavoritesContext = createContext<FavoritesValue | null>(null)

/* ------------------------------------------------------------------ */
/* DEMO ONLY — mock session, no backend; see src/config/demo.ts        */
/* ------------------------------------------------------------------ */

interface SessionValue {
  user: UserProfile | null
  signIn: (email?: string) => void
  signOut: () => void
  updateProfile: (patch: Partial<UserProfile>) => void
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

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useLocalStorage<UserProfile | null>(SESSION_KEY, null)
  // Guests start with an empty list (home/search frames show no saved hearts). The demo account
  // gets the five items saved in Figma "Seçilmişlər · 390" — as if loaded from the server on sign-in.
  const [guestFavorites, setGuestFavorites] = useLocalStorage<string[]>(GUEST_FAVORITES_KEY, [])
  const [accountFavorites, setAccountFavorites] = useLocalStorage<string[]>(ACCOUNT_FAVORITES_KEY, ACCOUNT_FAVORITES)
  const favorites = user ? accountFavorites : guestFavorites
  const setFavorites = user ? setAccountFavorites : setGuestFavorites
  const [submitted, setSubmitted] = useLocalStorage<Listing[]>('greenstore:my-listings', [])

  const isFavorite = useCallback((kind: FavoriteKind, id: string) => favorites.includes(favKey(kind, id)), [favorites])
  const toggleFavorite = useCallback(
    (kind: FavoriteKind, id: string) => {
      const key = favKey(kind, id)
      setFavorites((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    },
    [setFavorites],
  )
  const favoriteIds = useCallback(
    (kind: FavoriteKind) => favorites.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1)),
    [favorites],
  )

  const favValue = useMemo(() => ({ favorites, isFavorite, toggleFavorite, favoriteIds }), [favorites, isFavorite, toggleFavorite, favoriteIds])

  const sessionValue = useMemo<SessionValue>(
    () => ({
      user,
      signIn: (email) => setUser({ ...currentUser, ...(email ? { email } : {}) }),
      signOut: () => setUser(null),
      updateProfile: (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev)),
    }),
    [user, setUser],
  )

  const listingsValue = useMemo<MyListingsValue>(
    () => ({
      submitted,
      addListing: (listing) => setSubmitted((prev) => [listing, ...prev]),
      updateListing: (id, patch) => setSubmitted((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
      removeListing: (id) => setSubmitted((prev) => prev.filter((l) => l.id !== id)),
    }),
    [submitted, setSubmitted],
  )

  return (
    <SessionContext.Provider value={sessionValue}>
      <FavoritesContext.Provider value={favValue}>
        <MyListingsContext.Provider value={listingsValue}>{children}</MyListingsContext.Provider>
      </FavoritesContext.Provider>
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
