import type { Listing } from '@/types'

const img = (file: string) => `/images/listings/${file}.webp`

/*
 * Figma attaches a different photo of the same product to each card size. `ListingCard` shows `listing.cover`
 * (the photo of the home-page card); these maps hold the photos the detail and seller frames use instead.
 */

/** 3-column cards (424 × 340, photo 396 × 210): "Satıcının digər elanları", seller page grid. */
export const wideCardImages: Record<string, string> = {
  'torpaq-qarisigi': img('torpaq-qarisigi-4'),
}

/** 4-column cards (313 × 340, photo 285 × 210): "Oxşar elanlar". */
export const narrowCardImages: Record<string, string> = {
  'mavi-kuknar': img('mavi-kuknar-5'),
  'yapon-agcaqayini': img('yapon-agcaqayini-4'),
}

export function withCardImage(listing: Listing, images: Record<string, string>): Listing {
  const cover = images[listing.id]
  return cover ? { ...listing, cover } : listing
}
