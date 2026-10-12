import { useCallback, useMemo } from 'react'
import { useMyListings } from '@/app/store'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { dashboardRows, dashboardTotals } from '@/data/dashboard'
import { listingById, listings } from '@/data/listings'
import type { Listing, ListingStatus } from '@/types'

export type RowSource = 'submitted' | 'seed' | 'more'

export interface MyListingRow {
  listing: Listing
  status: ListingStatus
  /** ISO date shown in the meta line */
  date: string
  /** null → "— baxış" */
  views: number | null
  source: RowSource
}

export type StatusFilter = 'all' | 'active' | 'pending' | 'expired'

type Counts = Record<StatusFilter | 'inactive' | 'rejected', number>

/**
 * Rows of "Elanlarım" in the seller cabinet:
 *  1. listings submitted through "Elan yerləşdir" (pending, newest first),
 *  2. the four Figma rows (Zeytun ağacı, Tuya — Smaragd, Leyland sərvi — 120 sm, Lavanda fidanı),
 *  3. the seller's other listings from the catalogue (revealed by "Daha çox elan göstər").
 * Status changes made in the cabinet (deactivate / renew) are kept in localStorage for the static rows
 * and on the submitted listing itself for wizard listings. Counts start from the Figma totals and follow those changes.
 */
export function useMyListingRows(sellerId: string | undefined) {
  const { submitted, updateListing } = useMyListings()
  const [overrides, setOverrides] = useLocalStorage<Record<string, ListingStatus>>('greenstore:cabinet-status', {})

  const rows = useMemo<MyListingRow[]>(() => {
    const own: MyListingRow[] = submitted.map((l) => ({
      listing: l,
      status: l.status,
      date: l.publishedAt,
      views: l.views ?? null,
      source: 'submitted',
    }))
    if (!sellerId) return own

    const seedIds = new Set(dashboardRows.map((r) => r.listingId))
    const seed: MyListingRow[] = dashboardRows
      .map((r) => {
        const listing = listingById(r.listingId)
        return listing ? { listing, status: overrides[listing.id] ?? listing.status, date: r.date, views: r.views, source: 'seed' as const } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    const more: MyListingRow[] = listings
      .filter((l) => l.sellerId === sellerId && !seedIds.has(l.id))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((l) => ({ listing: l, status: overrides[l.id] ?? l.status, date: l.publishedAt, views: l.views ?? null, source: 'more' }))

    return [...own, ...seed, ...more]
  }, [submitted, sellerId, overrides])

  const counts = useMemo<Counts>(() => {
    const c: Counts = { ...dashboardTotals, inactive: 0, rejected: 0 }
    if (!sellerId) (Object.keys(c) as Array<keyof Counts>).forEach((k) => (c[k] = 0))
    for (const row of rows) {
      if (row.source === 'submitted') {
        c.all += 1
        c[row.status] += 1
      } else if (row.status !== row.listing.status) {
        c[row.listing.status] -= 1
        c[row.status] += 1
      }
    }
    return c
  }, [rows, sellerId])

  const setStatus = useCallback(
    (row: MyListingRow, status: ListingStatus) => {
      if (row.source === 'submitted') updateListing(row.listing.id, { status })
      else
        setOverrides((prev) => {
          const nextOverrides = { ...prev }
          if (status === row.listing.status) delete nextOverrides[row.listing.id]
          else nextOverrides[row.listing.id] = status
          return nextOverrides
        })
    },
    [updateListing, setOverrides],
  )

  return { rows, counts, setStatus }
}
