'use client'

import { useId, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/format'
import { ChoiceOptions, chipClass, PriceFields, ToggleCheck } from '@/features/search/FilterControls'
import { priceError } from '@/features/search/filterDefs'
import {
  activeFilterCount,
  choiceOptions,
  emptyHeroFilters,
  filterValueLabel,
  isFilterSet,
  visibleFilters,
  type ChoiceFilterId,
  type FilterId,
  type HeroFilters,
  type HeroTab,
} from './heroSearch'

/*
 * Variant 2 "filter chips" (≥ md): one chip per filter; the shared controls (chips, pills, price fields) live in
 * features/search/FilterControls.tsx so the catalogue uses the same ones.
 */

/** Mockup popover widths per filter. */
const panelWidth: Record<Exclude<FilterId, 'delivery' | 'planting'>, string> = {
  category: 'w-[420px]',
  price: 'w-[340px]',
  height: 'w-[320px]',
  root: 'w-[320px]',
  availability: 'w-[260px]',
}

interface FilterChipsProps {
  tab: HeroTab
  filters: HeroFilters
  onChange: (filters: HeroFilters) => void
  className?: string
}

/** Desktop / tablet filter chips (≥ md). Phones get the «Filtrlər» sheet instead. */
export function FilterChips({ tab, filters, onChange, className }: FilterChipsProps) {
  const [openId, setOpenId] = useState<FilterId | null>(null)
  const groupRef = useRef<HTMLDivElement>(null)
  const errorId = useId()
  const error = priceError(filters)

  const reset = () => {
    onChange(emptyHeroFilters)
    setOpenId(null)
    // «Sıfırla» disappears with the filters: keep keyboard users in the row.
    groupRef.current?.querySelector('button')?.focus()
  }

  return (
    <div ref={groupRef} role="group" aria-label="Filtrlər" className={cn('flex flex-wrap items-center gap-2', className)}>
      {visibleFilters(tab).map((def) => {
        const on = isFilterSet(def.id, filters)
        if (def.kind === 'toggle') {
          const id = def.id as 'delivery' | 'planting'
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => onChange({ ...filters, [id]: !on })} className={chipClass({ on })}>
              {on && <ToggleCheck />}
              {def.label}
            </button>
          )
        }
        const id = def.id as Exclude<FilterId, 'delivery' | 'planting'>
        const open = openId === id
        const value = filterValueLabel(id, filters, tab)
        return (
          <Popover
            key={id}
            open={open}
            onOpenChange={(next) => setOpenId(next ? id : null)}
            label={def.title}
            panelClassName={cn(panelWidth[id], 'flex flex-col gap-3')}
            trigger={(props) => (
              <button {...props} className={chipClass({ on, open })}>
                {value ? `${def.label}: ${value}` : def.label}
                <ChevronDown
                  aria-hidden
                  size={14}
                  strokeWidth={2.2}
                  className={cn('shrink-0 transition-transform duration-(--dur-fast) motion-reduce:transition-none', open && 'rotate-180')}
                />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="flex items-center justify-between gap-2.5">
                  <strong className="text-sm leading-[normal] font-semibold text-forest">{def.title}</strong>
                  <button
                    type="button"
                    aria-label="Bağla"
                    onClick={close}
                    className="-m-1.5 flex size-8 items-center justify-center rounded-lg text-muted transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest"
                  >
                    <X aria-hidden size={16} strokeWidth={2} />
                  </button>
                </div>
                {id === 'price' ? (
                  <PriceFields
                    value={{ min: filters.min, max: filters.max }}
                    onChange={(range) => onChange({ ...filters, ...range })}
                    onSubmit={close}
                    error={error}
                    errorId={errorId}
                  />
                ) : (
                  <ChoiceOptions
                    options={choiceOptions(id, tab)}
                    value={filters[id as ChoiceFilterId]}
                    onPick={(v) => {
                      onChange({ ...filters, [id]: v })
                      close()
                    }}
                  />
                )}
              </>
            )}
          </Popover>
        )
      })}
      {activeFilterCount(tab, filters) > 0 && (
        <button
          type="button"
          onClick={reset}
          className="h-[38px] rounded-lg px-2.5 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] transition-[color,scale] duration-(--dur-fast) ease-out hover:text-olive-text active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Sıfırla
        </button>
      )}
    </div>
  )
}
