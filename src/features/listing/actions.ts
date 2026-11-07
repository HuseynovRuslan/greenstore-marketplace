'use server'

import { getRepository } from '@/services/repository'
import type { ReportTarget } from '@/types'

/*
 * Server Actions of the public pages. They are public endpoints: every input is checked here, not only in the form.
 * In DATA_SOURCE=mock nothing is stored (docs/handoff/contract-additions.md).
 */

const ID_RE = /^[a-z0-9-]{1,80}$/

/** «Nömrəni göstər» on a listing: counted for the seller's statistics. Fire and forget from the client. */
export async function recordPhoneReveal(listingId: string): Promise<void> {
  if (typeof listingId !== 'string' || !ID_RE.test(listingId)) return
  await getRepository().revealPhone(listingId)
}

export type ReportResult = { ok: true; id: string } | { ok: false; error: string }

const TARGETS: ReportTarget[] = ['listing', 'seller', 'service']

/** «Şikayət et» on a listing, seller or service page. */
export async function sendReport(input: { target: ReportTarget; targetId: string; reason: string; comment?: string }): Promise<ReportResult> {
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : ''
  const comment = typeof input?.comment === 'string' ? input.comment.trim() : ''
  if (!TARGETS.includes(input?.target) || typeof input.targetId !== 'string' || !ID_RE.test(input.targetId)) {
    return { ok: false, error: 'Şikayəti göndərmək alınmadı. Səhifəni yeniləyib yenidən cəhd edin.' }
  }
  if (!reason || reason.length > 80) return { ok: false, error: 'Səbəbi seçin.' }
  if (comment.length > 500) return { ok: false, error: 'İzah 500 simvoldan uzun ola bilməz.' }
  try {
    const { id } = await getRepository().submitReport({ target: input.target, targetId: input.targetId, reason, comment: comment || undefined })
    return { ok: true, id }
  } catch {
    return { ok: false, error: 'Şikayəti göndərmək alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}
