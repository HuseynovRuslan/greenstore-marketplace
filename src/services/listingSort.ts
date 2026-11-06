/** Sort orders of listing lists (catalogue, seller page). No data here, so client components can import it. */
export type ListingSort = 'newest' | 'price-asc' | 'price-desc'

export const listingSortOptions: Array<{ value: ListingSort; label: string }> = [
  { value: 'newest', label: 'Ən yenilər' },
  { value: 'price-asc', label: 'Əvvəlcə ucuz' },
  { value: 'price-desc', label: 'Əvvəlcə bahalı' },
]
