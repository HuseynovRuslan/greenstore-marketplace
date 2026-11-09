import { subcategoriesOf, subcategoryById } from '@/data/categories'
import { normalizeSearch } from '@/lib/format'

/** ASCII URL slug for Azerbaijani labels ("İynəyarpaqlılar" → "iyneyarpaqlilar", "Zeytun ağacı" → "zeytun-agaci"). */
export function slugify(value: string): string {
  return normalizeSearch(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/*
 * Sub-categories as the catalogue uses them: the URL's `alt` holds the sub-category id, which is unique across
 * categories (src/data/categories.ts). No listing data here: client components import this module. Species
 * (derived from the listings) are in species.ts.
 */

export function subcategoryOptions(categoryId: string): Array<{ value: string; label: string }> {
  return subcategoriesOf(categoryId).map((s) => ({ value: s.id, label: s.name }))
}

/** The name of a sub-category id, when it belongs to the category. */
export function subcategoryName(categoryId: string, id: string): string | undefined {
  const sub = subcategoryById(id)
  return sub && sub.categoryId === categoryId ? sub.name : undefined
}
