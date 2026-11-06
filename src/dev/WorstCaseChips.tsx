'use client'

import { useId, useState } from 'react'
import { ActiveFilterRow } from '@/features/search/SearchControls'
import type { FilterChip } from '@/features/search/searchUrl'

/**
 * The catalogue's active-filter row on /dev/worst-case: chips are removed in local state (no navigation), so the
 * row can be stress-tested and its enter / leave motion watched; «Hamısını qaytar» brings them all back.
 */
export function WorstCaseChips({ chips: initial }: { chips: FilterChip[] }) {
  const headingId = useId()
  const [chips, setChips] = useState(initial)
  const filterCount = chips.filter((chip) => chip.key !== 'q').length
  return (
    <section aria-labelledby={headingId} className="flex w-full max-w-[1056px] flex-col items-start gap-3">
      <h2 id={headingId} tabIndex={-1} className="text-sm leading-[normal] font-semibold text-forest outline-none">
        Seçilmiş filtrlər ({chips.length})
      </h2>
      <ActiveFilterRow
        chips={chips}
        filterCount={filterCount}
        onRemove={(chip) => setChips((all) => all.filter((c) => c.key !== chip.key))}
        onReset={() => setChips((all) => all.filter((c) => c.key === 'q'))}
        fallbackFocusId={headingId}
      />
      <button
        type="button"
        onClick={() => setChips(initial)}
        disabled={chips.length === initial.length}
        className="h-10 rounded-option border border-line-strong bg-surface px-3.5 text-sm leading-[normal] font-medium text-ink disabled:text-muted"
      >
        Hamısını qaytar
      </button>
    </section>
  )
}
