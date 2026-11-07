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
 * with counts (the chosen one opens its sub-categories, «Bütün …» first); Qiymət has the home presets and min/max fields applied
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

/** A category link: where it goes, and the in-place click. */
interface Go {
  href: string
  onClick: (e: MouseEvent) => void
}

/** «Bütün ağaclar»: the chosen category itself, first in its sub-category list. */
const allInCategory = (name: string) => `Bütün ${name.toLocaleLowerCase('az')}`

/**
 * «Hamısı», then the categories. The chosen one turns mint (white icon disc and count) and opens its list: «Bütün
 * …» first, then the sub-categories on a guide line, the current one marked by a bar on the line. Its chevron folds
 * the list away; choosing another category opens that one. Rows with no listings are grey, and stay links.
 */
function CategoryList({ state, current, facets, onChange }: Pick<FilterSidebarProps, 'state' | 'current' | 'facets' | 'onChange'>) {
  const subListId = useId()
  const [folded, setFolded] = useState(false)
  const [foldedFor, setFoldedFor] = useState(state.categoryId)
  if (foldedFor !== state.categoryId) {
    setFoldedFor(state.categoryId)
    setFolded(false)
  }
  const go = (next: SearchState): Go => ({ href: catalogHref(next, current), onClick: (e) => inPlace(e, () => onChange(next)) })
  const noCategory = { ...state, categoryId: '', subcategory: '', species: '' }
  return (
    <ul className="-mx-2.5 flex flex-col gap-0.5">
      <li>
        <CategoryRow
          go={go(noCategory)}
          on={!state.categoryId}
          current={!state.categoryId}
          icon={<Layers aria-hidden size={16} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0" />}
          name="Hamısı"
          count={facets.categories.all}
        />
      </li>
      {productCategories.map((c) => {
        const selected = state.categoryId === c.id
        const open = selected && !folded
        const toCategory = { ...noCategory, categoryId: c.id }
        const count = facets.categories.byId[c.id] ?? 0
        return (
          <li key={c.id}>
            <CategoryRow
              go={go(toCategory)}
              on={selected}
              current={selected && folded}
              icon={<CategoryIcon name={c.icon} size={16} className="shrink-0" />}
              name={c.name}
              count={count}
              fold={selected ? { open, controls: subListId, toggle: () => setFolded(open) } : 'closed'}
            />
            {selected && (
              // The guide line runs under the icon disc (its centre is 24 px in); the rows start at the name.
              <ul
                id={subListId}
                hidden={!open}
                className="relative my-1 flex flex-col pl-9 before:absolute before:inset-y-1 before:left-[23.5px] before:w-px before:bg-line-strong"
              >
                <li>
                  <SubcategoryRow go={go(toCategory)} current={!state.subcategory} name={allInCategory(c.name)} count={count} />
                </li>
                {subcategoryOptions(c.id).map((s) => (
                  <li key={s.value}>
                    <SubcategoryRow
                      go={go({ ...state, subcategory: state.subcategory === s.value ? '' : s.value })}
                      current={state.subcategory === s.value}
                      name={s.label}
                      count={facets.subcategories[s.value] ?? 0}
                    />
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

interface CategoryRowProps {
  go: Go
  /** The chosen row: mint, with a white icon disc and a white count pill. */
  on: boolean
  /** aria-current: «Hamısı» when no category is chosen, a category while its list is folded. */
  current: boolean
  icon: ReactNode
  name: string
  count: number
  /** 'closed': a chevron that points at the list the link opens. The chosen category gets a button that folds it. */
  fold?: 'closed' | { open: boolean; controls: string; toggle: () => void }
}

function CategoryRow({ go, on, current, icon, name, count, fold }: CategoryRowProps) {
  const empty = count === 0 && !on
  const toggle = typeof fold === 'object' ? fold : undefined
  return (
    <div className={cn('flex items-center rounded-option', on && 'bg-mint')}>
      <Link
        href={go.href}
        prefetch={false}
        aria-current={current ? 'true' : undefined}
        onClick={go.onClick}
        className={cn(
          'group/cat flex min-h-[42px] min-w-0 flex-1 items-center gap-2.5 rounded-option py-1.5 pl-2.5 text-[15px] leading-[1.3] tracking-[-0.01em] transition-colors duration-(--dur-fast)',
          toggle ? 'pr-1' : 'pr-2.5',
          on ? 'font-semibold text-forest' : cn('font-medium hover:bg-mint/60 hover:text-forest active:bg-mint', empty ? 'text-muted' : 'text-ink'),
        )}
      >
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast)',
            on ? 'bg-surface' : 'bg-mint group-hover/cat:bg-surface',
            empty ? 'text-muted group-hover/cat:text-forest' : 'text-forest',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">{name}</span>
        <span
          className={cn(
            'ml-auto flex h-5 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[13px] leading-none tracking-normal tabular-nums',
            on ? 'bg-surface font-semibold text-forest' : 'font-normal text-muted',
          )}
        >
          {formatNumber(count)}
        </span>
        {fold === 'closed' && <ChevronDown aria-hidden size={16} strokeWidth={2} className="shrink-0 -rotate-90 text-muted" />}
        {/* «Hamısı» has no list: a gap keeps its count in line with the others. */}
        {!fold && <span aria-hidden className="size-4 shrink-0" />}
      </Link>
      {toggle && (
        <button
          type="button"
          aria-expanded={toggle.open}
          aria-controls={toggle.controls}
          aria-label={`Alt kateqoriyalar — ${name}`}
          onClick={toggle.toggle}
          className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-forest transition-colors duration-(--dur-fast) hover:bg-surface"
        >
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn('transition-transform duration-(--dur-fast) ease-out motion-reduce:transition-none', !toggle.open && '-rotate-90')}
          />
        </button>
      )}
    </div>
  )
}

function SubcategoryRow({ go, current, name, count }: { go: Go; current: boolean; name: string; count: number }) {
  return (
    <Link
      href={go.href}
      prefetch={false}
      aria-current={current ? 'true' : undefined}
      onClick={go.onClick}
      className={cn(
        'relative flex min-h-[38px] items-center gap-2 rounded-option px-3 text-sm leading-[1.3] tracking-[-0.01em] transition-colors duration-(--dur-fast)',
        current
          ? // The bar sits on the guide line: its centre is 24 px into the list, 36 px left of this row.
            'bg-mint/60 font-semibold text-forest before:absolute before:top-1/2 before:-left-[13.5px] before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-forest'
          : cn('hover:bg-mint/40 hover:text-forest active:bg-mint/70', count === 0 ? 'text-muted' : 'text-ink'),
      )}
    >
      <span className="min-w-0 truncate">{name}</span>
      <span className={cn('ml-auto shrink-0 text-[13px] tracking-normal text-muted tabular-nums', current && 'font-semibold')}>{formatNumber(count)}</span>
    </Link>
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
