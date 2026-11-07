'use client'

import { useCallback, useEffect, useState } from 'react'
import { readStored, writeStored } from '@/hooks/useLocalStorage'
import type { UserProfile } from '@/types'
import { createDraft, restoreDraft, type DraftPhoto, type PostingDraft } from './draft'
import { photoStore } from './photos'

export const DRAFT_KEY = 'greenstore:posting:draft'
/** Id of the listing sent last (the confirmation page reads it after a reload). */
export const LAST_SENT_KEY = 'greenstore:posting:last-sent'

const contactOf = (user: UserProfile | null) => (user ? { name: user.fullName, phone: user.phone } : undefined)

/** Reads the stored draft (the wizard renders after hydration only, so localStorage is there). */
export function readDraft(user: UserProfile | null): PostingDraft {
  return restoreDraft(readStored<unknown>(DRAFT_KEY, null), contactOf(user))
}

/**
 * The wizard's draft, written to localStorage on every change with the time («Qaralama saxlanıldı · 14:32»).
 * `reset` starts over and deletes the old draft's photos.
 */
export function usePostingDraft(user: UserProfile | null) {
  const [draft, setDraft] = useState<PostingDraft>(() => readDraft(user))
  const [dirty, setDirty] = useState(false)

  // Written after render (writing inside the state updater notified other stores' subscribers mid-render).
  useEffect(() => {
    if (dirty) writeStored(DRAFT_KEY, draft)
  }, [draft, dirty])

  const update = useCallback((patch: Partial<PostingDraft> | ((d: PostingDraft) => PostingDraft)) => {
    setDraft((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      return next === prev ? prev : { ...next, savedAt: new Date().toISOString() }
    })
    setDirty(true)
  }, [])

  const reset = useCallback(() => {
    setDraft((prev) => {
      void photoStore.remove(prev.photos.map((p) => p.id))
      return createDraft(contactOf(user))
    })
    setDirty(true)
  }, [user])

  return { draft, update, reset }
}

/** Object URLs for stored photos, shared across the wizard's steps (one URL per photo per page load). */
const urlCache = new Map<string, string>()

export function usePhotoUrls(photos: DraftPhoto[]): Record<string, string | undefined> {
  const [urls, setUrls] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(photos.map((p) => [p.id, urlCache.get(p.id)])),
  )
  const key = photos.map((p) => p.id).join(',')

  useEffect(() => {
    let cancelled = false
    const missing = photos.filter((p) => !urlCache.has(p.id))
    Promise.all(
      missing.map(async (p) => {
        const blob = await photoStore.get(p.id)
        if (blob && !urlCache.has(p.id)) urlCache.set(p.id, URL.createObjectURL(blob))
      }),
    ).then(() => {
      if (!cancelled) setUrls(Object.fromEntries(photos.map((p) => [p.id, urlCache.get(p.id)])))
    })
    return () => {
      cancelled = true
    }
    // `key` stands for the list of ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}

/** Registers a freshly processed photo so it shows at once, before the IndexedDB write finishes. */
export function cachePhotoUrl(id: string, blob: Blob) {
  if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob))
}

export function forgetPhotoUrl(id: string) {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
}
