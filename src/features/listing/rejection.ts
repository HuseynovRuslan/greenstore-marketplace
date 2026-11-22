import type { Listing, OwnListing, RejectionReasonCode } from '@/types'

/**
 * The moderator's reasons (backend-contract.md 3.5): the API sends a code, the site words it in its own language, so
 * the owner reads the reason in theirs. The same order and words as the demo's list (src/data/admin.ts).
 */
export const rejectionReasonLabels: Record<RejectionReasonCode, string> = {
  'wrong-category': 'Kateqoriya uyğun deyil',
  'wrong-price': 'Qiymət düzgün göstərilməyib',
  'unverified-contact': 'Əlaqə məlumatı təsdiqlənməyib',
  'bad-photos': 'Şəkillər tələblərə uyğun deyil',
  duplicate: 'Təkrar elan',
  other: 'Digər',
}

export const rejectionReasonCodes = Object.keys(rejectionReasonLabels) as RejectionReasonCode[]

const sentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`)

/**
 * Why the listing was refused, for its owner: the reason's words and the moderator's own note («Şəkillər tələblərə
 * uyğun deyil. Şəkillərdə başqa bitki görünür.»); «Digər» shows the note alone. The demo data has the text itself.
 */
export function rejectionText(listing: Pick<Listing, 'rejectionReason'> & Partial<Pick<OwnListing, 'rejectionReasonCode' | 'rejectionNote'>>): string | undefined {
  const note = listing.rejectionNote?.trim()
  const code = listing.rejectionReasonCode
  if (code) {
    if (code === 'other') return note ? sentence(note) : undefined
    return note ? `${sentence(rejectionReasonLabels[code])} ${sentence(note)}` : sentence(rejectionReasonLabels[code])
  }
  return note ? sentence(note) : listing.rejectionReason
}
