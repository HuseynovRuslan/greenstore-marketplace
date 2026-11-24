import type { AccountProfile } from '@/data/user'
import type { UploadedPhoto } from '@/types'
import { saveProfilePhoto, startProfilePhotoUpload, type ProfilePhotoSlot } from '@/features/account/actions'
import { cropWindow, outputSize, type CropSpec, type CropState } from './cropGeometry'

/*
 * The «mağaza»'s logo and cover on /kabinet/profil. The picture is cropped in the browser (PhotoCropDialog), so what
 * is sent already has the slot's shape and size: a square logo up to 800 px, a 4:1 cover up to 2400 × 600 px.
 * DATA_SOURCE=api: the browser sends it straight to the API (an upload address from the site's server, then the file),
 * then the photo is put on the profile. DATA_SOURCE=mock: the cropped picture stays in this browser's session.
 */

export type { ProfilePhotoSlot }

export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PROFILE_PHOTO_MAX_MB = 10

/** The API's sizes (PhotoRules: a logo at least 400 × 400, a cover at least 1200 × 300) and what is sent. */
export const PHOTO_SPECS: Record<ProfilePhotoSlot, CropSpec & { name: string; minText: string }> = {
  logo: { aspect: 1, minWidth: 400, outWidth: 800, maxZoom: 4, name: 'Loqo', minText: '400 × 400' },
  cover: { aspect: 4, minWidth: 1200, outWidth: 2400, maxZoom: 3, name: 'Üz şəkli', minText: '1200 × 300' },
}

/** Why a chosen file cannot be used, before it is even opened. */
export function fileProblem(file: Pick<File, 'type' | 'size'>): string | undefined {
  if (!PROFILE_PHOTO_TYPES.includes(file.type)) return 'Yalnız JPG, PNG və ya WebP şəkil seçin.'
  if (file.size > PROFILE_PHOTO_MAX_MB * 1024 * 1024) return `Şəkil ${PROFILE_PHOTO_MAX_MB} MB-dan böyük olmamalıdır.`
  return undefined
}

/** Why a picture of this size cannot be the slot's photo (too small to crop at the API's minimum). */
export function sizeProblem(slot: ProfilePhotoSlot, width: number, height: number): string | undefined {
  const spec = PHOTO_SPECS[slot]
  const fits = Math.min(width, height * spec.aspect) >= spec.minWidth
  return fits ? undefined : `Şəkil çox kiçikdir (${width} × ${height}). ${spec.name} üçün ən azı ${spec.minText} piksel olsun.`
}

/** Why the API refused the file (the `code` of its ProblemDetails), in the seller's words. */
export function uploadErrorText(slot: ProfilePhotoSlot, code: string | undefined): string {
  const spec = PHOTO_SPECS[slot]
  switch (code) {
    case 'photo.too-small':
      return `Şəkil çox kiçikdir. ${spec.name} üçün ən azı ${spec.minText} piksel olsun.`
    case 'photo.wrong-shape':
      return slot === 'logo' ? 'Loqo kvadrat olmalıdır. Şəkli yenidən kəsin.' : 'Üz şəkli 4:1 ölçüsündə olmalıdır. Şəkli yenidən kəsin.'
    case 'photo.too-large':
      return `Şəkil ${PROFILE_PHOTO_MAX_MB} MB-dan böyükdür.`
    case 'photo.unsupported-type':
      return 'Yalnız JPG, PNG və ya WebP şəkil göndərmək olar.'
    case 'photo.unreadable':
    case 'photo.empty':
      return 'Şəkli aça bilmədik, fayl zədəli ola bilər. Başqa şəkil seçin.'
    default:
      return 'Şəkli yükləmək alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin.'
  }
}

/** A chosen file, opened: its address in this browser and its size (turned upright, as browsers draw it). */
export interface OpenedImage {
  url: string
  width: number
  height: number
}

/** Opens the file as an image; rejects when the browser cannot read it. */
export function openImage(file: Blob): Promise<OpenedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable image'))
    }
    image.src = url
  })
}

/** Draws the crop at its output size and encodes it: WebP where the browser can, JPEG otherwise. */
export async function renderCrop(image: HTMLImageElement, state: CropState, slot: ProfilePhotoSlot): Promise<Blob> {
  const spec = PHOTO_SPECS[slot]
  const crop = cropWindow(state, image.naturalWidth, image.naturalHeight, spec)
  const size = outputSize(crop, spec)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no canvas')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, size.width, size.height)
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
  const webp = await encode('image/webp')
  // A browser without a WebP encoder answers PNG (large); JPEG then.
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg')
  if (!blob) throw new Error('could not encode')
  return blob
}

export type PhotoSaveOutcome = { ok: true; account: AccountProfile } | { ok: false; error: string; signedOut?: boolean }

/** The `code` of a refused upload's ProblemDetails, when the body has one. */
async function problemCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: unknown }
    return typeof body.code === 'string' ? body.code : undefined
  } catch {
    return undefined
  }
}

/**
 * DATA_SOURCE=api: an upload address, the file, then the photo on the profile. An address that has run out (10
 * minutes) is asked for once more. The steps are passed in so the tests can stand in for the server.
 */
export async function uploadProfilePhoto(
  slot: ProfilePhotoSlot,
  blob: Blob,
  steps: { start: typeof startProfilePhotoUpload; save: typeof saveProfilePhoto; put: typeof fetch } = {
    start: startProfilePhotoUpload,
    save: saveProfilePhoto,
    put: (...args) => fetch(...args),
  },
  attempt = 0,
): Promise<PhotoSaveOutcome> {
  const contentType = blob.type || 'image/jpeg'
  let address
  try {
    address = await steps.start({ slot, contentType, bytes: blob.size })
  } catch {
    return { ok: false, error: uploadErrorText(slot, undefined) }
  }
  if (!address.ok) return address
  let response: Response
  try {
    response = await steps.put(address.upload.uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } })
  } catch {
    return { ok: false, error: uploadErrorText(slot, undefined) }
  }
  if (!response.ok) {
    const code = await problemCode(response)
    if ((code === 'photo.upload-expired' || code === 'photo.upload-not-found') && attempt === 0) return uploadProfilePhoto(slot, blob, steps, 1)
    return { ok: false, error: uploadErrorText(slot, code) }
  }
  const uploaded = (await response.json()) as UploadedPhoto
  try {
    return await steps.save(slot, uploaded.photoId)
  } catch {
    return { ok: false, error: 'Şəkli saxlamaq alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}

/** DATA_SOURCE=mock: the picture itself, as a data: URL kept in the session. */
export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('could not read'))
    reader.readAsDataURL(blob)
  })
}
