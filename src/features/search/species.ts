/**
 * Species of the sample listings, derived from their titles. Reads the listing data, so it is for the server only
 * (the sidebar receives the options as props); taxonomy.ts holds the data-free part.
 *
 * With DATA_SOURCE=api there are no species: the sample titles are not the catalogue, and the API has no species
 * parameter (a «Növ» filter over `listings.species` comes when the group is shown again, SHOW_SPECIES_FILTER).
 * `parseSearchState` then drops `nov`, so no chip or heading claims a filter that the results do not apply.
 */
import { publicListings } from '@/data/listings'
import { compareAz } from '@/lib/format'
import { dataSource } from '@/seo/env'
import type { Listing } from '@/types'
import { slugify } from './taxonomy'

/** The listings the species come from: the sample data in mock mode, none with the API. */
function speciesSource(): Listing[] {
  return dataSource() === 'api' ? [] : publicListings
}

/** "Zeytun ağacı — Olea europaea" → "Zeytun ağacı" (the part before the latin name / variety). */
export function speciesName(listing: Listing): string {
  return listing.title.split(' — ')[0].trim()
}

export function speciesSlug(listing: Listing): string {
  return slugify(speciesName(listing))
}

/** «Növ» options: the species that have public listings in the chosen category (all categories when empty). */
export function speciesOptions(categoryId: string): Array<{ value: string; label: string }> {
  const names = new Map<string, string>()
  for (const l of speciesSource()) {
    if (categoryId && l.categoryId !== categoryId) continue
    names.set(speciesSlug(l), speciesName(l))
  }
  return [...names]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => compareAz(a.label, b.label))
}

export function speciesLabel(slug: string): string | undefined {
  const match = speciesSource().find((l) => speciesSlug(l) === slug)
  return match ? speciesName(match) : undefined
}
