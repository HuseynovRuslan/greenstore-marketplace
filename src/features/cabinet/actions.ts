'use server'

import { updateTag } from 'next/cache'
import { isApiError, listingCacheTags } from '@/services/apiRepository'
import { getRepository, isNotImplemented } from '@/services/repository'
import { dataSource } from '@/seo/env'
import type { ListingStats, OwnListing } from '@/types'

export type OwnListingsResult = { ok: true; listings: OwnListing[]; stats: Record<string, ListingStats> } | { ok: false; error: string; signedOut?: boolean }

/** Statistics asked for at once; a cabinet of 200 listings must not open 200 connections to the API. */
const STATS_PARALLEL = 6

/** Runs `load` for every item, a few at a time, and keeps the answers in the items' order. */
async function inBatches<T, R>(items: T[], size: number, load: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) results.push(...(await Promise.all(items.slice(i, i + size).map(load))))
  return results
}

/**
 * «Elanlarım» data: every listing of the signed-in owner in every status, with owner statistics. The session decides
 * whose (backend-contract.md 2.2): DATA_SOURCE=api reads it from the session cookie; the mock answers for its demo
 * seller (the page only asks when the browser's demo session has one).
 */
export async function loadOwnListings(): Promise<OwnListingsResult> {
  try {
    const repo = getRepository()
    const listings = await repo.listOwnListings()
    const stats = Object.fromEntries(
      (
        await inBatches(listings, STATS_PARALLEL, async (l) => {
          try {
            return [l.id, await repo.getListingStats(l.id)] as const
          } catch (error) {
            // A repository without owner statistics yet: the numbers are left out.
            if (isNotImplemented(error)) return [l.id, undefined] as const
            throw error
          }
        })
      ).filter((e): e is readonly [string, ListingStats] => Boolean(e[1])),
    )
    return { ok: true, listings, stats }
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true }
    return { ok: false, error: 'Elanları yükləmək alınmadı.' }
  }
}

export type OwnListingAction = 'renew' | 'deactivate' | 'activate' | 'delete'

export type CabinetChangeResult = { ok: true; listing?: OwnListing } | { ok: false; error: string; signedOut?: boolean }

const ACTIONS: OwnListingAction[] = ['renew', 'deactivate', 'activate', 'delete']
const ID_RE = /^[a-z0-9-]{1,80}$/

/** Refreshes the pages the listing is on (or was): the change shows at once, not after the minute's cache. */
function refreshPages(listing: OwnListing | undefined) {
  if (listing && dataSource() === 'api') for (const tag of listingCacheTags(listing)) updateTag(tag)
}

/**
 * «Yenilə», «Deaktiv et», «Aktiv et» and «Sil» on one of the owner's listings (backend-contract.md 3.3). Answers with
 * the listing as it is now (none after «Sil»). The API decides what is allowed in which status.
 */
export async function changeOwnListing(id: string, action: OwnListingAction): Promise<CabinetChangeResult> {
  if (typeof id !== 'string' || !ID_RE.test(id) || !ACTIONS.includes(action)) return { ok: false, error: 'Əməliyyatı etmək alınmadı. Səhifəni yeniləyin.' }
  const repo = getRepository()
  try {
    if (action === 'delete') {
      // Read first: the pages to refresh are named by its address and seller.
      const listing = await repo.getOwnListing(id)
      if (!listing) return { ok: false, error: 'Elan tapılmadı: artıq silinmiş ola bilər.' }
      await repo.deleteListing(id)
      refreshPages(listing)
      return { ok: true }
    }
    const listing = action === 'renew' ? await repo.renewListing(id) : action === 'deactivate' ? await repo.deactivateListing(id) : await repo.activateListing(id)
    refreshPages(listing)
    return { ok: true, listing }
  } catch (error) {
    if (isApiError(error) && error.status === 401) return { ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true }
    if (isApiError(error, 'listing.wrong-status')) return { ok: false, error: 'Elanın vəziyyəti bu arada dəyişib. Səhifəni yeniləyin.' }
    if (isApiError(error, 'listing.not-found')) return { ok: false, error: 'Elan tapılmadı: artıq silinmiş ola bilər.' }
    return { ok: false, error: 'Əməliyyatı etmək alınmadı. Bir az sonra yenidən cəhd edin.' }
  }
}
