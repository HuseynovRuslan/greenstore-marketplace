'use server'

import { getRepository } from '@/services/repository'
import type { Listing, ListingStats } from '@/types'

export type OwnListingsResult = { ok: true; listings: Listing[]; stats: Record<string, ListingStats> } | { ok: false; error: string }

/**
 * «Elanlarım» data: every listing of the seller in every status, with owner statistics. In the real API the session
 * decides the seller; the demo session lives in the browser, so the id comes from the client (DEMO ONLY).
 */
export async function loadOwnListings(sellerId: string): Promise<OwnListingsResult> {
  if (typeof sellerId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(sellerId)) return { ok: true, listings: [], stats: {} }
  try {
    const repo = getRepository()
    const listings = await repo.listOwnListings(sellerId)
    const stats = Object.fromEntries(
      (await Promise.all(listings.map(async (l) => [l.id, await repo.getListingStats(l.id)] as const))).filter((e): e is [string, ListingStats] => Boolean(e[1])),
    )
    return { ok: true, listings, stats }
  } catch {
    return { ok: false, error: 'Elanları yükləmək alınmadı.' }
  }
}
