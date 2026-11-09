import { subcategoriesOf } from '@/data/categories'
import { phoneFieldError } from '@/lib/phone'
import { parseNumberValue, SERVICE_CATEGORY, visibleAttributes } from './attributes'
import { DESCRIPTION_MAX, DESCRIPTION_MIN, MAX_PHOTOS, TITLE_MAX, TITLE_MIN, type PostingDraft, type StepNumber } from './draft'

/*
 * Step validation of «Elan yerləşdir». Errors are keyed by field id (the DOM id of the control is `f-<key>`), worded
 * as what to do (ux-writing). The same rules run in the Server Action before the listing is sent.
 */

export type StepErrors = Record<string, string>

export const fieldDomId = (key: string) => `f-${key.replace(/\./g, '-')}`

/** A phone number typed into the text (7+ digits in a row, spaces and dashes allowed). */
const PHONE_IN_TEXT = /(?:\+?\d[\s-]?){9,}/

const MAX_PRICE = 1_000_000

function numberError(value: string | undefined, opts: { label: string; required?: boolean; min?: number; max?: number; negative?: boolean; integer?: boolean }) {
  const raw = value?.trim() ?? ''
  if (!raw) return opts.required ? `${opts.label} yazın.` : undefined
  const n = parseNumberValue(raw)
  if (n == null) return `${opts.label} rəqəmlə yazın.`
  if (!opts.negative && n < 0) return `${opts.label} sıfırdan az ola bilməz.`
  if (opts.integer && !Number.isInteger(n)) return `${opts.label} tam ədədlə yazın.`
  if (opts.min != null && n < opts.min) return `${opts.label} ən azı ${opts.min} olmalıdır.`
  if (opts.max != null && n > opts.max) return `${opts.label} ${opts.max}-dən çox ola bilməz.`
  return undefined
}

export function validateStep(step: StepNumber, d: PostingDraft): StepErrors {
  const e: StepErrors = {}
  const set = (key: string, message: string | undefined) => {
    if (message) e[key] = message
  }

  switch (step) {
    case 1: {
      // An edit keeps the published listing's category (locked in the form).
      if (d.editing) break
      if (!d.kind) e.kind = 'Məhsul və ya xidmət seçin.'
      else if (!d.categoryId) e.categoryId = d.kind === 'service' ? 'Xidmət növünü seçin.' : 'Kateqoriyanı seçin.'
      else if (d.kind === 'service' ? !d.subcategory : subcategoriesOf(d.categoryId).length > 0 && !d.subcategory)
        e.subcategory = d.kind === 'service' ? 'Xidmətin növünü seçin.' : 'Alt kateqoriyanı seçin.'
      break
    }

    case 2: {
      const title = d.title.trim()
      if (!title) e.title = 'Başlıq yazın: alıcı ilk onu görür.'
      else if (title.length < TITLE_MIN) e.title = `Başlıq ən azı ${TITLE_MIN} simvol olmalıdır.`
      else if (title.length > TITLE_MAX) e.title = `Başlığı ${TITLE_MAX} simvola qədər qısaldın.`
      for (const a of visibleAttributes(d.categoryId, d.attrs)) {
        const v = d.attrs[a.id]
        if (a.kind === 'range') {
          set(`attr.${a.id}Min`, numberError(d.attrs[`${a.id}Min`], { label: a.label, required: a.required, min: a.min, max: a.max }))
          const max = numberError(d.attrs[`${a.id}Max`], { label: a.label, min: a.min, max: a.max })
          const lo = parseNumberValue(d.attrs[`${a.id}Min`])
          const hi = parseNumberValue(d.attrs[`${a.id}Max`])
          set(`attr.${a.id}Max`, max ?? (lo != null && hi != null && hi < lo ? 'İkinci ədəd birincidən kiçik ola bilməz.' : undefined))
        } else if (a.kind === 'number') {
          set(`attr.${a.id}`, numberError(v, { label: a.label, required: a.required, min: a.min, max: a.max, negative: a.negative }))
        } else if (a.required && !v?.trim()) {
          set(`attr.${a.id}`, a.kind === 'cities' ? 'Ən azı bir ərazi seçin.' : a.kind === 'choice' ? `${a.label}: birini seçin.` : `${a.label} yazın.`)
        } else if (a.maxLength && v && v.length > a.maxLength) {
          set(`attr.${a.id}`, `${a.maxLength} simvoldan uzun olmasın.`)
        }
      }
      const text = d.description.trim()
      if (!text) e.description = 'Təsvir yazın: vəziyyəti, ölçünü, nə daxil olduğunu.'
      else if (text.length < DESCRIPTION_MIN) e.description = `Bir az ətraflı yazın: ən azı ${DESCRIPTION_MIN} simvol.`
      else if (text.length > DESCRIPTION_MAX) e.description = `Təsvir ${DESCRIPTION_MAX} simvoldan uzun ola bilməz.`
      else if (PHONE_IN_TEXT.test(text)) e.description = 'Telefon nömrəsini təsvirdən çıxarın: onu «Əlaqə» addımında göstərəcəyik.'
      break
    }

    case 3:
      if (d.photos.length === 0) e.photos = 'Ən azı bir şəkil əlavə edin: şəkilsiz elanlara az baxırlar.'
      else if (d.photos.length > MAX_PHOTOS) e.photos = `Ən çoxu ${MAX_PHOTOS} şəkil saxlayın.`
      break

    case 4: {
      if (d.priceType !== 'agreement') {
        set('price', numberError(d.price, { label: 'Qiyməti', required: true, min: 0.01, max: MAX_PRICE }))
        if (!d.priceUnit) e.priceUnit = 'Qiymətin nəyə görə olduğunu seçin.'
        if (d.wholesale) {
          const retail = parseNumberValue(d.price)
          const bulk = parseNumberValue(d.wholesalePrice)
          set('wholesalePrice', numberError(d.wholesalePrice, { label: 'Topdan qiyməti', required: true, min: 0.01, max: MAX_PRICE }))
          if (!e.wholesalePrice && retail != null && bulk != null && bulk >= retail) e.wholesalePrice = 'Topdan qiymət adi qiymətdən aşağı olmalıdır.'
          set('wholesaleMin', numberError(d.wholesaleMin, { label: 'Minimum miqdarı', required: true, min: 2, max: 1_000_000, integer: true }))
        }
      }
      set('quantity', numberError(d.quantity, { label: 'Miqdarı', min: 1, max: 10_000_000, integer: true }))
      if (!d.cityId) e.cityId = 'Şəhər və ya rayonu seçin.'
      if (d.area.length > 80) e.area = 'Ərazini 80 simvola qədər yazın.'
      if (d.delivery && d.kind !== 'service' && !d.deliveryAreas.trim()) e.deliveryAreas = 'Hara çatdırdığınızı yazın.'
      break
    }

    case 5: {
      const name = d.contactName.trim()
      if (!name) e.contactName = 'Adınızı yazın: alıcı kiminlə danışdığını bilsin.'
      else if (name.length < 2 || name.length > 50) e.contactName = 'Ad 2–50 simvol olmalıdır.'
      set('phone', phoneFieldError(d.phone))
      if (d.hidePhone && !d.whatsapp) e.whatsapp = 'Nömrə gizlidirsə, alıcılar sizə yalnız WhatsApp-da yaza bilər. WhatsApp-ı açın.'
      break
    }

    case 6:
      if (!d.rulesAccepted) e.rulesAccepted = 'Göndərmək üçün elan qaydaları ilə razılaşın.'
      break
  }
  return e
}

export const isStepValid = (step: StepNumber, d: PostingDraft) => Object.keys(validateStep(step, d)).length === 0

/** First step from 1 to `upTo` that does not pass (checked before jumping ahead and before sending). */
export function firstInvalidStep(d: PostingDraft, upTo: StepNumber = 6): StepNumber | undefined {
  for (let s = 1; s <= upTo; s++) if (!isStepValid(s as StepNumber, d)) return s as StepNumber
  return undefined
}

/** Is the category the service one? (Some fields read differently.) */
export const isServiceDraft = (d: PostingDraft) => d.kind === 'service' || d.categoryId === SERVICE_CATEGORY
