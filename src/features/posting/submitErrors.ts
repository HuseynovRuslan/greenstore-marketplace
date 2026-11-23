import { isApiError } from '@/services/apiRepository'
import type { StepNumber } from './draft'

/*
 * What a refused «Elanı göndər» tells the seller (DATA_SOURCE=api). The API checks a listing with the wizard's own
 * rules (backend-contract.md 3.3), so a refusal is rare: the field it names takes the seller back to its step.
 */

export const SIGNED_OUT = 'Sessiyanın vaxtı bitib. Yenidən daxil olun: qaralama bu brauzerdə saxlanılıb.'
const GENERIC = 'Elanı göndərmək alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin: qaralama saxlanılıb.'

export interface SubmitFailure {
  ok: false
  error: string
  step?: StepNumber
  signedOut?: boolean
  uploadAgain?: boolean
}

/** The step of a `ListingInput` field the API named (`title`, `plant.heightCm.min`, `attributes.availability`, …). */
export function stepOfField(field: string): StepNumber {
  const root = field.split('.')[0]
  if (['kind', 'categoryId', 'subcategory', 'subcategoryId'].includes(root)) return 1
  if (['title', 'description', 'attributes', 'plant'].includes(root)) return 2
  if (root === 'photoIds') return 3
  if (['contactName', 'contactPhone', 'whatsapp', 'phoneHidden'].includes(root)) return 5
  if (root === 'promotion') return 6
  return 4
}

const FIELD_NAMES: Record<string, string> = {
  kind: 'Elanın növü',
  categoryId: 'Kateqoriya',
  subcategory: 'Alt kateqoriya',
  subcategoryId: 'Alt kateqoriya',
  title: 'Başlıq',
  description: 'Təsvir',
  attributes: 'Xüsusiyyətlər',
  plant: 'Bitki haqqında',
  photoIds: 'Şəkillər',
  priceType: 'Qiymət',
  price: 'Qiymət',
  priceUnit: 'Vahid',
  wholesale: 'Topdan qiymət',
  quantityAvailable: 'Stokda neçə var',
  cityId: 'Şəhər və ya rayon',
  area: 'Ərazi',
  deliveryAreas: 'Hara çatdırırsınız',
  contactName: 'Adınız',
  contactPhone: 'Telefon nömrəsi',
  whatsapp: 'WhatsApp',
  promotion: 'Reklam',
}

/** The seller's words for one field error. */
export function fieldMessage(field: string, code: string): string {
  if (field === 'description' && code === 'contains-phone') return 'Təsvirdə telefon nömrəsi olmasın: nömrəni «Əlaqə» addımında yazın.'
  if (field === 'categoryId' && code === 'locked') return 'Dərc olunmuş elanın kateqoriyası dəyişmir.'
  if (field === 'photoIds') {
    if (code === 'too-many') return 'Ən çoxu 12 şəkil əlavə etmək olar.'
    if (code === 'duplicate') return 'Eyni şəkil iki dəfə əlavə olunub. Birini silin.'
    return 'Şəkillərdən biri tapılmadı. Yenidən göndərin: şəkillər təzədən yüklənəcək.'
  }
  if (field === 'wholesale.price' && code === 'not-below-price') return 'Topdan qiymət adi qiymətdən aşağı olmalıdır.'
  if (field === 'whatsapp') return 'Nömrəni gizlədirsinizsə, WhatsApp açıq olmalıdır.'
  const name = FIELD_NAMES[field.split('.')[0]] ?? 'Xana'
  return `«${name}» xanasını yoxlayın və yenidən göndərin.`
}

/** A refused send (or upload address) as the wizard shows it. */
export function submitFailure(error: unknown): SubmitFailure {
  if (!isApiError(error)) return { ok: false, error: GENERIC }
  if (error.status === 401) return { ok: false, error: SIGNED_OUT, signedOut: true }
  switch (error.code) {
    case 'listing.daily-limit':
      return { ok: false, error: 'Bu gün çox elan göndərmisiniz (24 saatda 30). Sabah yenidən cəhd edin: qaralama saxlanılıb.' }
    case 'idempotency.key-reused':
      return { ok: false, error: 'Bu elan artıq göndərilib. «Elanlarım» bölməsinə baxın.' }
    case 'concurrency-conflict':
      return { ok: false, error: 'Elan bu arada dəyişdirilib. «Elanlarım» bölməsindən yenidən açıb redaktə edin.' }
    case 'listing.not-found':
      return { ok: false, error: 'Elan tapılmadı: silinmiş ola bilər. «Elanlarım» bölməsinə baxın.' }
    case 'validation': {
      const [field, codes] = Object.entries(error.problem.errors ?? {})[0] ?? []
      if (!field) return { ok: false, error: GENERIC }
      const code = codes?.[0] ?? ''
      const uploadAgain = field === 'photoIds' && ['not-found', 'not-ready', 'in-use', 'invalid'].includes(code)
      return { ok: false, error: fieldMessage(field, code), step: stepOfField(field), ...(uploadAgain ? { uploadAgain } : {}) }
    }
    default:
      return { ok: false, error: GENERIC }
  }
}
