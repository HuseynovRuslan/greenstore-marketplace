'use server'

import { updateTag } from 'next/cache'
import { rejectionReasonCodes } from '@/features/listing/rejection'
import { adminRepository } from '@/services/adminRepository'
import { isApiError, listingCacheTags } from '@/services/apiRepository'
import { dataSource } from '@/seo/env'
import type { RejectionReasonCode } from '@/types'

/*
 * The moderation queue's decisions (DATA_SOURCE=api, backend-contract.md 3.5). Staff only: the API checks the
 * session's role (403 otherwise). The demo's moderation page decides in the browser (src/data/admin).
 */

export type DecisionResult = { ok: true } | { ok: false; error: string; stale?: boolean }

const ID_RE = /^[a-z0-9-]{1,80}$/
const NOTE_MAX = 500

export interface DecisionRequest {
  decision: 'approve' | 'reject'
  reasonCode?: RejectionReasonCode
  note?: string
  /** The item's `version` as the moderator saw it */
  version: string
}

/**
 * «Təsdiqlə və dərc et» / «Rədd qərarını təsdiqlə». The version is the one the moderator was shown: when the owner
 * edited the listing or another moderator decided meanwhile, the API refuses and the page shows the listing again.
 * An approval puts the listing on the site, so its pages refresh at once.
 */
export async function decideModeration(listingId: string, request: DecisionRequest): Promise<DecisionResult> {
  if (dataSource() !== 'api') return { ok: false, error: 'Demo rejimində qərarlar brauzerdə saxlanılır.' }
  const decision = request?.decision
  const note = typeof request?.note === 'string' ? request.note.trim() : ''
  const reasonCode = request?.reasonCode
  if (typeof listingId !== 'string' || !ID_RE.test(listingId) || (decision !== 'approve' && decision !== 'reject') || typeof request.version !== 'string' || !request.version) {
    return { ok: false, error: 'Qərarı göndərmək alınmadı. Səhifəni yeniləyin.' }
  }
  if (decision === 'reject' && (!reasonCode || !rejectionReasonCodes.includes(reasonCode))) return { ok: false, error: 'Rədd səbəbini seçin.' }
  if (decision === 'reject' && !note) return { ok: false, error: 'Rədd etmək üçün aydın izah yazılmalıdır.' }
  if (note.length > NOTE_MAX) return { ok: false, error: `İzah ən çox ${NOTE_MAX} simvol olsun.` }
  try {
    // Read first: the pages to refresh are named by the listing's address and seller.
    const item = await adminRepository.moderationItem(listingId)
    if (!item) return { ok: false, error: 'Elan tapılmadı: silinmiş ola bilər.', stale: true }
    await adminRepository.decide(listingId, {
      decision,
      ...(decision === 'reject' ? { reasonCode, note } : note ? { note } : {}),
      version: request.version,
    })
    for (const tag of listingCacheTags(item.listing)) updateTag(tag)
    return { ok: true }
  } catch (error) {
    if (isApiError(error, 'concurrency-conflict')) return { ok: false, error: 'Elan bu arada dəyişib və ya başqa moderator qərar verib. Yenilənmiş elanı yoxlayın.', stale: true }
    if (isApiError(error, 'listing.wrong-status')) return { ok: false, error: 'Elan artıq yoxlamada deyil.', stale: true }
    if (isApiError(error) && error.status === 401) return { ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.' }
    if (isApiError(error) && error.status === 403) return { ok: false, error: 'Bu əməliyyat yalnız moderatorlar üçündür.' }
    if (isApiError(error, 'validation')) return { ok: false, error: 'Səbəbi və izahı yoxlayıb yenidən göndərin.' }
    return { ok: false, error: 'Qərarı göndərmək alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}
