'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage, readStored, writeStored } from '@/hooks/useLocalStorage'
import { useMyListings } from '@/state/store'
import type { Listing, ListingStats, UserProfile } from '@/types'
import { hasProgress, restoreDraft, type PostingDraft } from '@/features/posting/draft'
import { importPhotos, listingToDraft } from '@/features/posting/fromListing'
import { photoStore } from '@/features/posting/photos'
import { DRAFT_KEY } from '@/features/posting/useDraft'
import { loadOwnListings } from './actions'
import { countByStatus, mergeOwnListings, renewal, type ChangeMap, type ListingChange } from './model'

export const CHANGES_KEY = 'greenstore:cabinet:changes'

type Load = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; listings: Listing[]; stats: Record<string, ListingStats> }

/**
 * The owner's listings for «Elanlarım»: loaded from the API (Server Action), merged with what was sent and changed in
 * this browser (DEMO: kept in localStorage), plus the unsent posting draft. Loading and error states for the page.
 */
export function useCabinet(user: UserProfile | null) {
  const sellerId = user?.sellerId
  const [load, setLoad] = useState<Load>(sellerId ? { status: 'loading' } : { status: 'ready', listings: [], stats: {} })
  const [attempt, setAttempt] = useState(0)
  const { submitted } = useMyListings()
  const [changes, setChanges] = useLocalStorage<ChangeMap>(CHANGES_KEY, {})
  const [draft, setDraft] = useState<PostingDraft | undefined>(() => {
    const d = restoreDraft(readStored<unknown>(DRAFT_KEY, null))
    return hasProgress(d) ? d : undefined
  })

  useEffect(() => {
    if (!sellerId) return
    let cancelled = false
    loadOwnListings(sellerId)
      .then((result) => {
        if (cancelled) return
        setLoad(result.ok ? { status: 'ready', listings: result.listings, stats: result.stats } : { status: 'error', error: result.error })
      })
      .catch(() => !cancelled && setLoad({ status: 'error', error: 'Elanları yükləmək alınmadı.' }))
    return () => {
      cancelled = true
    }
  }, [sellerId, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const listings = useMemo(() => (load.status === 'ready' ? mergeOwnListings(load.listings, submitted, changes) : []), [load, submitted, changes])
  const stats = load.status === 'ready' ? load.stats : {}
  const counts = useMemo(() => countByStatus(listings, draft ? 1 : 0), [listings, draft])

  const change = useCallback((id: string, patch: ListingChange) => setChanges((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })), [setChanges])

  const discardDraft = useCallback(() => {
    if (draft) void photoStore.remove(draft.photos.map((p) => p.id))
    writeStored(DRAFT_KEY, null)
    setDraft(undefined)
  }, [draft])

  /** «Redaktə et»: the listing becomes the posting draft (photos copied in), then the wizard opens at step 2. */
  const startEdit = useCallback(
    async (listing: Listing) => {
      const next = listingToDraft(listing, { name: user?.fullName, phone: user?.phone })
      next.photos = await importPhotos(listing.images.length ? listing.images : [listing.cover])
      next.savedAt = new Date().toISOString()
      writeStored(DRAFT_KEY, next)
    },
    [user],
  )

  return {
    load,
    retry,
    listings,
    stats,
    counts,
    draft,
    discardDraft,
    startEdit,
    renew: (id: string) => change(id, renewal(Date.now())),
    deactivate: (id: string) => change(id, { status: 'inactive', updatedAt: new Date().toISOString() }),
    activate: (id: string) => change(id, { status: 'active', updatedAt: new Date().toISOString() }),
    remove: (id: string) => change(id, { removed: true }),
  }
}
