import type { Listing } from '@/types'

/**
 * The Figma search frame ("Məhsul axtarışı · 1440", grid "Elanlar") shows a different photo of some listings
 * than the home page cards that `Listing.cover` follows. Photos per Figma image node (see image-manifest.json):
 * 4:35311 zeytun-agaci-5 · 4:35319 mavi-kuknar-4 · 4:35332 tuya-smaragd-2 · 4:35342 defne-agaci-2
 * (4:35327 qaracohre-1 and 4:35337 italyan-sami-1 are already the covers). All are in `listing.images`.
 */
const searchCoverById: Record<string, string> = {
  'zeytun-agaci': '/images/listings/zeytun-agaci-5.webp',
  'mavi-kuknar': '/images/listings/mavi-kuknar-4.webp',
  'tuya-smaragd': '/images/listings/tuya-smaragd-2.webp',
  'defne-agaci': '/images/listings/defne-agaci-2.webp',
}

/** Listing as shown on the search page (same data, search-frame photo where Figma uses a different one). */
export function withSearchCover(listing: Listing): Listing {
  const cover = searchCoverById[listing.id]
  return cover ? { ...listing, cover } : listing
}
