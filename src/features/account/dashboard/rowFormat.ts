import type { BadgeTone } from '@/components/ui/Badge'
import { cityName } from '@/data/cities'
import { formatFullDate, formatNumber } from '@/lib/format'
import type { ListingStatus } from '@/types'
import type { MyListingRow } from './useMyListingRows'

/* Figma "Nişan": Aktiv=success, Yoxlamada=warning, Rədd edilib=danger, Müddəti bitib=neutral. "Deaktiv" is not in Figma. */
export const statusBadge: Record<ListingStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Aktiv', tone: 'success' },
  pending: { label: 'Yoxlamada', tone: 'warning' },
  rejected: { label: 'Rədd edilib', tone: 'danger' },
  expired: { label: 'Müddəti bitib', tone: 'neutral' },
  inactive: { label: 'Deaktiv', tone: 'neutral' },
}

/** "№ 10482 · Abşeron · 12 oktyabr 2026 · 248 baxış" */
export function rowMeta(row: MyListingRow) {
  const parts = [
    row.listing.number ? `№ ${row.listing.number}` : null,
    cityName(row.listing.cityId),
    formatFullDate(row.date),
    `${row.views == null ? '—' : formatNumber(row.views)} baxış`,
  ]
  return parts.filter(Boolean).join(' · ')
}
