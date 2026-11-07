import { MAX_PHOTO_MB, MAX_PHOTOS, type DraftPhoto } from './draft'

/*
 * Photos of «Elan yerləşdir»: checks with a message per file, gallery order helpers, and the browser side —
 * decoding, scaling down to 2000 px (camera photos are 4–8 MB) and keeping the result in IndexedDB so the draft's
 * photos survive a reload. Nothing is uploaded in the demo (docs/handoff/contract-additions.md: POST /api/photos).
 */

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MIN_SIDE = 600
const MAX_SIDE = 2000

/** Why a file can't be used, or undefined when it can (type and size; dimensions are checked after decoding). */
export function fileError(file: { name: string; type: string; size: number }): string | undefined {
  const heic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)
  if (heic) return `«${file.name}»: HEIC formatını aça bilmirik. iPhone-da Parametrlər → Kamera → Formatlar → «Ən uyğun» seçin və ya JPG göndərin.`
  if (!ACCEPTED_TYPES.includes(file.type)) return `«${file.name}»: yalnız JPG, PNG və ya WebP şəkil əlavə edin.`
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `«${file.name}»: fayl ${MAX_PHOTO_MB} MB-dan böyükdür.`
  return undefined
}

export function sizeError(name: string, width: number, height: number): string | undefined {
  if (Math.min(width, height) < MIN_SIDE) return `«${name}»: şəkil çox kiçikdir (${width}×${height}). Ən azı ${MIN_SIDE} piksel olsun.`
  return undefined
}

/** How many of `incoming` still fit, and the message for the rest. */
export function fitCount(current: number, incoming: number): { take: number; message?: string } {
  const room = Math.max(0, MAX_PHOTOS - current)
  if (incoming <= room) return { take: incoming }
  const left = incoming - room
  return { take: room, message: `Ən çoxu ${MAX_PHOTOS} şəkil: ${left} şəkil əlavə olunmadı.` }
}

export function movePhoto(photos: DraftPhoto[], from: number, to: number): DraftPhoto[] {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos
  const next = [...photos]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export const makeCover = (photos: DraftPhoto[], index: number) => movePhoto(photos, index, 0)

/* ---------- Browser: decode, scale, store ---------- */

export interface ProcessedPhoto {
  photo: DraftPhoto
  blob: Blob
}

/** Decodes a picked file, checks its size and scales it to at most 2000 px (JPEG 0.86). */
export async function processFile(file: File, id: string): Promise<ProcessedPhoto | { error: string }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { error: `«${file.name}»: bu faylı şəkil kimi aça bilmədik.` }
  }
  const tooSmall = sizeError(file.name, bitmap.width, bitmap.height)
  if (tooSmall) {
    bitmap.close()
    return { error: tooSmall }
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!blob) return { error: `«${file.name}»: şəkli hazırlamaq alınmadı.` }
  return { photo: { id, name: file.name, width, height }, blob }
}

/** A smaller JPEG data URL of a stored photo, for the copy of a sent listing kept in «Elanlarım» (localStorage). */
export async function thumbnailDataUrl(blob: Blob, side = 900): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.74)
  } catch {
    return undefined
  }
}

const DB_NAME = 'greenstore-posting'
const STORE = 'photos'

function openDb(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(undefined)
  })
}

/** In-memory fallback when IndexedDB is unavailable (private mode, tests): photos last until the tab closes. */
const memory = new Map<string, Blob>()

export const photoStore = {
  async put(id: string, blob: Blob) {
    memory.set(id, blob)
    const db = await openDb()
    if (!db) return
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, id)
      tx.oncomplete = tx.onerror = () => resolve()
    })
  },
  async get(id: string): Promise<Blob | undefined> {
    if (memory.has(id)) return memory.get(id)
    const db = await openDb()
    if (!db) return undefined
    return new Promise((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get(id)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : undefined)
      request.onerror = () => resolve(undefined)
    })
  },
  async remove(ids: string[]) {
    ids.forEach((id) => memory.delete(id))
    const db = await openDb()
    if (!db) return
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      ids.forEach((id) => tx.objectStore(STORE).delete(id))
      tx.oncomplete = tx.onerror = () => resolve()
    })
  },
}

export const newPhotoId = () => `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
