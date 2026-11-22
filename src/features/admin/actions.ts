'use server'

import { updateTag } from 'next/cache'
import { rejectionReasonCodes } from '@/features/listing/rejection'
import { adminRepository } from '@/services/adminRepository'
import { isApiError, listingCacheTags } from '@/services/apiRepository'
import { dataSource } from '@/seo/env'
import type {
  AdminCategory,
  AdminCategoryInput,
  AdminCategoryPatch,
  BlockResult,
  ComplaintStatus,
  RejectionReasonCode,
  ReportResolution,
  ReportUpdate,
} from '@/types'
import { categoryFieldMessages, checkCategoryInput, checkCategoryPatch, type CategoryFieldErrors } from './categoriesApi'

/*
 * The staff's changes (DATA_SOURCE=api, backend-contract.md 3.5): moderation decisions and reports (moderators and
 * admins), blocking accounts, «Təsdiqlənmiş satıcı» and categories (admins). The API checks the session's role (403
 * otherwise). The demo's admin pages change things in the browser (src/data/admin).
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

/* ---------- Reports, accounts and categories (DATA_SOURCE=api, backend-contract.md 3.5, phase 4) ---------- */

const DEMO = 'Demo rejimində dəyişikliklər brauzerdə saxlanılır.'
const REPORT_NOTE_MAX = 500
const COMPLAINT_STATUSES: ComplaintStatus[] = ['open', 'investigating', 'resolved']
const RESOLUTIONS: ReportResolution[] = ['action-taken', 'no-violation']

export type StaffResult = { ok: true } | { ok: false; error: string }

/** The refusals every staff call can get, in the staff's words; `fallback` for the rest. */
function staffFailure(error: unknown, fallback: string): string {
  if (isApiError(error) && error.status === 401) return 'Sessiyanın vaxtı bitib. Yenidən daxil olun.'
  if (isApiError(error) && error.status === 403) return 'Bu əməliyyat sizin rolunuz üçün açıq deyil.'
  return fallback
}

/** «Yadda saxla» / «Araşdırmaya götür» / «Şikayəti bağla»: the new status, the resolution to close, a note for the history. */
export async function updateReportStatus(reportId: string, patch: ReportUpdate): Promise<StaffResult> {
  if (dataSource() !== 'api') return { ok: false, error: DEMO }
  const note = typeof patch?.note === 'string' ? patch.note.trim() : ''
  const status = patch?.status
  const resolution = patch?.resolution
  if (typeof reportId !== 'string' || !ID_RE.test(reportId) || (status !== undefined && !COMPLAINT_STATUSES.includes(status))) {
    return { ok: false, error: 'Dəyişikliyi göndərmək alınmadı. Səhifəni yeniləyin.' }
  }
  if (resolution !== undefined && !RESOLUTIONS.includes(resolution)) return { ok: false, error: 'Nəticəni seçin.' }
  if (status === 'resolved' && !resolution) return { ok: false, error: 'Şikayəti bağlamaq üçün nəticəni seçin.' }
  if (note.length > REPORT_NOTE_MAX) return { ok: false, error: `Qeyd ən çox ${REPORT_NOTE_MAX} simvol olsun.` }
  if (status === undefined && !note) return { ok: false, error: 'Vəziyyəti dəyişin və ya qeyd yazın.' }
  try {
    await adminRepository.updateReport(reportId, {
      ...(status ? { status } : {}),
      ...(status === 'resolved' ? { resolution } : {}),
      ...(note ? { note } : {}),
    })
    return { ok: true }
  } catch (error) {
    if (isApiError(error, 'report.not-found')) return { ok: false, error: 'Şikayət tapılmadı.' }
    if (isApiError(error, 'validation')) {
      if (error.fieldError('resolution')) return { ok: false, error: 'Şikayəti bağlamaq üçün nəticəni seçin.' }
      if (error.fieldError('note')) return { ok: false, error: `Qeyd ən çox ${REPORT_NOTE_MAX} simvol olsun.` }
    }
    return { ok: false, error: staffFailure(error, 'Dəyişikliyi göndərmək alınmadı. Bir az sonra yenidən cəhd edin.') }
  }
}

/** The site's pages a block (or an unblock) changes: the account's listings, services and seller page. */
const ACCOUNT_TAGS = ['listings', 'services', 'sellers', 'home', 'sitemap:listing', 'sitemap:service']

export type BlockOutcome = { ok: true; result: BlockResult } | { ok: false; error: string }

/**
 * «Hesabı blokla» / «Bloku aç» (admins): blocking ends the account's sessions and takes its active listings off the
 * site, so those pages refresh at once.
 */
export async function setAccountBlocked(userId: string, blocked: boolean, reason?: string): Promise<BlockOutcome> {
  if (dataSource() !== 'api') return { ok: false, error: DEMO }
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (typeof userId !== 'string' || !ID_RE.test(userId) || typeof blocked !== 'boolean') return { ok: false, error: 'Əməliyyatı göndərmək alınmadı. Səhifəni yeniləyin.' }
  if (text.length > REPORT_NOTE_MAX) return { ok: false, error: `Səbəb ən çox ${REPORT_NOTE_MAX} simvol olsun.` }
  try {
    const result = await adminRepository.blockUser(userId, blocked, text || undefined)
    for (const tag of ACCOUNT_TAGS) updateTag(tag)
    return { ok: true, result }
  } catch (error) {
    if (isApiError(error, 'account.cannot-block-self')) return { ok: false, error: 'Öz hesabınızı bloklaya bilməzsiniz.' }
    if (isApiError(error, 'account.not-found')) return { ok: false, error: 'Hesab tapılmadı: silinmiş ola bilər.' }
    return { ok: false, error: staffFailure(error, 'Əməliyyatı göndərmək alınmadı. Bir az sonra yenidən cəhd edin.') }
  }
}

/** «Təsdiqlənmiş satıcı» on or off (admins): the seller page, the directory and the home page show it at once. */
export async function setSellerVerified(sellerId: string, verified: boolean): Promise<StaffResult> {
  if (dataSource() !== 'api') return { ok: false, error: DEMO }
  if (typeof sellerId !== 'string' || !ID_RE.test(sellerId) || typeof verified !== 'boolean') return { ok: false, error: 'Əməliyyatı göndərmək alınmadı. Səhifəni yeniləyin.' }
  try {
    await adminRepository.verifySeller(sellerId, verified)
    for (const tag of ['sellers', `seller:${sellerId}`, 'home', 'services']) updateTag(tag)
    return { ok: true }
  } catch (error) {
    if (isApiError(error, 'seller.not-found')) return { ok: false, error: 'Satıcı tapılmadı.' }
    return { ok: false, error: staffFailure(error, 'Əməliyyatı göndərmək alınmadı. Bir az sonra yenidən cəhd edin.') }
  }
}

/** What a category change refreshes on the site (the API's notice names the same tags). */
const CATEGORY_TAGS = ['taxonomy', 'listings', 'services', 'home']

export type CategorySaveResult =
  | { ok: true; category: AdminCategory }
  | { ok: false; error: string; fields?: CategoryFieldErrors; stale?: boolean }

/** «Yadda saxla» of a new category or sub-category (admins). The form's own checks run again here. */
export async function createCategory(input: AdminCategoryInput): Promise<CategorySaveResult> {
  if (dataSource() !== 'api') return { ok: false, error: DEMO }
  const checked = checkCategoryInput(input)
  if (!checked.ok) return { ok: false, error: 'Sahələri yoxlayın.', fields: checked.fields }
  try {
    const category = await adminRepository.createCategory(checked.value)
    for (const tag of CATEGORY_TAGS) updateTag(tag)
    return { ok: true, category }
  } catch (error) {
    return categoryFailure(error)
  }
}

/** «Yadda saxla» of an existing one (admins), with the version the admin saw. */
export async function updateCategory(categoryId: string, patch: AdminCategoryPatch): Promise<CategorySaveResult> {
  if (dataSource() !== 'api') return { ok: false, error: DEMO }
  if (typeof categoryId !== 'string' || !ID_RE.test(categoryId)) return { ok: false, error: 'Dəyişikliyi göndərmək alınmadı. Səhifəni yeniləyin.' }
  const checked = checkCategoryPatch(patch)
  if (!checked.ok) return { ok: false, error: 'Sahələri yoxlayın.', fields: checked.fields }
  try {
    const category = await adminRepository.updateCategory(categoryId, checked.value)
    for (const tag of CATEGORY_TAGS) updateTag(tag)
    return { ok: true, category }
  } catch (error) {
    return categoryFailure(error)
  }
}

function categoryFailure(error: unknown): CategorySaveResult {
  if (isApiError(error, 'concurrency-conflict')) return { ok: false, error: 'Kateqoriya bu arada başqa admin tərəfindən dəyişdirilib. Yenilənmiş məlumatı yoxlayın.', stale: true }
  if (isApiError(error, 'category.not-found')) return { ok: false, error: 'Kateqoriya tapılmadı.', stale: true }
  if (isApiError(error, 'validation')) {
    const fields = categoryFieldMessages(error.problem.errors ?? {})
    return { ok: false, error: 'Sahələri yoxlayın.', fields }
  }
  return { ok: false, error: staffFailure(error, 'Dəyişikliyi göndərmək alınmadı. Bir az sonra yenidən cəhd edin.') }
}
