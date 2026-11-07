import type { BadgeTone } from '@/components/ui/Badge'
import type { Listing, ListingStatus, PromotionPackageId } from '@/types'

/*
 * «Elanlarım» (Nov 2026). The owner's listings come from the API (listOwnListings + getListingStats); what the owner
 * does in this browser — renew, deactivate, delete, promote, edit — is kept as local changes over them (DEMO: the
 * API would store these). Pure helpers, tested in src/test/cabinet.test.ts.
 */

export const LISTING_LIFETIME_DAYS = 30
const DAY_MS = 86_400_000

export type CabinetTab = 'all' | ListingStatus

export const cabinetTabs: Array<{ key: CabinetTab; label: string; param: string }> = [
  { key: 'all', label: 'Hamısı', param: '' },
  { key: 'active', label: 'Aktiv', param: 'aktiv' },
  { key: 'pending', label: 'Yoxlamada', param: 'yoxlamada' },
  { key: 'expired', label: 'Müddəti bitib', param: 'bitib' },
  { key: 'rejected', label: 'Rədd edilib', param: 'redd' },
  { key: 'inactive', label: 'Deaktiv', param: 'deaktiv' },
  { key: 'draft', label: 'Qaralamalar', param: 'qaralama' },
]

export const tabFromParam = (param: string | null): CabinetTab => cabinetTabs.find((t) => t.param && t.param === param)?.key ?? 'all'

export const statusBadges: Record<ListingStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Aktiv', tone: 'success' },
  pending: { label: 'Yoxlamada', tone: 'warning' },
  rejected: { label: 'Rədd edilib', tone: 'danger' },
  expired: { label: 'Müddəti bitib', tone: 'neutral' },
  inactive: { label: 'Deaktiv', tone: 'neutral' },
  draft: { label: 'Qaralama', tone: 'neutral' },
}

/** Local change to one of the owner's listings. */
export interface ListingChange {
  status?: ListingStatus
  expiresAt?: string
  updatedAt?: string
  removed?: boolean
  promotion?: { packageId: PromotionPackageId; until: string }
  bumpedAt?: string
}

export type ChangeMap = Record<string, ListingChange>

/**
 * The owner's list: server listings, replaced by a newer local version with the same id (an edit sent from this
 * browser), plus listings sent from this browser, with the local changes applied; removed ones dropped. Newest first.
 */
export function mergeOwnListings(server: Listing[], local: Listing[], changes: ChangeMap): Listing[] {
  const localIds = new Set(local.map((l) => l.id))
  const all = [...local, ...server.filter((l) => !localIds.has(l.id))]
  return all
    .filter((l) => !changes[l.id]?.removed)
    .map((l) => {
      const { removed: _removed, promotion, ...change } = changes[l.id] ?? {}
      void _removed
      return { ...l, ...change, ...(promotion ? { promotion, vip: promotion.packageId !== 'ireli-cek' || l.vip } : {}) }
    })
    .sort((a, b) => (b.updatedAt ?? b.publishedAt).localeCompare(a.updatedAt ?? a.publishedAt))
}

export function countByStatus(listings: Listing[], drafts: number): Record<CabinetTab, number> {
  const counts = { all: listings.length + drafts, active: 0, pending: 0, rejected: 0, expired: 0, inactive: 0, draft: drafts } as Record<CabinetTab, number>
  for (const l of listings) if (l.status !== 'draft') counts[l.status] += 1
  return counts
}

/** Whole days until the listing expires (0 = today, negative = past). */
export function daysLeft(listing: Pick<Listing, 'expiresAt'>, now: number): number | undefined {
  if (!listing.expiresAt) return undefined
  return Math.ceil((Date.parse(listing.expiresAt) - now) / DAY_MS)
}

/** «Yenilə»: 30 more days from now, back to active (free on GreenStore). */
export function renewal(now: number): ListingChange {
  const iso = new Date(now).toISOString()
  return { status: 'active', updatedAt: iso, expiresAt: new Date(now + LISTING_LIFETIME_DAYS * DAY_MS).toISOString() }
}

/** Actions the owner has on a listing in this status, in button order (the first is the main one). */
export type CabinetAction = 'promote' | 'edit' | 'stats' | 'deactivate' | 'activate' | 'renew' | 'fix' | 'preview' | 'remove'

export function actionsFor(status: ListingStatus): CabinetAction[] {
  switch (status) {
    case 'active':
      return ['promote', 'edit', 'stats', 'deactivate', 'remove']
    case 'pending':
      return ['preview', 'edit', 'remove']
    case 'expired':
      return ['renew', 'edit', 'remove']
    case 'rejected':
      return ['fix', 'remove']
    case 'inactive':
      return ['activate', 'edit', 'remove']
    default:
      return ['edit', 'remove']
  }
}

/** «20 gün qalıb», «Sabah bitir», «Bu gün bitir» — the line under an active listing. */
export function expiryLabel(days: number | undefined): { text: string; soon: boolean } | undefined {
  if (days == null) return undefined
  if (days <= 0) return { text: 'Bu gün bitir', soon: true }
  if (days === 1) return { text: 'Sabah bitir', soon: true }
  return { text: `${days} gün qalıb`, soon: days <= 3 }
}
