import type { ReportReason, ReportTarget } from '@/types'

/*
 * «Şikayət et» reasons. turbo.az lists ten fixed reasons; these are the ones that make sense for plants, services and
 * sellers (docs/research/turbo-functional-analysis.md, row 34). The API takes the code (backend-contract.md 4.1), the
 * site words it, so moderators can filter by reason and the text can be translated. «Digər səbəb» asks for an
 * explanation.
 */

export interface ComplaintReason {
  code: ReportReason
  label: string
}

/** «Digər səbəb»: the comment is required. */
export const OTHER_REASON: ReportReason = 'other'

const other: ComplaintReason = { code: OTHER_REASON, label: 'Digər səbəb' }

export const listingComplaintReasons: ComplaintReason[] = [
  { code: 'sold', label: 'Satılıb və ya aktual deyil' },
  { code: 'wrong-price', label: 'Qiymət düzgün deyil' },
  { code: 'wrong-photos', label: 'Şəkillər bu bitki deyil' },
  { code: 'wrong-info', label: 'Məlumat düzgün deyil' },
  { code: 'unreachable', label: 'Satıcı ilə əlaqə saxlamaq olmur' },
  { code: 'duplicate', label: 'Təkrar elan' },
  { code: 'fraud', label: 'Dələduzluq şübhəsi' },
  other,
]

export const sellerComplaintReasons: ComplaintReason[] = [
  { code: 'unreachable', label: 'Satıcı ilə əlaqə saxlamaq olmur' },
  { code: 'wrong-info', label: 'Məlumat düzgün deyil' },
  { code: 'misconduct', label: 'Uyğun olmayan davranış' },
  { code: 'fraud', label: 'Dələduzluq şübhəsi' },
  other,
]

export const serviceComplaintReasons: ComplaintReason[] = [
  { code: 'not-provided', label: 'Xidmət göstərilmir' },
  { code: 'wrong-price', label: 'Qiymət düzgün deyil' },
  { code: 'stolen-photos', label: 'Şəkillər başqasının işidir' },
  { code: 'unreachable', label: 'Əlaqə saxlamaq olmur' },
  { code: 'fraud', label: 'Dələduzluq şübhəsi' },
  other,
]

/** The reasons each target offers, in the dialog's order (the API allows exactly these). */
export const complaintReasonsFor: Record<ReportTarget, ComplaintReason[]> = {
  listing: listingComplaintReasons,
  seller: sellerComplaintReasons,
  service: serviceComplaintReasons,
}

/** Is `reason` one of the target's codes? (A Server Action receives anything.) */
export function isReasonFor(target: ReportTarget, reason: unknown): reason is ReportReason {
  return complaintReasonsFor[target].some((r) => r.code === reason)
}

/** A reason's words for the target it was given for («Əlaqə saxlamaq olmur» on a service), for the staff's list too. */
export function complaintReasonLabel(target: ReportTarget, reason: ReportReason): string {
  return (complaintReasonsFor[target].find((r) => r.code === reason) ?? Object.values(complaintReasonsFor).flat().find((r) => r.code === reason))?.label ?? reason
}
