'use server'

import { updateTag } from 'next/cache'
import { isApiError, listingCacheTags } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import type { ListingSubmitResult, PhotoUpload, Seller } from '@/types'
import { MAX_PHOTO_MB, restoreDraft, toListingInput, type StepNumber } from './draft'
import { ACCEPTED_TYPES } from './photos'
import { submitFailure, SIGNED_OUT } from './submitErrors'
import { firstInvalidStep } from './validation'

export type SubmitResult =
  | { ok: true; result: ListingSubmitResult }
  | {
      ok: false
      error: string
      step?: StepNumber
      /** The session has ended: sign in again (the draft waits in this browser). */
      signedOut?: boolean
      /** The uploaded photos are gone (a day passed) or not ready: upload them again and send once more. */
      uploadAgain?: boolean
    }

/** `Idempotency-Key`: at most 80 printable ASCII characters (backend-contract.md 3.3). */
const KEY_RE = /^[\x21-\x7e]{1,80}$/
/** Photo ids of the API (UUIDs): a draft photo that has one was uploaded. */
const UPLOADED_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * «Elanı göndər» (and «Dəyişiklikləri göndər» for an edit). The draft is checked again here with the wizard's own rules
 * (a Server Action is a public endpoint), then sent as ListingInput: a new listing with the draft's `Idempotency-Key`
 * (a retry after a lost answer gets the same listing), an edit with the version the owner opened. With the API the
 * photos must have been uploaded first (`startPhotoUpload`); the mock returns the next number and stores nothing.
 */
export async function submitPosting(raw: unknown, idempotencyKey?: string): Promise<SubmitResult> {
  const draft = restoreDraft(raw)
  const step = firstInvalidStep(draft)
  if (step) return { ok: false, error: 'Bəzi xanalar doldurulmayıb. Həmin addıma qayıdıb düzəldin.', step }
  const input = toListingInput(draft)
  const api = dataSource() === 'api'
  if (api && !input.photoIds.every((id) => UPLOADED_RE.test(id))) {
    return { ok: false, error: 'Şəkillər hələ yüklənməyib. Yenidən göndərin.', step: 3, uploadAgain: true }
  }
  const key = typeof idempotencyKey === 'string' && KEY_RE.test(idempotencyKey) ? idempotencyKey : undefined
  const repo = getRepository()
  try {
    const editing = draft.editing
    const result = editing ? await repo.updateListing(editing.id, input, editing.version) : await repo.submitListing(input, key)
    // An edit takes a published listing off the site until the moderator checks it again: its pages refresh now.
    if (api && editing) for (const tag of listingCacheTags({ id: result.id, slug: editing.slug, kind: input.kind })) updateTag(tag)
    return { ok: true, result }
  } catch (error) {
    return submitFailure(error)
  }
}

export type PhotoUploadResult = { ok: true; upload: PhotoUpload } | { ok: false; error: string; signedOut?: boolean }

const MAX_BYTES = MAX_PHOTO_MB * 1024 * 1024

/**
 * An upload address for one photo (DATA_SOURCE=api, backend-contract.md 3.2). The browser then sends the file to it
 * itself: straight to the API, so a large photo never passes through this site's server.
 */
export async function startPhotoUpload(input: { fileName: string; contentType: string; bytes: number }): Promise<PhotoUploadResult> {
  const fileName = typeof input?.fileName === 'string' ? input.fileName.slice(0, 255) : ''
  const contentType = typeof input?.contentType === 'string' ? input.contentType : ''
  const bytes = typeof input?.bytes === 'number' && Number.isFinite(input.bytes) ? Math.floor(input.bytes) : 0
  if (!ACCEPTED_TYPES.includes(contentType)) return { ok: false, error: 'Yalnız JPG, PNG və ya WebP şəkil göndərmək olar.' }
  if (bytes <= 0 || bytes > MAX_BYTES) return { ok: false, error: `Şəkil ${MAX_PHOTO_MB} MB-dan böyük olmamalıdır.` }
  try {
    return { ok: true, upload: await getRepository().createPhotoUpload({ fileName, contentType, bytes }) }
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { ok: false, error: SIGNED_OUT, signedOut: true }
    if (isApiError(error, 'photo.too-many')) return { ok: false, error: 'Bu gün çox şəkil yükləmisiniz. Bir neçə saat sonra yenidən cəhd edin: qaralama saxlanılıb.' }
    return { ok: false, error: 'Şəkilləri yükləmək alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin: qaralama saxlanılıb.' }
  }
}

/**
 * The business profile («mağaza») the step-6 preview shows as the seller, as the API has it (`GET /me/seller`). The
 * mock's demo sellers are in src/data/sellers, so with the mock (and for a private account) there is none.
 */
export async function previewSeller(): Promise<Seller | undefined> {
  if (dataSource() !== 'api') return undefined
  try {
    return await getRepository().getOwnSeller()
  } catch {
    return undefined
  }
}
