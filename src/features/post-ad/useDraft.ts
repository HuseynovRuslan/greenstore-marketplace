import { useCallback, useEffect, useState } from 'react'
import { createEmptyDraft, exampleDraft, type PostAdDraft } from '@/data/postAd'

export const DRAFT_KEY = 'greenstore:post-ad:draft'
/** Id of the listing created by the last "Yoxlamaya göndər" (read by the confirmation page after a refresh). */
export const LAST_SUBMITTED_KEY = 'greenstore:post-ad:last-submitted'

/*
 * Object URLs (URL.createObjectURL) only live as long as the document that created them, so photos picked
 * in an earlier page load cannot be shown after a refresh. We remember the URLs created in this session and
 * drop stale `blob:` photos when the draft is read back from localStorage.
 */
const liveObjectUrls = new Set<string>()

export function createPhotoUrl(file: File): string {
  const url = URL.createObjectURL(file)
  liveObjectUrls.add(url)
  return url
}

export function releasePhotoUrl(url: string) {
  if (liveObjectUrls.delete(url)) URL.revokeObjectURL(url)
}

function sanitize(raw: Partial<PostAdDraft>): PostAdDraft {
  const draft: PostAdDraft = { ...createEmptyDraft(), ...raw }
  const photos = (Array.isArray(draft.photos) ? draft.photos : []).filter(
    (p) => p && typeof p.url === 'string' && (!p.url.startsWith('blob:') || liveObjectUrls.has(p.url)),
  )
  const coverId = photos.some((p) => p.id === draft.coverId) ? draft.coverId : (photos[0]?.id ?? '')
  return { ...draft, photos, coverId }
}

export function readDraft(): PostAdDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return raw ? sanitize(JSON.parse(raw) as Partial<PostAdDraft>) : exampleDraft
  } catch {
    return exampleDraft
  }
}

export function writeDraft(draft: PostAdDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* storage unavailable — the draft lives in memory only */
  }
}

/** The wizard's single draft object, persisted to localStorage on every change ("Qaralama avtomatik saxlanılıb"). */
export function usePostAdDraft() {
  const [draft, setDraft] = useState<PostAdDraft>(readDraft)

  useEffect(() => writeDraft(draft), [draft])

  const update = useCallback((patch: Partial<PostAdDraft>) => setDraft((prev) => ({ ...prev, ...patch })), [])
  const reset = useCallback((next: PostAdDraft) => setDraft(next), [])

  return { draft, update, reset }
}
