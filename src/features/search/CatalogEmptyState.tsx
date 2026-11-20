'use client'

import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ServiceMatches } from './serviceMatches'
import type { FilterChip } from './searchUrl'

interface CatalogEmptyStateProps {
  chips: FilterChip[]
  /** Listings left after removing each chip (by chip key), from the server. */
  removalCounts: Record<string, number>
  /** Services that match the search word (the catalogue itself is products only). */
  services?: ServiceMatches
  /** Filters set (without the search word). */
  filterCount: number
  onRemove: (chip: FilterChip) => void
  onReset: () => void
  /** Opens the whole catalogue (no search word, no filters). */
  onShowAll: () => void
}

const buttonBase =
  'flex h-12 items-center justify-center rounded-option px-6 text-base leading-[normal] font-semibold transition-colors duration-(--dur-fast)'
const primaryClass = `${buttonBase} bg-forest text-white hover:bg-forest-hover`
const secondaryClass = `${buttonBase} border border-forest text-forest hover:bg-mint`

/**
 * Zero results: says so, then offers a way out instead of a dead end. When the word is a service («qazon», often
 * from «Hamısı» on the home page), «Xidmətlərə bax» leads and «Bütün elanlara bax» / «Filtrləri sıfırla» sits
 * beside it. Otherwise up to three chips whose removal brings listings back, with how many («100 ₼-a qədər»
 * olmadan: 4 elan), then «Filtrləri sıfırla» (keeps the search word) or, with only a search word, «Bütün elanlara bax».
 */
export function CatalogEmptyState({ chips, removalCounts, services, filterCount, onRemove, onReset, onShowAll }: CatalogEmptyStateProps) {
  const suggestions = services
    ? []
    : chips
        .filter((chip) => (removalCounts[chip.key] ?? 0) > 0)
        .sort((a, b) => removalCounts[b.key] - removalCounts[a.key])
        .slice(0, 3)
  const quoted = (chip: FilterChip) => (chip.key === 'q' ? chip.label : `«${chip.label}»`)
  const fallback = (
    <button type="button" onClick={filterCount > 0 ? onReset : onShowAll} className={services ? secondaryClass : primaryClass}>
      {filterCount > 0 ? 'Filtrləri sıfırla' : 'Bütün elanlara bax'}
    </button>
  )

  return (
    <div className="flex w-full max-w-[560px] flex-col items-start gap-4 rounded-panel border border-line bg-surface p-5 md:p-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-mint text-forest">
        <SearchX aria-hidden size={24} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg leading-[1.3] font-semibold text-forest md:text-xl">Bu seçimə uyğun elan yoxdur</h2>
        <p className="text-[15px] leading-[1.5] break-words text-muted">
          {services ? (
            <>
              «{services.q}» xidmətlərdə var:{' '}
              <span className="font-semibold whitespace-nowrap text-ink tabular-nums">{formatNumber(services.total)} xidmət</span>.
            </>
          ) : suggestions.length > 0 ? (
            'Bir filtri çıxarsanız, elanlar görünəcək:'
          ) : (
            'Başqa açar söz sınayın və ya filtrləri sıfırlayın.'
          )}
        </p>
      </div>
      {services ? (
        // Phones: one full-width action per row, so they read as a pair, not a ragged edge.
        <div className="flex flex-wrap gap-3 max-sm:w-full max-sm:flex-col">
          <Link href={services.href} className={primaryClass}>
            Xidmətlərə bax
          </Link>
          {fallback}
        </div>
      ) : (
        <>
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
          {fallback}
        </>
      )}
    </div>
  )
}
