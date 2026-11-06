'use client'

import { SearchX } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { FilterChip } from './searchUrl'

interface CatalogEmptyStateProps {
  chips: FilterChip[]
  /** Listings left after removing each chip (by chip key), from the server. */
  removalCounts: Record<string, number>
  /** Filters set (without the search word). */
  filterCount: number
  onRemove: (chip: FilterChip) => void
  onReset: () => void
  /** Opens the whole catalogue (no search word, no filters). */
  onShowAll: () => void
}

/**
 * Zero results: says so, then offers a way out instead of a dead end. Up to three chips whose removal brings
 * listings back, with how many («100 ₼-a qədər» olmadan: 4 elan), then «Filtrləri sıfırla» (keeps the search word)
 * or, with only a search word, «Bütün elanlara bax».
 */
export function CatalogEmptyState({ chips, removalCounts, filterCount, onRemove, onReset, onShowAll }: CatalogEmptyStateProps) {
  const suggestions = chips
    .filter((chip) => (removalCounts[chip.key] ?? 0) > 0)
    .sort((a, b) => removalCounts[b.key] - removalCounts[a.key])
    .slice(0, 3)
  const quoted = (chip: FilterChip) => (chip.key === 'q' ? chip.label : `«${chip.label}»`)

  return (
    <div className="flex w-full max-w-[560px] flex-col items-start gap-4 rounded-panel border border-line bg-surface p-5 md:p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-mint text-forest">
        <SearchX aria-hidden size={24} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg leading-[1.3] font-semibold text-forest md:text-xl">Bu seçimə uyğun elan yoxdur</h2>
        <p className="text-[15px] leading-[1.5] text-muted">
          {suggestions.length > 0 ? 'Bir filtri çıxarsanız, elanlar görünəcək:' : 'Başqa açar söz sınayın və ya filtrləri sıfırlayın.'}
        </p>
      </div>
      {suggestions.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {suggestions.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => onRemove(chip)}
                // Option-pill look, but long search words may wrap.
                className="min-h-11 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-left text-sm leading-[1.3] font-medium text-ink transition-colors duration-(--dur-fast) hover:border-forest"
              >
                {quoted(chip)} olmadan: <span className="tabular-nums">{formatNumber(removalCounts[chip.key])}</span> elan
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={filterCount > 0 ? onReset : onShowAll}
        className="h-12 rounded-option bg-forest px-6 text-base leading-[normal] font-semibold text-white transition-colors duration-(--dur-fast) hover:bg-forest-hover"
      >
        {filterCount > 0 ? 'Filtrləri sıfırla' : 'Bütün elanlara bax'}
      </button>
    </div>
  )
}
