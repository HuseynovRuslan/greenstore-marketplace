'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage, readStored, writeStored } from '@/hooks/useLocalStorage'
import { useMyListings, useSession } from '@/state/store'
import type { Listing, ListingStats, OwnListing, PromotionPackageId, UserProfile } from '@/types'
import { hasProgress, restoreDraft, type PostingDraft } from '@/features/posting/draft'
import { importPhotos, listingToDraft, remotePhotos } from '@/features/posting/fromListing'
import { photoStore } from '@/features/posting/photos'
import { DRAFT_KEY } from '@/features/posting/useDraft'
import { changeOwnListing, loadOwnListings, type CabinetChangeResult, type OwnListingAction } from './actions'
import { countByStatus, mergeOwnListings, renewal, type ChangeMap, type ListingChange } from './model'

export const CHANGES_KEY = 'greenstore:cabinet:changes'

type Load = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; listings: Listing[]; stats: Record<string, ListingStats> }

/** What an owner's action on a row answered: the row's toast says it. */
export type RowResult = { ok: true } | { ok: false; error: string }

const DONE: RowResult = { ok: true }
const UNREACHABLE: CabinetChangeResult = { ok: false, error: 'Əməliyyatı etmək alınmadı. İnternet bağlantısını yoxlayın.' }

const isOwnListing = (listing: Listing): listing is OwnListing => Array.isArray((listing as Partial<OwnListing>).photoIds) && typeof (listing as Partial<OwnListing>).version === 'string'

/**
 * The owner's listings for «Elanlarım», plus the unsent posting draft, with loading and error states for the page.
 * - DATA_SOURCE=api: the API's listings as they are; «Yenilə», «Deaktiv et», «Aktiv et» and «Sil» go to the API and
 *   its answer replaces the row (backend-contract.md 3.3).
 * - DATA_SOURCE=mock (DEMO): the demo seller's listings merged with what was sent and changed in this browser (kept
 *   in localStorage).
 */
export function useCabinet(user: UserProfile | null) {
  const { source } = useSession()
  const api = source === 'api'
  // Whose listings the server answers with is the session's (backend-contract.md 2.2). The demo's session is in the
  // browser: the mock answers for its demo seller, so only an account with a seller page asks.
  const owner = api ? user?.id : user?.sellerId
  const [load, setLoad] = useState<Load>(owner ? { status: 'loading' } : { status: 'ready', listings: [], stats: {} })
  const [attempt, setAttempt] = useState(0)
  const { submitted } = useMyListings()
  const [changes, setChanges] = useLocalStorage<ChangeMap>(CHANGES_KEY, {})
  const [draft, setDraft] = useState<PostingDraft | undefined>(() => {
    const d = restoreDraft(readStored<unknown>(DRAFT_KEY, null))
    return hasProgress(d) ? d : undefined
  })

  useEffect(() => {
    if (!owner) return
    let cancelled = false
    loadOwnListings()
      .then((result) => {
        if (cancelled) return
        setLoad(result.ok ? { status: 'ready', listings: result.listings, stats: result.stats } : { status: 'error', error: result.error })
      })
      .catch(() => !cancelled && setLoad({ status: 'error', error: 'Elanları yükləmək alınmadı.' }))
    return () => {
      cancelled = true
    }
  }, [owner, attempt])

  const retry = useCallback(() => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  const listings = useMemo(() => (load.status !== 'ready' ? [] : api ? load.listings : mergeOwnListings(load.listings, submitted, changes)), [api, load, submitted, changes])
  const stats = load.status === 'ready' ? load.stats : {}
  const counts = useMemo(() => countByStatus(listings, draft ? 1 : 0), [listings, draft])

  const change = useCallback((id: string, patch: ListingChange) => setChanges((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })), [setChanges])

  /** DATA_SOURCE=api: the action on the API; the listing it answers with replaces the row (none after «Sil»). */
  const onApi = useCallback(async (id: string, action: OwnListingAction): Promise<RowResult> => {
    const result = await changeOwnListing(id, action).catch(() => UNREACHABLE)
    if (!result.ok) return { ok: false, error: result.error }
    setLoad((prev) => {
      if (prev.status !== 'ready') return prev
      const rows = action === 'delete' ? prev.listings.filter((l) => l.id !== id) : prev.listings.map((l) => (l.id === id && result.listing ? result.listing : l))
      return { ...prev, listings: rows }
    })
    return DONE
  }, [])

  /** DEMO: the change is kept in this browser. */
  const locally = (id: string, patch: ListingChange): Promise<RowResult> => {
    change(id, patch)
    return Promise.resolve(DONE)
  }

  const discardDraft = useCallback(() => {
    if (draft) void photoStore.remove(draft.photos.map((p) => p.id))
    writeStored(DRAFT_KEY, null)
    setDraft(undefined)
  }, [draft])

  /** «Redaktə et»: the listing becomes the posting draft (photos copied in), then the wizard opens at step 2. */
  const startEdit = useCallback(
    async (listing: Listing) => {
      const next = listingToDraft(listing, { name: user?.fullName, phone: user?.phone })
      if (api && isOwnListing(listing)) {
        // The API keeps the photos: the edit sends their ids back (nothing is uploaded again) and the version it opened.
        next.photos = remotePhotos(listing)
        if (next.editing) next.editing.version = listing.version
      } else {
        next.photos = await importPhotos(listing.images.length ? listing.images : [listing.cover])
      }
      next.savedAt = new Date().toISOString()
      writeStored(DRAFT_KEY, next)
    },
    [api, user],
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
    renew: (id: string) => (api ? onApi(id, 'renew') : locally(id, renewal(Date.now()))),
    deactivate: (id: string) => (api ? onApi(id, 'deactivate') : locally(id, { status: 'inactive', updatedAt: new Date().toISOString() })),
    activate: (id: string) => (api ? onApi(id, 'activate') : locally(id, { status: 'active', updatedAt: new Date().toISOString() })),
    remove: (id: string) => (api ? onApi(id, 'delete') : locally(id, { removed: true })),
    /** After a paid promotion (DEMO: the API would apply it once the payment is confirmed). */
    promote: (id: string, packageId: PromotionPackageId, days = 1) => {
      const now = Date.now()
      change(id, {
        promotion: { packageId, until: new Date(now + days * 86_400_000).toISOString() },
        ...(packageId !== 'one-cixar' ? { bumpedAt: new Date(now).toISOString() } : {}),
      })
    },
  }
}
