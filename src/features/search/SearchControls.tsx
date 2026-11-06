'use client'

import { useLayoutEffect, useRef } from 'react'
import { ArrowDownUp, ChevronDown, LayoutGrid, List, X } from 'lucide-react'
import { Listbox, listboxChevronClass } from '@/components/ui/Listbox'
import { cn } from '@/lib/format'
import { listingSortOptions, type ListingSort } from '@/services/listingSort'
import { chipClass } from './FilterControls'
import type { FilterChip, SearchView } from './searchUrl'

/**
 * Sort control (catalogue, seller page): the site Listbox from md up, a native <select> on phones, both with the
 * same bordered look. A fixed width keeps the row still when the label changes.
 */
export function SortSelect({ value, onChange, className }: { value: ListingSort; onChange: (sort: ListingSort) => void; className?: string }) {
  const icon = <ArrowDownUp aria-hidden size={16} strokeWidth={2} className="shrink-0 text-muted" />
  return (
    <div className={cn('shrink-0', className)}>
      <Listbox
        label="Sıralama"
        value={value}
        onChange={(v) => onChange(v as ListingSort)}
        options={listingSortOptions}
        icon={icon}
        align="end"
        className="hidden h-11 w-[200px] md:block"
        triggerClassName="border border-line-strong bg-surface transition-colors duration-(--dur-fast) hover:border-forest"
      />
      <label className="relative flex h-11 w-full min-w-0 items-center gap-2 rounded-option border border-line-strong bg-surface pl-3 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-olive md:hidden">
        {icon}
        <span className="sr-only">Sıralama</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ListingSort)}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-9 text-[15px] leading-[normal] font-medium text-ink outline-none pointer-coarse:text-base"
        >
          {listingSortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} strokeWidth={2} className={cn(listboxChevronClass, 'pointer-events-none absolute right-3')} />
      </label>
    </div>
  )
}

/** «Şəbəkə» / «Siyahı»: two 44 px icon buttons in one bordered group; the names stay for screen readers. */
export function ViewToggle({ view, onChange, className }: { view: SearchView; onChange: (view: SearchView) => void; className?: string }) {
  const items = [
    { value: 'grid' as const, label: 'Şəbəkə', Icon: LayoutGrid },
    { value: 'list' as const, label: 'Siyahı', Icon: List },
  ]
  return (
    <div role="group" aria-label="Görünüş" className={cn('flex h-11 shrink-0 rounded-option border border-line-strong bg-surface p-[3px]', className)}>
      {items.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            'flex h-full w-[42px] items-center justify-center rounded-[7px] transition-colors duration-(--dur-fast)',
            view === value ? 'bg-forest text-white' : 'text-ink hover:bg-mint hover:text-forest',
          )}
        >
          <Icon aria-hidden size={18} strokeWidth={2} />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}

interface ActiveFilterRowProps {
  chips: FilterChip[]
  /** Filters set (the search word does not count); «Sıfırla» shows from one. */
  filterCount: number
  onRemove: (chip: FilterChip) => void
  onReset: () => void
  /** Where focus goes when the last chip and «Sıfırla» are gone (the results heading). */
  fallbackFocusId: string
}

/**
 * Active filters above the results: one removable chip per filter, in the home's forest-filled chip style, then
 * «Sıfırla» (clears the filters, keeps the search word). The row wraps instead of scrolling, so no chip is cut off.
 * Removing a chip moves focus to the chip that takes its place, then to «Sıfırla», then to the heading.
 */
export function ActiveFilterRow({ chips, filterCount, onRemove, onReset, fallbackFocusId }: ActiveFilterRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const focusAt = useRef<number | null>(null)

  useLayoutEffect(() => {
    const index = focusAt.current
    if (index == null) return
    focusAt.current = null
    const targets = [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-chip], [data-reset]') ?? [])]
    const target = targets[Math.min(index, targets.length - 1)] ?? document.getElementById(fallbackFocusId)
    target?.focus()
  })

  if (!chips.length) return null
  return (
    <div ref={rowRef} role="group" aria-label="Seçilmiş filtrlər" className="flex w-full flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button
          key={chip.key}
          type="button"
          data-chip=""
          onClick={() => {
            focusAt.current = i
            onRemove(chip)
          }}
          aria-label={chip.key === 'q' ? `${chip.label} axtarış sözünü sil` : `${chip.label} filtrini sil`}
          className={cn(chipClass({ on: true }), 'max-md:h-11')}
        >
          {chip.label}
          <X aria-hidden size={15} strokeWidth={2.2} className="-mr-1 shrink-0" />
        </button>
      ))}
      {filterCount > 0 && (
        <button
          type="button"
          data-reset=""
          onClick={() => {
            // The chips that stay (the search word) keep their place; focus goes to the first of them.
            focusAt.current = 0
            onReset()
          }}
          className="h-[38px] rounded-lg px-2.5 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] hover:text-olive-text max-md:h-11"
        >
          Sıfırla
        </button>
      )}
    </div>
  )
}
