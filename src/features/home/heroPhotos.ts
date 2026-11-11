/**
 * Home hero background photos (HeroStage), in the order they rotate. The first is the LCP image: rendered on the
 * server and preloaded; the others load once the page is idle. The masters are 1672 × 941 WebP; next/image serves
 * AVIF / WebP at the screen's width.
 *
 * All three look down a nursery alley with the plants on both sides, so on wide screens (the whole width shows) the
 * plants frame the search card and only the vertical crop is chosen: `position` keeps the pots and trunks in and
 * most of the sky out. On phones the photo is cropped to a narrow strip, and `phonePosition` slides it to one row
 * of plants instead of the empty path in the middle.
 */
export interface HeroPhoto {
  src: string
  /** object-position from 768 px. */
  position: string
  /** object-position below 768 px. */
  phonePosition: string
}

export const heroPhotos: HeroPhoto[] = [
  // Olive trees on the left, lemon trees on the right, terracotta pots.
  { src: '/images/hero/hero-1.webp', position: '50% 62%', phonePosition: '20% 50%' },
  // Cypresses on the left, blue spruces under a shade net on the right, black pots.
  { src: '/images/hero/hero-2.webp', position: '50% 60%', phonePosition: '20% 50%' },
  // A lawn between hydrangeas and young trees.
  { src: '/images/hero/hero-3.webp', position: '50% 58%', phonePosition: '15% 50%' },
]
