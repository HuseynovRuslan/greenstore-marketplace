import type { UploadedPhoto } from '@/types'
import { startPhotoUpload, type PhotoUploadResult } from './actions'
import type { DraftPhoto } from './draft'
import { MIN_SIDE, photoStore } from './photos'

/*
 * DATA_SOURCE=api: the draft's photos go to the API before «Elanı göndər» sends the listing (backend-contract.md
 * 3.2). The site's server asks for a one-time address per photo (`startPhotoUpload`), and the browser sends the file
 * there itself, straight to the API. A photo uploaded once keeps its API id in the draft, so a retry sends only what
 * is missing. Photos stay in the browser until sending: a guest can fill the whole form before signing in.
 */

export type UploadOutcome = { ok: true; photos: DraftPhoto[] } | { ok: false; error: string; signedOut?: boolean }

/** At most this many files on their way at once. */
const PARALLEL = 3

/** Why the API refused a file (the `code` of its ProblemDetails), in the seller's words. */
export function uploadErrorText(code: string | undefined, name: string): string {
  switch (code) {
    case 'photo.too-small':
      return `«${name}»: şəkil çox kiçikdir. Ən azı ${MIN_SIDE} piksel olsun.`
    case 'photo.too-large':
      return `«${name}»: fayl 10 MB-dan böyükdür.`
    case 'photo.too-many-pixels':
      return `«${name}»: şəkil çox böyükdür (50 meqapikseldən çox). Kiçik ölçüdə göndərin.`
    case 'photo.unsupported-type':
      return `«${name}»: yalnız JPG, PNG və ya WebP şəkil göndərmək olar.`
    case 'photo.unreadable':
    case 'photo.empty':
      return `«${name}»: şəkli aça bilmədik, fayl zədəli ola bilər. Başqa şəkil seçin.`
    default:
      return `«${name}»: şəkli yükləmək alınmadı. İnternet bağlantısını yoxlayıb yenidən göndərin.`
  }
}

/** The `code` of a refused upload's ProblemDetails, when the body has one. */
async function problemCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

type One = { ok: true; photo: DraftPhoto } | { ok: false; error: string; signedOut?: boolean }

/** One photo: an address, then the file. An address that has run out (10 minutes) is asked for once more. */
async function uploadOne(photo: DraftPhoto, ask: typeof startPhotoUpload, attempt = 0): Promise<One> {
  const blob = await photoStore.get(photo.id)
  if (!blob) return { ok: false, error: `«${photo.name}» şəkli bu brauzerdə tapılmadı. Silib yenidən əlavə edin.` }
  const contentType = blob.type || 'image/jpeg'
  let address: PhotoUploadResult
  try {
    address = await ask({ fileName: photo.name, contentType, bytes: blob.size })
  } catch {
    return { ok: false, error: uploadErrorText(undefined, photo.name) }
  }
  if (!address.ok) return address
  let response: Response
  try {
    response = await fetch(address.upload.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } })
  } catch {
    return { ok: false, error: uploadErrorText(undefined, photo.name) }
  }
  if (!response.ok) {
    const code = await problemCode(response)
    if ((code === 'photo.upload-expired' || code === 'photo.upload-not-found') && attempt === 0) return uploadOne(photo, ask, 1)
    return { ok: false, error: uploadErrorText(code, photo.name) }
  }
  const uploaded = (await response.json()) as UploadedPhoto
  return { ok: true, photo: { ...photo, remoteId: uploaded.photoId, url: uploaded.url } }
}

/**
 * Uploads every photo of the draft that has no API id yet, a few at a time, in the draft's order. `onProgress` hears
 * how many are done of how many go; `onUploaded` each photo as it arrives (the wizard keeps it in the draft, so a
 * failure later does not lose it). Stops at the first refusal.
 */
export async function uploadDraftPhotos(
  photos: DraftPhoto[],
  { onProgress, onUploaded, ask = startPhotoUpload }: { onProgress?: (done: number, total: number) => void; onUploaded?: (photo: DraftPhoto) => void; ask?: typeof startPhotoUpload } = {},
): Promise<UploadOutcome> {
  const result = [...photos]
  const waiting = result.map((p, index) => ({ p, index })).filter(({ p }) => !p.remoteId)
  const total = waiting.length
  let done = 0
  let failure: Extract<One, { ok: false }> | undefined
  onProgress?.(0, total)
  const worker = async () => {
    while (!failure) {
      const next = waiting.shift()
      if (!next) return
      const outcome = await uploadOne(next.p, ask)
      if (!outcome.ok) {
        failure ??= outcome
        return
      }
      result[next.index] = outcome.photo
      onUploaded?.(outcome.photo)
      onProgress?.(++done, total)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker))
  return failure ? failure : { ok: true, photos: result }
}
