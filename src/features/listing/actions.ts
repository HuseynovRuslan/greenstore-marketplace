'use server'

import { isReasonFor, OTHER_REASON } from '@/features/seller/complaintReasons'
import { isApiError } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import type { ReportReason, ReportTarget } from '@/types'

/*
 * Server Actions of the public pages. They are public endpoints: every input is checked here, not only in the form.
 * In DATA_SOURCE=mock nothing is stored (docs/handoff/contract-additions.md).
 */

const ID_RE = /^[a-z0-9-]{1,80}$/

// «Nömrəni göstər» lives in features/contact/actions.ts: it counts the click and returns the number.

/**
 * A view of a listing's or a service's page (backend-contract.md 3.4), sent once per page view by the page's beacon
 * (ViewBeacon): pages are cached, so the render cannot count. The API counts one per visitor a day, never the owner.
 * Nothing to tell the visitor either way, so a failure stays silent.
 */
export async function recordView(listingId: string): Promise<void> {
  if (typeof listingId !== 'string' || !ID_RE.test(listingId)) return
  try {
    await getRepository().recordListingView(listingId)
  } catch {
    // Not counted (the API is down, the listing has just gone): the page works the same.
  }
}

export type ReportResult = { ok: true; id: string } | { ok: false; error: string }

const TARGETS: ReportTarget[] = ['listing', 'seller', 'service']
const COMMENT_MAX = 500

const GONE: Record<ReportTarget, string> = {
  listing: 'Bu elan artıq saytda deyil.',
  service: 'Bu xidmət artıq saytda deyil.',
  seller: 'Bu satıcının səhifəsi artıq aktiv deyil.',
}

/** The API's refusal of a report in the visitor's words. */
function reportFailure(error: unknown, target: ReportTarget): string {
  if (isApiError(error) && error.status === 404) return GONE[target]
  if (isApiError(error) && error.status === 429) return 'Bir neçə şikayəti ard-arda göndərdiniz. Bir az sonra yenidən cəhd edin.'
  if (isApiError(error, 'validation')) {
    if (error.fieldError('comment') === 'required') return 'Nə baş verdiyini qısaca yazın.'
    if (error.fieldError('comment') === 'too-long') return `İzah ${COMMENT_MAX} simvoldan uzun ola bilməz.`
    if (error.fieldError('reason')) return 'Səbəbi seçin.'
  }
  return 'Şikayəti göndərmək alınmadı. Bir az sonra yenidən cəhd edin.'
}

/**
 * «Şikayət et» on a listing, seller or service page. The reason is a code of the target's list (backend-contract.md
 * 4.1, features/seller/complaintReasons.ts); «Digər səbəb» needs the visitor's words.
 */
export async function sendReport(input: { target: ReportTarget; targetId: string; reason: ReportReason; comment?: string }): Promise<ReportResult> {
  const comment = typeof input?.comment === 'string' ? input.comment.trim() : ''
  if (!TARGETS.includes(input?.target) || typeof input.targetId !== 'string' || !ID_RE.test(input.targetId)) {
    return { ok: false, error: 'Şikayəti göndərmək alınmadı. Səhifəni yeniləyib yenidən cəhd edin.' }
  }
  if (!isReasonFor(input.target, input.reason)) return { ok: false, error: 'Səbəbi seçin.' }
  if (input.reason === OTHER_REASON && !comment) return { ok: false, error: 'Nə baş verdiyini qısaca yazın.' }
  if (comment.length > COMMENT_MAX) return { ok: false, error: `İzah ${COMMENT_MAX} simvoldan uzun ola bilməz.` }
  try {
    const { id } = await getRepository().submitReport({ target: input.target, targetId: input.targetId, reason: input.reason, comment: comment || undefined })
    return { ok: true, id }
  } catch (error) {
    return { ok: false, error: reportFailure(error, input.target) }
  }
}
