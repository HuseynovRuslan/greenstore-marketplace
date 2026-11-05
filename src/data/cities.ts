import type { City } from '@/types'

/** Cities/regions that appear in the Figma file (search select "Şəhər seçin", listing cards, seller cards). */
export const cities: City[] = [
  { id: 'baki', name: 'Bakı' },
  { id: 'abseron', name: 'Abşeron' },
  { id: 'sumqayit', name: 'Sumqayıt' },
  { id: 'gence', name: 'Gəncə' },
  { id: 'seki', name: 'Şəki' },
  { id: 'quba', name: 'Quba' },
  { id: 'lenkeran', name: 'Lənkəran' },
]

/**
 * Listings per city (mock), shown next to each option of the home search city field.
 * `City` has no count field, so the numbers live here; they add up to `listingTotals.all` ("Bütün şəhərlər").
 */
export const cityListingCounts: Record<string, number> = {
  baki: 1620,
  abseron: 980,
  sumqayit: 310,
  gence: 420,
  seki: 210,
  quba: 290,
  lenkeran: 210,
}

const byId = new Map(cities.map((c) => [c.id, c]))

export function cityName(id: string): string {
  return byId.get(id)?.name ?? id
}
