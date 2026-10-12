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

const byId = new Map(cities.map((c) => [c.id, c]))

export function cityName(id: string): string {
  return byId.get(id)?.name ?? id
}
