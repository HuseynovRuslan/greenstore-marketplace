'use client'

import { useEffect, useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { listboxChevronClass } from '@/components/ui/Listbox'
import { productCategories } from '@/data/categories'
import { cn, formatNumber } from '@/lib/format'
import { countCatalog } from './countAction'
import { ChoiceOptions, optionClass, PriceFields, ToggleCheck } from './FilterControls'
import {
  ageLabel,
  ageOptions,
  filterTitles,
  heightLabel,
  heightOptions,
  priceError,
  sellerOptions,
  toggleLabels,
  type FilterOption,
} from './filterDefs'
import { FilterSheetSection, FilterSheetShell } from './FilterSheetShell'
import { withoutFilters, writeSearchState, type SearchState } from './searchUrl'
import { subcategoryOptions } from './taxonomy'

interface CatalogFilterSheetProps {
  open: boolean
  onClose: () => void
  /** The applied filters; the sheet edits a copy of them. */
  state: SearchState
  /** Results for the applied filters (the first count, before anything changes). */
  total: number
  /** Species of the applied category, from the server. */
  speciesOptions: FilterOption[]
  plantCategoryIds: string[]
  onApply: (next: SearchState) => void
}

const categoryOptions = productCategories.map((c) => ({ value: c.id, label: c.name }))
const queryOf = (state: SearchState) => writeSearchState(state, new URLSearchParams()).toString()
const withCustom = (options: FilterOption[], value: string, label: (v: string) => string) =>
  !value || options.some((o) => o.value === value) ? options : [...options, { value, label: label(value) }]

/**
 * «Filtrlər» below 1280 px: the home sheet (FilterSheetShell, a bottom sheet on phones) with every catalogue
 * filter. Changes stay in a draft until «N elanı göstər», whose count comes from the server as you go (a Server
 * Function, 200 ms after the last change); closing the sheet drops the draft. «Sıfırla» clears the draft's
 * filters and keeps the search word.
 */
export function CatalogFilterSheet({ open, onClose, state, total, speciesOptions, plantCategoryIds, onApply }: CatalogFilterSheetProps) {
  const errorId = useId()
  const [draft, setDraft] = useState(state)
  const [counted, setCounted] = useState({ query: queryOf(state), total })
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(state)
      setCounted({ query: queryOf(state), total })
    }
  }
  const set = (patch: Partial<SearchState>) => setDraft((d) => ({ ...d, ...patch }))

  const draftQuery = queryOf(draft)
  useEffect(() => {
    if (!open || counted.query === draftQuery) return
    let stale = false
    const timer = setTimeout(async () => {
      const next = await countCatalog(draftQuery)
      if (!stale) setCounted({ query: draftQuery, total: next })
    }, 200)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [open, draftQuery, counted.query])

  const error = priceError(draft)
  const current = counted.query === draftQuery
  const none = current && counted.total === 0
  // The count belongs to an edited draft (not the filters the sheet opened with): a new number fades in.
  const recounted = counted.query !== queryOf(state)
  const plant = !draft.categoryId || plantCategoryIds.includes(draft.categoryId)
  const subcategories = draft.categoryId ? subcategoryOptions(draft.categoryId) : []
  const species = draft.categoryId === state.categoryId ? speciesOptions : []
  const unchanged = queryOf(withoutFilters(draft)) === draftQuery

  return (
    <FilterSheetShell
      open={open}
      onClose={onClose}
      onReset={() => setDraft((d) => withoutFilters(d))}
      resetDisabled={unchanged}
      submitLabel={
        none ? (
          'Uyğun elan yoxdur'
        ) : (
          <>
            {/* While the count is being redone the old number dims (after 150 ms, so quick answers don't flicker);
                a new number blurs in (keyed, so it remounts). The button's name stays «N elanı göstər». */}
            <span
              key={counted.total}
              className={cn(
                'inline-block tabular-nums transition-opacity duration-(--dur-base) ease-out',
                recounted && 'motion-safe:animate-count-in',
                current ? 'opacity-100' : 'opacity-50 delay-150',
              )}
            >
              {formatNumber(counted.total)}
            </span>{' '}
            elanı göstər
          </>
        )
      }
      submitDisabled={Boolean(error) || none}
      onSubmit={() => {
        onApply(draft)
        onClose()
      }}
    >
      <FilterSheetSection group="category" title={filterTitles.category}>
        <ChoiceOptions options={categoryOptions} value={draft.categoryId} onPick={(categoryId) => set({ categoryId, subcategory: '', species: '' })} touch />
      </FilterSheetSection>
      {subcategories.length > 0 && (
        <FilterSheetSection group="subcategory" title="Alt kateqoriya">
          <ChoiceOptions options={subcategories} value={draft.subcategory} onPick={(subcategory) => set({ subcategory })} touch />
        </FilterSheetSection>
      )}
      <FilterSheetSection group="price" title={filterTitles.price}>
        <PriceFields value={{ min: draft.min, max: draft.max }} onChange={(range) => set(range)} error={error} errorId={errorId} touch />
      </FilterSheetSection>
      {(plant || draft.height) && (
        <FilterSheetSection group="height" title={filterTitles.height}>
          <ChoiceOptions options={withCustom(heightOptions, draft.height, heightLabel)} value={draft.height} onPick={(height) => set({ height })} touch />
        </FilterSheetSection>
      )}
      {(plant || draft.age) && (
        <FilterSheetSection group="age" title={filterTitles.age}>
          <ChoiceOptions options={withCustom(ageOptions, draft.age, ageLabel)} value={draft.age} onPick={(age) => set({ age })} touch />
        </FilterSheetSection>
      )}
      {species.length > 0 && (
        <FilterSheetSection group="species" title={filterTitles.species}>
          {/* Native picker: the sheet scrolls, and the phone's own list is the better one here. */}
          <label className="relative flex h-11 items-center rounded-option border border-line-strong bg-surface has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-olive">
            <span className="sr-only">{filterTitles.species}</span>
            <select
              value={draft.species}
              onChange={(e) => set({ species: e.target.value })}
              className="h-full w-full cursor-pointer appearance-none bg-transparent pr-9 pl-3 text-[15px] leading-[normal] font-medium text-ink outline-none pointer-coarse:text-base"
            >
              <option value="">Bütün növlər</option>
              {species.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden size={16} strokeWidth={2} className={cn(listboxChevronClass, 'pointer-events-none absolute right-3')} />
          </label>
        </FilterSheetSection>
      )}
      <FilterSheetSection group="seller" title={filterTitles.seller}>
        <ChoiceOptions options={sellerOptions} value={draft.sellerType} onPick={(v) => set({ sellerType: v as SearchState['sellerType'] })} touch />
      </FilterSheetSection>
      <FilterSheetSection group="extra" title={filterTitles.extra}>
        <div className="flex flex-wrap gap-2">
          {(['delivery', 'vip'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={draft[key]}
              onClick={() => set({ [key]: !draft[key] })}
              className={cn(optionClass(draft[key], true), 'flex items-center gap-[7px]')}
            >
              {draft[key] && <ToggleCheck />}
              {toggleLabels[key]}
            </button>
          ))}
        </div>
      </FilterSheetSection>
    </FilterSheetShell>
  )
}
