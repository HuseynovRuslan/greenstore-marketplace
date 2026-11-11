'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Listbox } from '@/components/ui/Listbox'
import { hasRootSystemFilter } from '@/data/categories'
import { cn } from '@/lib/format'
import { CategoryAccordion } from './CategoryAccordion'
import type { CategoryFacets } from './facets'
import { ChoiceOptions, optionClass, PriceFields, ToggleCheck } from './FilterControls'
import {
  ageLabel,
  ageOptions,
  filterTitles,
  heightLabel,
  heightOptions,
  priceError,
  rootOptions,
  sellerOptions,
  toggleLabels,
  type FilterOption,
  type PriceRange,
} from './filterDefs'
import { catalogHref, selectCategory, type SearchState } from './searchUrl'

interface FilterSidebarProps {
  /** The filters as shown (optimistic while a change loads). */
  state: SearchState
  /** The page's query string (sort and view ride along on category links). */
  current: URLSearchParams
  facets: CategoryFacets
  /** Species of the chosen category (all categories without one), from the server. */
  speciesOptions: FilterOption[]
  /** Height and age only mean something for plants. */
  showPlantFilters: boolean
  /** Applies a change at once (the results dim while they load). */
  onChange: (next: SearchState) => void
}

/** A value from an older link or a custom range joins the presets, so the pill row can show and clear it. */
const withCustom = (options: FilterOption[], value: string, label: (v: string) => string) =>
  !value || options.some((o) => o.value === value) ? options : [...options, { value, label: label(value) }]

/**
 * Catalogue filters, ≥ 1280 px (Variant 2 controls): every change applies at once. Kateqoriya is a white card with
 * the category accordion (links with counts; docs/design/elanlar/kateqoriya-sidebar.png); the other groups follow
 * on the page, lined up with the card's text. Qiymət has the home presets and min/max fields applied with Enter or
 * «Tətbiq et»; Hündürlük and Yaş use the home pills (plants only); Kök sistemi only where the category has it
 * (src/data/categories.ts); Növ is a Listbox; Satıcı and Əlavə are pills. Yaş, Növ and Satıcı fold away while they
 * are not set, so the column stays short.
 */
export function FilterSidebar({ state, current, facets, speciesOptions, showPlantFilters, onChange }: FilterSidebarProps) {
  const titleId = useId()
  const set = (patch: Partial<SearchState>) => onChange({ ...state, ...patch })

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <h2 id={titleId} className="sr-only">
        Filtrlər
      </h2>

      {/* «KATEQORİYA»: the capitals come from CSS with lang="az" (İ, not I); screen readers get the word. */}
      <div className="rounded-panel border border-line bg-surface px-3 pt-5 pb-3">
        <h3 className="px-2.5 pb-3 text-[13px] leading-4 font-semibold tracking-[0.08em] text-muted uppercase">
          {filterTitles.category}
        </h3>
        <CategoryAccordion
          value={state}
          counts={facets}
          hrefFor={(choice) => catalogHref(selectCategory(state, choice.categoryId, choice.subcategory), current)}
          onSelect={(choice) => onChange(selectCategory(state, choice.categoryId, choice.subcategory))}
        />
      </div>

      <div className="flex flex-col gap-6 px-[22px]">
        <Group title={filterTitles.price}>
          <PriceGroup state={state} onApply={(range) => set(range)} />
        </Group>

        {(showPlantFilters || state.height) && (
          <Group title={filterTitles.height}>
            <ChoiceOptions options={withCustom(heightOptions, state.height, heightLabel)} value={state.height} onPick={(height) => set({ height })} />
          </Group>
        )}

        {(showPlantFilters || state.age) && (
          <Group title={filterTitles.age} collapsible defaultOpen={Boolean(state.age)}>
            <ChoiceOptions options={withCustom(ageOptions, state.age, ageLabel)} value={state.age} onPick={(age) => set({ age })} />
          </Group>
        )}

        {(hasRootSystemFilter(state.categoryId) || state.root) && (
          <Group title={filterTitles.root}>
            <ChoiceOptions options={rootOptions} value={state.root} onPick={(root) => set({ root })} />
          </Group>
        )}

        {speciesOptions.length > 0 && (
          <Group title={filterTitles.species} collapsible defaultOpen={Boolean(state.species)}>
            <Listbox
              label={filterTitles.species}
              value={state.species}
              onChange={(species) => set({ species })}
              options={[{ value: '', label: 'Bütün növlər' }, ...speciesOptions]}
              className="h-11 w-full"
              triggerClassName="border border-line-strong bg-surface transition-colors duration-(--dur-fast) hover:border-forest"
            />
          </Group>
        )}

        <Group title={filterTitles.seller} collapsible defaultOpen={Boolean(state.sellerType)}>
          <ChoiceOptions options={sellerOptions} value={state.sellerType} onPick={(v) => set({ sellerType: v as SearchState['sellerType'] })} />
        </Group>

        <Group title={filterTitles.extra}>
          <div className="flex flex-wrap gap-2">
            {(['delivery', 'vip'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={state[key]}
                onClick={() => set({ [key]: !state[key] })}
                className={cn(optionClass(state[key]), 'flex items-center gap-[7px]')}
              >
                {state[key] && <ToggleCheck />}
                {toggleLabels[key]}
              </button>
            ))}
          </div>
        </Group>
      </div>
    </section>
  )
}

/** A titled group; `collapsible` groups fold behind a disclosure button (APG accordion: heading > button). */
function Group({ title, collapsible, defaultOpen = true, children }: { title: string; collapsible?: boolean; defaultOpen?: boolean; children: ReactNode }) {
  const bodyId = useId()
  const [open, setOpen] = useState(defaultOpen)
  if (!collapsible) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-sm leading-[normal] font-semibold text-forest">{title}</h3>
        {children}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="-my-2.5 flex h-11 w-full items-center justify-between text-sm leading-[normal] font-semibold text-forest"
        >
          {title}
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn('shrink-0 text-muted transition-transform duration-(--dur-fast) motion-reduce:transition-none', open && 'rotate-180')}
          />
        </button>
      </h3>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  )
}

/** Presets apply at once; typed values apply with Enter or «Tətbiq et». The fields follow the URL. */
function PriceGroup({ state, onApply }: { state: SearchState; onApply: (range: PriceRange) => void }) {
  const errorId = useId()
  const applied = `${state.min}-${state.max}`
  const [draft, setDraft] = useState<PriceRange>({ min: state.min, max: state.max })
  const [synced, setSynced] = useState(applied)
  if (synced !== applied) {
    setSynced(applied)
    setDraft({ min: state.min, max: state.max })
  }
  const error = priceError(draft)
  const changed = draft.min !== state.min || draft.max !== state.max
  const apply = (range: PriceRange) => {
    if (!priceError(range)) onApply(range)
  }
  return (
    <div className="flex flex-col gap-3">
      <PriceFields value={draft} onChange={setDraft} onSubmit={apply} error={error} errorId={errorId} stacked />
      {changed && (
        <button
          type="button"
          disabled={Boolean(error)}
          onClick={() => apply(draft)}
          className="h-10 self-start rounded-option border border-forest px-4 text-sm leading-[normal] font-semibold text-forest transition-[color,background-color,border-color,scale] duration-(--dur-fast) ease-out hover:bg-mint active:scale-[0.97] disabled:border-line-strong disabled:text-muted disabled:active:scale-100 motion-reduce:active:scale-100"
        >
          Tətbiq et
        </button>
      )}
    </div>
  )
}
