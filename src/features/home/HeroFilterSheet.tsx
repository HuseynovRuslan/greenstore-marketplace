'use client'

import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/format'
import { ChoiceOptions, chipClass, FiltersButton, optionClass, PriceFields, ToggleCheck } from '@/features/search/FilterControls'
import { filterTitles, priceError } from '@/features/search/filterDefs'
import { FilterSheetSection, FilterSheetShell } from '@/features/search/FilterSheetShell'
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
 * the other menu chips open it at their own group, toggles switch in place. The row sits on the hero photo.
 */
export function MobileFilterRow({ tab, filters, onChange, onOpenSheet, sheetOpen, className }: MobileFilterRowProps) {
  const visible = visibleFilters(tab).filter((f) => ROW_FILTERS.includes(f.id))
  return (
    <div role="group" aria-label="Filtrlər" className={cn('scrollbar-none flex gap-2 overflow-x-auto overscroll-x-contain', className)}>
      <FiltersButton count={activeFilterCount(tab, filters)} expanded={sheetOpen} onClick={() => onOpenSheet()} />
      {visible.map((def) => {
        const on = isFilterSet(def.id, filters)
        if (def.kind === 'toggle') {
          const id = def.id as 'delivery' | 'planting'
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => onChange({ ...filters, [id]: !on })} className={chipClass({ on, touch: true, onPhoto: true })}>
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
            className={chipClass({ on, touch: true, onPhoto: true })}
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

/** «Filtrlər» bottom sheet: every filter of the tab, «Sıfırla» and «Axtar». */
export function HeroFilterSheet({ open, focus, tab, filters, onChange, onClose, onSearch }: HeroFilterSheetProps) {
  const errorId = useId()
  const error = priceError(filters)
  const visible = visibleFilters(tab)
  const toggles = visible.filter((f) => f.kind === 'toggle')

  return (
    <FilterSheetShell
      open={open}
      onClose={onClose}
      focus={focus}
      onReset={() => onChange(emptyHeroFilters)}
      resetDisabled={activeFilterCount(tab, filters) === 0}
      submitLabel="Axtar"
      onSubmit={() => {
        if (onSearch()) onClose()
      }}
    >
      {visible.map((def) => {
        if (def.kind === 'toggle') return null
        if (def.id === 'price') {
          return (
            <FilterSheetSection key={def.id} group={def.id} title={def.title}>
              <PriceFields
                value={{ min: filters.min, max: filters.max }}
                onChange={(range) => onChange({ ...filters, ...range })}
                error={error}
                errorId={errorId}
                touch
              />
            </FilterSheetSection>
          )
        }
        const id = def.id as ChoiceFilterId
        return (
          <FilterSheetSection key={id} group={id} title={def.title}>
            <ChoiceOptions options={choiceOptions(id, tab)} value={filters[id]} onPick={(v) => onChange({ ...filters, [id]: v })} touch />
          </FilterSheetSection>
        )
      })}
      {toggles.length > 0 && (
        <FilterSheetSection group={toggles[0].id} title={filterTitles.extra}>
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
          </div>
        </FilterSheetSection>
      )}
    </FilterSheetShell>
  )
}
