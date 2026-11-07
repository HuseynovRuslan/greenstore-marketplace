import { cityName } from '@/data/cities'
import { listingById } from '@/data/listings'
import { sellerById } from '@/data/sellers'
import { complaints as figmaComplaints, complaintTotals, type Complaint, type ComplaintStatus } from '@/data/admin'
import type { Listing } from '@/types'

/** Complaint as handled in this session (Figma data + decisions). */
export interface ComplaintState extends Complaint {
  /** "Elanı dayandır" confirmed */
  listingSuspended?: boolean
}

export const initialComplaints = (): ComplaintState[] => figmaComplaints.map((c) => ({ ...c, history: [...c.history] }))

export const complaintStatuses: ComplaintStatus[] = ['open', 'investigating', 'resolved']

/** Chip/header counts: Figma totals include complaints outside the visible list. */
export function complaintCounts(items: ComplaintState[]): Record<ComplaintStatus, number> {
  const result = {} as Record<ComplaintStatus, number>
  for (const status of complaintStatuses) {
    const hidden = complaintTotals[status] - figmaComplaints.filter((c) => c.status === status).length
    result[status] = hidden + items.filter((c) => c.status === status).length
  }
  return result
}

export function complaintListing(c: Complaint): Listing | undefined {
  return listingById(c.listingId)
}

/** "№ 10430 · Lənkəran · Rauf Məmmədov · 80–100 sm · Meyvəli" — verbatim when Figma has it, otherwise from listing data. */
export function complaintListingMeta(c: Complaint, listing: Listing | undefined): string {
  if (c.listingMeta) return c.listingMeta
  if (!listing) return `№ ${c.listingNumber}`
  return [`№ ${c.listingNumber}`, cityName(listing.cityId), sellerById(listing.sellerId)?.name, ...listing.attributes].filter(Boolean).join(' · ')
}

/** Default value of "Vəziyyət seçin": an open complaint is suggested for investigation (Figma: "Araşdırılır"). */
export const suggestedStatus = (status: ComplaintStatus): ComplaintStatus => (status === 'open' ? 'investigating' : status)

export const statusChangeText: Record<ComplaintStatus, string> = {
  open: 'Şikayət yenidən açıldı.',
  investigating: 'Şikayət araşdırmaya götürüldü.',
  resolved: 'Şikayət bağlandı.',
}
