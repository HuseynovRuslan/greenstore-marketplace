/**
 * Species of the sample listings, derived from their titles. Reads the listing data, so it is for the server only
 * (the sidebar receives the options as props); taxonomy.ts holds the data-free part.
 */
import { publicListings } from '@/data/listings'
import { compareAz } from '@/lib/format'
import type { Listing } from '@/types'
import { slugify } from './taxonomy'

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
