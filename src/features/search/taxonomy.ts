import { publicListings } from '@/data/listings'
import { compareAz, normalizeSearch } from '@/lib/format'
import type { Listing } from '@/types'

/** ASCII URL slug for Azerbaijani labels ("İynəyarpaqlılar" → "iyneyarpaqlilar", "Zeytun ağacı" → "zeytun-agaci"). */
export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Sub-categories per product category, verbatim from Figma "İdarəetmə · Kateqoriyalar" (second line of each row).
 * Used by the "Alt kateqoriya seçin" filter.
 */
export const subcategoriesByCategory: Record<string, string[]> = {
  agaclar: ['Dekorativ ağaclar', 'Meyvə ağacları', 'İynəyarpaqlılar'],
  'dekorativ-bitkiler': ['Otaq bitkiləri', 'Kollar', 'Sarmaşıqlar'],
  guller: ['Qızılgüllər', 'Mövsümi güllər', 'Çoxillik güllər'],
  'tingler-fidanlar': ['Meyvə fidanları', 'Üzüm tingləri', 'Giləmeyvə tingləri'],
  'cim-toxumlar': ['Rulon çim', 'Çim toxumu', 'Çiçək toxumu'],
  'torpaq-gubreler': ['Torpaq qarışıqları', 'Kompost', 'Mineral gübrələr'],
  'dibcekler-dekorasiya': ['Dibçəklər', 'Bağ dekoru', 'Çiçək qutuları'],
  'suvarma-sistemleri': ['Damcı suvarma', 'Çiləyicilər', 'İdarəedicilər'],
  'bag-avadanliqlari': ['Əl alətləri', 'Çim biçənlər', 'Bağ qayçıları'],
}

export function subcategoryOptions(categoryId: string): Array<{ value: string; label: string }> {
  return (subcategoriesByCategory[categoryId] ?? []).map((name) => ({ value: slugify(name), label: name }))
}

export function subcategoryName(categoryId: string, slug: string): string | undefined {
  return subcategoriesByCategory[categoryId]?.find((name) => slugify(name) === slug)
}

/** "Zeytun ağacı — Olea europaea" → "Zeytun ağacı" (the part before the latin name / variety). */
export function speciesName(listing: Listing): string {
  return listing.title.split(' — ')[0].trim()
}

export function speciesSlug(listing: Listing): string {
  return slugify(speciesName(listing))
}

/** "Ağac növü seçin" options: the species that have public listings in the chosen category (all categories when empty). */
export function speciesOptions(categoryId: string): Array<{ value: string; label: string }> {
  const names = new Map<string, string>()
  for (const l of publicListings) {
    if (categoryId && l.categoryId !== categoryId) continue
    names.set(speciesSlug(l), speciesName(l))
  }
  return [...names]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => compareAz(a.label, b.label))
}

export function speciesLabel(slug: string): string | undefined {
  const match = publicListings.find((l) => speciesSlug(l) === slug)
  return match ? speciesName(match) : undefined
}
