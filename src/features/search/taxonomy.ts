import { normalizeSearch } from '@/lib/format'

/** ASCII URL slug for Azerbaijani labels ("İynəyarpaqlılar" → "iyneyarpaqlilar", "Zeytun ağacı" → "zeytun-agaci"). */
export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Sub-categories per product category, from Figma "İdarəetmə · Kateqoriyalar" (second line of each row).
 * Variant 2: `kollar` and `otaq-bitkileri` replace "Dekorativ bitkilər" (their lists are placeholders until the
 * backend taxonomy exists) and "Dibçəklər və dekor" moved to `bag-avadanliqlari`. The same lists are kept in
 * @/data/postAd and @/data/admin. Used by the sidebar's sub-category list.
 *
 * No listing data here: client components import this module. Species (derived from the listings) are in species.ts.
 */
export const subcategoriesByCategory: Record<string, string[]> = {
  agaclar: ['Dekorativ ağaclar', 'Meyvə ağacları', 'İynəyarpaqlılar'],
  kollar: ['Həmişəyaşıl kollar', 'Çiçəkli kollar', 'Sarmaşıqlar'],
  guller: ['Qızılgüllər', 'Mövsümi güllər', 'Çoxillik güllər'],
  'otaq-bitkileri': ['Dekorativ yarpaqlı bitkilər', 'Çiçəkli otaq bitkiləri', 'Sukkulentlər'],
  'tingler-fidanlar': ['Meyvə fidanları', 'Üzüm tingləri', 'Giləmeyvə tingləri'],
  'cim-toxumlar': ['Rulon çim', 'Çim toxumu', 'Çiçək toxumu'],
  'torpaq-gubreler': ['Torpaq qarışıqları', 'Kompost', 'Mineral gübrələr'],
  'bag-avadanliqlari': ['Əl alətləri', 'Çim biçənlər', 'Bağ qayçıları', 'Dibçəklər və dekor'],
  'suvarma-sistemleri': ['Damcı suvarma', 'Çiləyicilər', 'İdarəedicilər'],
}

export function subcategoryOptions(categoryId: string): Array<{ value: string; label: string }> {
  return (subcategoriesByCategory[categoryId] ?? []).map((name) => ({ value: slugify(name), label: name }))
}

export function subcategoryName(categoryId: string, slug: string): string | undefined {
  return subcategoriesByCategory[categoryId]?.find((name) => slugify(name) === slug)
}
