import { MAX_PHOTOS, TITLE_MAX, type PostAdDraft, type StepNumber } from '@/data/postAd'
import { isPlant, isService, parseHeightRange, parseNumber } from './draft'

export type FieldKey = keyof PostAdDraft
export type StepErrors = Partial<Record<FieldKey, string>>

/** Fields whose error is shown while typing (as in Figma: the height range and "−10" price states). */
export const LIVE_FIELDS: FieldKey[] = ['heightRange', 'price']

const required = (value: string, message: string) => (value.trim() ? undefined : message)

function wholeNumber(value: string, empty: string, invalid: string, { positive }: { positive: boolean }) {
  const n = parseNumber(value)
  if (n == null) return empty
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 0 || (positive && n === 0)) return invalid
  return undefined
}

/** "+994 50 555 12 34" (spaces, dashes and brackets are ignored). */
export function isValidPhone(value: string): boolean {
  return /^\+994\d{9}$/.test(value.replace(/[\s()-]/g, ''))
}

export function validateStep(step: StepNumber, d: PostAdDraft): StepErrors {
  const e: StepErrors = {}
  const set = (key: FieldKey, message: string | undefined) => {
    if (message) e[key] = message
  }

  switch (step) {
    case 1:
      if (!d.kind) e.kind = 'Elan növünü seçin.'
      break

    case 2:
      if (isService(d)) {
        set('serviceType', required(d.serviceType, 'İş növünü seçin.'))
        set('serviceArea', required(d.serviceArea, 'Xidmət ərazisini yazın.'))
        set('sellerKind', required(d.sellerKind, 'Satıcı növünü seçin.'))
        break
      }
      set('categoryId', required(d.categoryId, 'Kateqoriyanı seçin.'))
      set('subcategory', required(d.subcategory, 'Alt kateqoriyanı seçin.'))
      if (isPlant(d)) {
        set('plantType', required(d.plantType, 'Bitki növünü seçin.'))
        set('growingForm', required(d.growingForm, 'Yetişdirmə formasını seçin.'))
        set('height', wholeNumber(d.height, 'Hündürlüyü yazın.', 'Hündürlüyü müsbət tam rəqəmlə yazın.', { positive: true }))
        set('age', wholeNumber(d.age, 'Yaşı yazın.', 'Yaşı tam rəqəmlə yazın.', { positive: false }))
        const range = parseHeightRange(d.heightRange)
        if (range === 'format') e.heightRange = 'Aralığı “100–120” formatında yazın.'
        else if (range && range.max < range.min) e.heightRange = 'Maksimum hündürlük minimumdan az ola bilməz. Məsələn: 100–120 sm.'
      }
      set('availability', required(d.availability, 'Mövcudluğu seçin.'))
      set('sellerKind', required(d.sellerKind, 'Satıcı növünü seçin.'))
      break

    case 3:
      if (d.photos.length === 0) e.photos = 'Ən azı bir şəkil əlavə edin.'
      else if (d.photos.length > MAX_PHOTOS) e.photos = `Ən çoxu ${MAX_PHOTOS} şəkil əlavə edə bilərsiniz.`
      if (!d.title.trim()) e.title = 'Elanın başlığını yazın.'
      else if (d.title.length > TITLE_MAX) e.title = `Başlıq ${TITLE_MAX} simvoldan uzun ola bilməz.`
      set('description', required(d.description, 'Təsviri yazın.'))
      break

    case 4: {
      if (!(isService(d) && d.servicePriceType === 'agreement')) {
        const price = parseNumber(d.price)
        if (price == null) e.price = 'Qiyməti yazın.'
        else if (Number.isNaN(price)) e.price = 'Qiyməti rəqəmlə yazın.'
        else if (price < 0) e.price = 'Qiymət sıfırdan az ola bilməz.'
      }
      if (!isService(d)) set('priceUnit', required(d.priceUnit, 'Qiymət vahidini seçin.'))
      set('cityId', required(d.cityId, 'Şəhər və ya rayonu seçin.'))
      set('village', required(d.village, 'Qəsəbə və ya kəndi yazın.'))
      if (!isService(d) && d.delivery) set('deliveryAreas', required(d.deliveryAreas, 'Çatdırılma ərazilərini yazın.'))
      break
    }

    case 5:
      set('sellerName', required(d.sellerName, 'Satıcının adını yazın.'))
      set('contactPerson', required(d.contactPerson, 'Əlaqələndirici şəxsin adını yazın.'))
      if (!d.phone.trim()) e.phone = 'Telefon nömrəsini yazın.'
      else if (!isValidPhone(d.phone)) e.phone = 'Nömrəni +994 50 555 12 34 formatında yazın.'
      set('contactHours', required(d.contactHours, 'Əlaqə saatlarını yazın.'))
      break

    case 6:
      if (!d.rulesAccepted) e.rulesAccepted = 'Elanı göndərmək üçün qaydaları qəbul edin.'
      break
  }
  return e
}

export const isStepValid = (step: StepNumber, d: PostAdDraft) => Object.keys(validateStep(step, d)).length === 0

/** First step in 1…`upTo` that does not validate (used before jumping ahead or submitting). */
export function firstInvalidStep(d: PostAdDraft, upTo: StepNumber): StepNumber | undefined {
  for (let s = 1; s <= upTo; s++) {
    if (!isStepValid(s as StepNumber, d)) return s as StepNumber
  }
  return undefined
}
