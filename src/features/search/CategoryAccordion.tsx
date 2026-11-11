'use client'

import { useId, useState, type MouseEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { productCategories } from '@/data/categories'
import { cn, formatNumber, lowerAz } from '@/lib/format'
import type { IconName } from '@/types'
import type { CategoryFacets } from './facets'

export interface CategoryChoice {
  categoryId: string
  subcategory: string
}

interface CategoryAccordionProps {
  value: CategoryChoice
  counts: CategoryFacets
  onSelect: (choice: CategoryChoice) => void
  /**
   * Sidebar: rows are links to these URLs and a plain click navigates in place (`onSelect`). Without it the rows are
   * toggle buttons (the «Filtrlər» sheet edits a draft).
   */
  hrefFor?: (choice: CategoryChoice) => string
  /** 44 px rows everywhere (the sheet on touch screens). */
  touch?: boolean
}

/** «Bütün ağaclar»: the chosen category itself, first in its sub-category list. */
const allIn = (name: string) => `Bütün ${lowerAz(name)}`

/** A plain click navigates in place (so the results can dim); modified clicks open the link as usual. */
const inPlace = (e: MouseEvent, go: () => void) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  go()
}

/**
 * «Kateqoriya» as an accordion (docs/design/elanlar/kateqoriya-sidebar.png): «Hamısı», then the categories. The
 * chosen one turns mint (white icon disc, white count pill) and opens its list, one at a time: «Bütün …» first, then
 * the sub-categories on a guide line that drops from the icon's centre, the chosen one marked by a forest bar on the
 * line. Its chevron folds the list away; choosing another category closes it and opens that one. Rows with no
 * listings are muted and stay clickable. The list opens and closes in height and opacity (180 ms; at once under
 * reduced motion); closed lists stay in the page so they can animate, `inert` and aria-hidden (no focus, not read).
 */
export function CategoryAccordion({ value, counts, onSelect, hrefFor, touch }: CategoryAccordionProps) {
  const baseId = useId()
  // The chosen category's list folded by its chevron; choosing another category opens that one again.
  const [foldedId, setFoldedId] = useState<string | null>(null)
  const choose = (choice: CategoryChoice) => {
    setFoldedId(null)
    onSelect(choice)
  }
  /** `current`: the link to the page being shown; `pressed`: the button of the draft's choice. */
  const control = (choice: CategoryChoice, current: boolean, pressed = current): ControlProps =>
    hrefFor
      ? { href: hrefFor(choice), onClick: (e) => inPlace(e, () => choose(choice)), current }
      : { onClick: () => choose(choice), pressed }

  return (
    <ul className="flex flex-col">
      <li className="relative mb-1.5 pb-1.5 after:absolute after:inset-x-2.5 after:bottom-0 after:h-px after:bg-line">
        <CategoryRow control={control({ categoryId: '', subcategory: '' }, !value.categoryId)} on={!value.categoryId} name="Hamısı" count={counts.categories.all} touch={touch} />
      </li>
      {productCategories.map((c) => {
        const selected = value.categoryId === c.id
        const open = selected && foldedId !== c.id
        const listId = `${baseId}-${c.id}`
        const count = counts.categories.byId[c.id] ?? 0
        const whole = { categoryId: c.id, subcategory: '' }
        return (
          <li key={c.id}>
            <CategoryRow
              control={control(whole, selected && !open && !value.subcategory, selected)}
              on={selected}
              icon={c.icon}
              name={c.name}
              count={count}
              touch={touch}
              fold={selected ? { open, controls: listId, toggle: () => setFoldedId(open ? c.id : null) } : undefined}
            />
            {/* Height and opacity through the grid row (0fr ⇄ 1fr); `invisible` waits for the end of the close. */}
            <div
              id={listId}
              inert={!open}
              aria-hidden={!open || undefined}
              className={cn(
                'grid transition-[grid-template-rows,opacity,visibility] duration-(--dur-base) ease-out motion-reduce:transition-none',
                open ? 'grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0',
              )}
            >
              {/* The guide line runs under the icon disc (its centre is 24 px in); the rows start at the name. */}
              <ul className="relative min-h-0 overflow-hidden py-1 pl-[38px] before:absolute before:inset-y-1 before:left-[23.5px] before:w-px before:bg-line-strong">
                <li>
                  <SubcategoryRow control={control(whole, selected && !value.subcategory)} on={selected && !value.subcategory} name={allIn(c.name)} count={count} touch={touch} />
                </li>
                {c.subcategories.map((s) => {
                  const on = selected && value.subcategory === s.id
                  // A pressed sub-category button unpresses back to «Bütün …»; a link always opens its sub-category.
                  const choice = on && !hrefFor ? whole : { categoryId: c.id, subcategory: s.id }
                  return (
                    <li key={s.id}>
                      <SubcategoryRow control={control(choice, on)} on={on} name={s.name} count={counts.subcategories[s.id] ?? 0} touch={touch} />
                    </li>
                  )
                })}
              </ul>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

type ControlProps = { href: string; onClick: (e: MouseEvent) => void; current: boolean } | { href?: undefined; onClick: () => void; pressed: boolean }

/** A link (aria-current="page" on the open one) or a toggle button (aria-pressed), styled the same. */
function RowControl({ control, className, children }: { control: ControlProps; className: string; children: ReactNode }) {
  if (control.href !== undefined) {
    return (
      <Link href={control.href} prefetch={false} aria-current={control.current ? 'page' : undefined} onClick={control.onClick} className={className}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" aria-pressed={control.pressed} onClick={control.onClick} className={cn('text-left', className)}>
      {children}
    </button>
  )
}

interface CategoryRowProps {
  control: ControlProps
  /** The chosen row: mint, a white icon disc and a white count pill. */
  on: boolean
  icon?: IconName
  name: string
  count: number
  touch?: boolean
  /** The chosen category: a chevron button that folds its list. Other categories get a chevron pointing at it. */
  fold?: { open: boolean; controls: string; toggle: () => void }
}

function CategoryRow({ control, on, icon, name, count, touch, fold }: CategoryRowProps) {
  const empty = count === 0 && !on
  return (
    <div className={cn('flex items-center rounded-option', on && 'bg-mint')}>
      <RowControl
        control={control}
        className={cn(
          'group/cat flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-option py-1.5 pl-2.5 text-[15px] leading-[1.3] tracking-[-0.01em] transition-colors duration-(--dur-fast)',
          fold ? 'pr-1' : 'pr-2.5',
          on ? 'font-semibold text-forest' : cn('font-medium hover:bg-mint/60 hover:text-forest active:bg-mint', empty ? 'text-muted' : 'text-ink'),
        )}
      >
        {icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-(--dur-fast)',
              on ? 'bg-surface' : 'group-hover/cat:bg-surface',
              empty ? 'text-muted group-hover/cat:text-forest' : 'text-forest',
            )}
          >
            <CategoryIcon name={icon} size={16} className="shrink-0" />
          </span>
        )}
        <span className="min-w-0 truncate">{name}</span>{' '}
        <span
          className={cn(
            'ml-auto flex h-5 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[13px] leading-none tracking-normal tabular-nums',
            on ? 'bg-surface font-semibold text-forest' : 'font-normal text-muted',
          )}
        >
          {formatNumber(count)}
          <span className="sr-only"> elan</span>
        </span>
        {icon && !fold && <ChevronRight aria-hidden size={16} strokeWidth={2} className="shrink-0 text-muted" />}
      </RowControl>
      {fold && (
        <button
          type="button"
          aria-expanded={fold.open}
          aria-controls={fold.controls}
          aria-label={`Alt kateqoriyalar — ${name}`}
          onClick={fold.toggle}
          className={cn(
            'mr-1 flex shrink-0 items-center justify-center rounded-full text-forest transition-colors duration-(--dur-fast) hover:bg-surface',
            touch ? 'size-11' : 'size-7',
          )}
        >
          <ChevronRight
            aria-hidden
            size={16}
            strokeWidth={2}
            className={cn('transition-transform duration-(--dur-base) ease-out motion-reduce:transition-none', fold.open && 'rotate-90')}
          />
        </button>
      )}
    </div>
  )
}

function SubcategoryRow({ control, on, name, count, touch }: { control: ControlProps; on: boolean; name: string; count: number; touch?: boolean }) {
  return (
    <RowControl
      control={control}
      className={cn(
        // Inset focus ring: the list clips what spills past its edges (it animates its height).
        'relative flex w-full items-center gap-2 rounded-option px-3 text-sm leading-[1.3] tracking-[-0.01em] transition-colors duration-(--dur-fast) focus-visible:-outline-offset-2',
        touch ? 'min-h-11' : 'min-h-10',
        on
          ? // The bar sits on the guide line: its centre is 24 px into the list, 38 px left of this row.
            'bg-mint/60 font-semibold text-forest before:absolute before:top-1/2 before:-left-[15.5px] before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-forest'
          : cn('hover:bg-mint/60 hover:text-forest active:bg-mint/70', count === 0 ? 'text-muted' : 'text-ink'),
      )}
    >
      <span className="min-w-0 truncate">{name}</span>{' '}
      <span className={cn('ml-auto shrink-0 text-[13px] tracking-normal text-muted tabular-nums', on && 'font-semibold text-forest')}>
        {formatNumber(count)}
        <span className="sr-only"> elan</span>
      </span>
    </RowControl>
  )
}
