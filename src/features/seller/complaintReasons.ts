/*
 * «Şikayət et» reasons. turbo.az lists ten fixed reasons; these are the ones that make sense for plants, services and
 * sellers (docs/research/turbo-functional-analysis.md, row 34). «Digər səbəb» asks for an explanation.
 */
export const OTHER_REASON = 'Digər səbəb'

export const listingComplaintReasons = [
  'Satılıb və ya aktual deyil',
  'Qiymət düzgün deyil',
  'Şəkillər bu bitki deyil',
  'Məlumat düzgün deyil',
  'Satıcı ilə əlaqə saxlamaq olmur',
  'Təkrar elan',
  'Dələduzluq şübhəsi',
  OTHER_REASON,
]

export const sellerComplaintReasons = ['Satıcı ilə əlaqə saxlamaq olmur', 'Məlumat düzgün deyil', 'Uyğun olmayan davranış', 'Dələduzluq şübhəsi', OTHER_REASON]

export const serviceComplaintReasons = ['Xidmət göstərilmir', 'Qiymət düzgün deyil', 'Şəkillər başqasının işidir', 'Əlaqə saxlamaq olmur', 'Dələduzluq şübhəsi', OTHER_REASON]
