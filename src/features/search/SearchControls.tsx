'use client'

import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { ArrowDownUp, ChevronDown, LayoutGrid, List, X } from 'lucide-react'
import { AnimatePresence, useIsPresent } from 'motion/react'
import * as m from 'motion/react-m'
import { loadDomMax, MotionFeatures } from '@/components/motion/MotionFeatures'
import { chipEnter, chipExit, chipLayout } from '@/components/motion/springs'
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
            'flex h-full w-[42px] items-center justify-center rounded-[7px] transition-[color,background-color,scale] duration-(--dur-fast) ease-out active:scale-[0.95] motion-reduce:active:scale-100',
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
 * A chip (or «Sıfırla») in the row: it scales in from .95 and fades, leaves the same way, and slides to its new
 * place when a neighbour comes or goes (Motion layout, springs in components/motion/springs.ts). While it leaves it
 * is inert and marked `data-exiting`, so focus never lands on it. Reduced motion: opacity only.
 */
function RowItem({ ref, ...props }: ComponentProps<typeof m.button>) {
  const present = useIsPresent()
  return (
    <m.button
      ref={ref}
      layout="position"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: chipExit }}
      transition={{ default: chipEnter, layout: chipLayout }}
      data-exiting={present ? undefined : ''}
      inert={!present || undefined}
      {...props}
    />
  )
}

/**
 * Active filters above the results: one removable chip per filter, in the home's forest-filled chip style, then
 * «Sıfırla» (clears the filters, keeps the search word). The row wraps instead of scrolling, so no chip is cut off.
 * Chips enter and leave with a spring and their neighbours close the gap (popLayout pulls a leaving chip out of
 * the flow at once). Removing a chip moves focus to the chip that takes its place, then to «Sıfırla», then to the
 * heading. The row stays until the last chip has finished leaving.
 */
export function ActiveFilterRow({ chips, filterCount, onRemove, onReset, fallbackFocusId }: ActiveFilterRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const focusAt = useRef<number | null>(null)
  const [shown, setShown] = useState(chips.length > 0)
  if (chips.length > 0 && !shown) setShown(true)
  const empty = useRef(chips.length === 0)
  useLayoutEffect(() => {
    empty.current = chips.length === 0
  })

  useLayoutEffect(() => {
    const index = focusAt.current
    if (index == null) return
    focusAt.current = null
    const targets = [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-chip]:not([data-exiting]), [data-reset]:not([data-exiting])') ?? [])]
    const target = targets[Math.min(index, targets.length - 1)] ?? document.getElementById(fallbackFocusId)
    target?.focus()
  })

  if (!shown) return null
  return (
    <MotionFeatures load={loadDomMax}>
      <div ref={rowRef} role="group" aria-label="Seçilmiş filtrlər" className="relative flex w-full flex-wrap items-center gap-2">
        <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => empty.current && setShown(false)}>
          {chips.map((chip, i) => (
            <RowItem
              key={chip.key}
              type="button"
              data-chip=""
              onClick={() => {
                focusAt.current = i
                onRemove(chip)
              }}
              aria-label={chip.key === 'q' ? `${chip.label} axtarış sözünü sil` : `${chip.label} filtrini sil`}
              // A chip never gets wider than the row (a pasted search word made the page scroll sideways): the
              // label truncates, the × stays; the full text is in the name and the page heading.
              className={cn(chipClass({ on: true }), 'max-w-full max-md:h-11')}
            >
              <span className="min-w-0 truncate">{chip.label}</span>
              <X aria-hidden size={15} strokeWidth={2.2} className="-mr-1 shrink-0" />
            </RowItem>
          ))}
          {filterCount > 0 && (
            <RowItem
              key="reset"
              type="button"
              data-reset=""
              onClick={() => {
                // The chips that stay (the search word) keep their place; focus goes to the first of them.
                focusAt.current = 0
                onReset()
              }}
              className="h-[38px] rounded-lg px-2.5 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] transition-[color,scale] duration-(--dur-fast) ease-out hover:text-olive-text active:scale-[0.97] motion-reduce:active:scale-100 max-md:h-11"
            >
              Sıfırla
            </RowItem>
          )}
        </AnimatePresence>
      </div>
    </MotionFeatures>
  )
}
