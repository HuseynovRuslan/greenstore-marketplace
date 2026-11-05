'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/format'
import { ChoiceOptions, chipClass, optionClass, PriceFields, ToggleCheck } from './FilterChips'
import {
  activeFilterCount,
  choiceOptions,
  emptyHeroFilters,
  filterValueLabel,
  isFilterSet,
  priceError,
  visibleFilters,
  type ChoiceFilterId,
  type FilterId,
  type HeroFilters,
  type HeroTab,
} from './heroSearch'

/** Chips the phone row shows next to «Filtrlər» (Variant 2 mobile mockup); everything else lives in the sheet. */
const ROW_FILTERS: FilterId[] = ['category', 'price', 'height', 'delivery', 'planting']

interface MobileFilterRowProps {
  tab: HeroTab
  filters: HeroFilters
  onChange: (filters: HeroFilters) => void
  /** Opens the sheet, optionally at one filter's group. */
  onOpenSheet: (focus?: FilterId) => void
  sheetOpen: boolean
  className?: string
}

/**
 * Phones (< md): a horizontally scrolling row. «Filtrlər» (with the number of active filters) opens the sheet;
 * the other menu chips open it at their own group, toggles switch in place.
 */
export function MobileFilterRow({ tab, filters, onChange, onOpenSheet, sheetOpen, className }: MobileFilterRowProps) {
  const count = activeFilterCount(tab, filters)
  const visible = visibleFilters(tab).filter((f) => ROW_FILTERS.includes(f.id))
  return (
    <div role="group" aria-label="Filtrlər" className={cn('scrollbar-none flex gap-2 overflow-x-auto', className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        // The badge is visual; the name carries the count ("Filtrlər, 2 filtr seçilib").
        aria-label={count > 0 ? `Filtrlər, ${count} filtr seçilib` : undefined}
        onClick={() => onOpenSheet()}
        className="flex h-11 shrink-0 items-center gap-[7px] rounded-full border border-forest bg-surface px-3.5 text-sm leading-[normal] font-semibold text-forest transition-transform duration-(--dur-fast) active:scale-[0.97] motion-reduce:active:scale-100"
      >
        <SlidersHorizontal aria-hidden size={16} strokeWidth={2} />
        Filtrlər
        {count > 0 && (
          <span aria-hidden className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1.5 text-xs leading-none text-white tabular-nums">
            {count}
          </span>
        )}
      </button>
      {visible.map((def) => {
        const on = isFilterSet(def.id, filters)
        if (def.kind === 'toggle') {
          const id = def.id as 'delivery' | 'planting'
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => onChange({ ...filters, [id]: !on })} className={chipClass({ on, touch: true })}>
              {on && <ToggleCheck />}
              {def.label}
            </button>
          )
        }
        const value = filterValueLabel(def.id, filters, tab)
        return (
          <button
            key={def.id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={false}
            onClick={() => onOpenSheet(def.id)}
            className={chipClass({ on, touch: true })}
          >
            {value ? `${def.label}: ${value}` : def.label}
            <ChevronDown aria-hidden size={14} strokeWidth={2.2} className="shrink-0" />
          </button>
        )
      })}
    </div>
  )
}

interface HeroFilterSheetProps {
  open: boolean
  /** Group to scroll to and focus when the sheet opens from a chip. */
  focus?: FilterId
  tab: HeroTab
  filters: HeroFilters
  onChange: (filters: HeroFilters) => void
  onClose: () => void
  /** «Axtar» in the sheet runs the search; returns false when the price range is invalid. */
  onSearch: () => boolean
}

const groupId = (base: string, id: FilterId) => `${base}-${id}`

/** «Filtrlər» bottom sheet: every filter of the tab, «Sıfırla» and «Axtar». */
export function HeroFilterSheet({ open, focus, tab, filters, onChange, onClose, onSearch }: HeroFilterSheetProps) {
  const base = useId()
  const errorId = useId()
  const error = priceError(filters)
  const visible = visibleFilters(tab)
  const toggles = visible.filter((f) => f.kind === 'toggle')

  // The Dialog focuses its panel first (child effects run first); then jump to the chip's group.
  useEffect(() => {
    if (!open || !focus) return
    const group = document.getElementById(groupId(base, focus))
    group?.scrollIntoView?.({ block: 'nearest' })
    group?.querySelector<HTMLElement>('[data-autofocus], button, input')?.focus({ preventScroll: true })
  }, [open, focus, base])

  const section = (id: FilterId, title: string, body: ReactNode) => (
    <section key={id} id={groupId(base, id)} aria-labelledby={`${groupId(base, id)}-title`} className="flex scroll-mt-2 flex-col gap-3">
      <h3 id={`${groupId(base, id)}-title`} className="text-sm leading-[normal] font-semibold text-forest">
        {title}
      </h3>
      {body}
    </section>
  )

  return (
    <Dialog open={open} title="Filtrlər" onClose={onClose}>
      {visible.map((def) => {
        if (def.kind === 'toggle') return null
        if (def.id === 'price') {
          return section(def.id, def.title, <PriceFields filters={filters} onChange={onChange} error={error} errorId={errorId} touch />)
        }
        const id = def.id as ChoiceFilterId
        return section(
          id,
          def.title,
          <ChoiceOptions options={choiceOptions(id, tab)} value={filters[id]} onPick={(v) => onChange({ ...filters, [id]: v })} touch />,
        )
      })}
      {toggles.length > 0 &&
        section(
          toggles[0].id,
          'Əlavə',
          <div className="flex flex-wrap gap-2">
            {toggles.map((def) => {
              const id = def.id as 'delivery' | 'planting'
              const on = filters[id]
              return (
                <button key={id} type="button" aria-pressed={on} onClick={() => onChange({ ...filters, [id]: !on })} className={cn(optionClass(on, true), 'flex items-center gap-[7px]')}>
                  {on && <ToggleCheck />}
                  {def.label}
                </button>
              )
            })}
          </div>,
        )}
      <div className="sticky -bottom-6 -mx-6 -mb-6 flex items-center justify-between gap-3 border-t border-line bg-surface px-6 pt-4 pb-6">
        <button
          type="button"
          onClick={() => onChange(emptyHeroFilters)}
          disabled={activeFilterCount(tab, filters) === 0}
          className="h-11 rounded-lg px-2 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] disabled:text-muted disabled:no-underline"
        >
          Sıfırla
        </button>
        <button
          type="button"
          onClick={() => {
            if (onSearch()) onClose()
          }}
          className="h-12 rounded-option bg-forest px-8 text-base leading-[normal] font-semibold text-white transition-colors duration-(--dur-fast) hover:bg-forest-hover"
        >
          Axtar
        </button>
      </div>
    </Dialog>
  )
}
