'use client'

import { useId, useState, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, Layers } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Listbox } from '@/components/ui/Listbox'
import { productCategories } from '@/data/categories'
import { cn, formatNumber } from '@/lib/format'
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
  type PriceRange,
} from './filterDefs'
import { catalogHref, type SearchState } from './searchUrl'
import { subcategoryOptions } from './taxonomy'

export interface SidebarFacets {
  categories: { all: number; byId: Record<string, number> }
  subcategories: Record<string, number>
}

interface FilterSidebarProps {
  /** The filters as shown (optimistic while a change loads). */
  state: SearchState
  /** The page's query string (sort and view ride along on category links). */
  current: URLSearchParams
  facets: SidebarFacets
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
 * Catalogue filters, ≥ 1280 px (Variant 2 controls): every change applies at once. Kateqoriya is a list of links
 * with counts (sub-categories open under the chosen one); Qiymət has the home presets and min/max fields applied
 * with Enter or «Tətbiq et»; Hündürlük and Yaş use the home pills (plants only); Növ is a Listbox; Satıcı and
 * Əlavə are pills. Yaş, Növ and Satıcı fold away while they are not set, so the column stays short.
 */
export function FilterSidebar({ state, current, facets, speciesOptions, showPlantFilters, onChange }: FilterSidebarProps) {
  const titleId = useId()
  const set = (patch: Partial<SearchState>) => onChange({ ...state, ...patch })

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <h2 id={titleId} className="sr-only">
        Filtrlər
      </h2>

      <Group title={filterTitles.category}>
        <CategoryList state={state} current={current} facets={facets} onChange={onChange} />
      </Group>

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

/** A plain click navigates in place (so the results can dim); modified clicks open the link as usual. */
const inPlace = (e: MouseEvent, go: () => void) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  go()
}

const rowClass =
  'flex min-h-10 items-center gap-2.5 rounded-option px-2.5 text-sm leading-[1.3] text-ink transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest aria-[current=true]:bg-mint aria-[current=true]:font-semibold aria-[current=true]:text-forest'

function CategoryList({ state, current, facets, onChange }: Pick<FilterSidebarProps, 'state' | 'current' | 'facets' | 'onChange'>) {
  const link = (next: SearchState, selected: boolean, body: ReactNode, className?: string) => (
    <Link
      href={catalogHref(next, current)}
      prefetch={false}
      aria-current={selected ? 'true' : undefined}
      onClick={(e) => inPlace(e, () => onChange(next))}
      className={cn(rowClass, className)}
    >
      {body}
    </Link>
  )
  const count = (n: number | undefined) => (
    <span className="ml-auto shrink-0 text-[13px] font-normal text-muted tabular-nums">{formatNumber(n ?? 0)}</span>
  )
  const noCategory = { ...state, categoryId: '', subcategory: '', species: '' }
  return (
    <ul className="-mx-2.5 flex flex-col">
      <li>
        {link(
          noCategory,
          !state.categoryId,
          <>
            <Layers aria-hidden size={18} strokeWidth={1.8} className="shrink-0 text-forest" />
            <span className="min-w-0 truncate">Hamısı</span>
            {count(facets.categories.all)}
          </>,
        )}
      </li>
      {productCategories.map((c) => {
        const selected = state.categoryId === c.id
        const subs = selected ? subcategoryOptions(c.id) : []
        return (
          <li key={c.id}>
            {link(
              { ...noCategory, categoryId: c.id },
              selected && !state.subcategory,
              <>
                <CategoryIcon name={c.icon} size={18} />
                <span className="min-w-0 truncate">{c.name}</span>
                {count(facets.categories.byId[c.id])}
              </>,
              selected && state.subcategory ? 'font-semibold text-forest' : undefined,
            )}
            {subs.length > 0 && (
              <ul className="ml-[38px] flex flex-col border-l border-line pl-1">
                {subs.map((s) => (
                  <li key={s.value}>
                    {link(
                      { ...state, subcategory: state.subcategory === s.value ? '' : s.value },
                      state.subcategory === s.value,
                      <>
                        <span className="min-w-0 truncate">{s.label}</span>
                        {count(facets.subcategories[s.value])}
                      </>,
                      'min-h-9 text-[13px]',
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
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
          className="h-10 self-start rounded-option border border-forest px-4 text-sm leading-[normal] font-semibold text-forest transition-colors duration-(--dur-fast) hover:bg-mint disabled:border-line-strong disabled:text-muted"
        >
          Tətbiq et
        </button>
      )}
    </div>
  )
}
