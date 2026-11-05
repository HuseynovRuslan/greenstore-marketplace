'use client'

import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/format'
import {
  activeFilterCount,
  choiceOptions,
  emptyHeroFilters,
  filterValueLabel,
  isFilterSet,
  priceError,
  pricePresets,
  visibleFilters,
  type ChoiceFilterId,
  type FilterId,
  type HeroFilters,
  type HeroTab,
} from './heroSearch'

/*
 * Variant 2 "filter chips": 38 px pills (44 px on phones, the touch-target minimum); a chip with a value is
 * forest-filled and shows it ("Qiymət: 50–150 ₼").
 */
export function chipClass(state: { on: boolean; open?: boolean; touch?: boolean }) {
  return cn(
    'flex shrink-0 items-center gap-[7px] rounded-full border px-3.5 text-sm leading-[normal] font-medium whitespace-nowrap',
    state.touch ? 'h-11' : 'h-[38px]',
    'transition-[background-color,border-color,color,transform] duration-(--dur-fast) active:scale-[0.97] motion-reduce:active:scale-100',
    state.on
      ? 'border-forest bg-forest text-white hover:border-forest-hover hover:bg-forest-hover'
      : state.open
        ? 'border-forest bg-mint text-ink'
        : 'border-line-strong bg-surface text-ink hover:border-forest',
  )
}

/** Mockup popover widths per filter. */
const panelWidth: Record<Exclude<FilterId, 'delivery' | 'planting'>, string> = {
  category: 'w-[420px]',
  price: 'w-[340px]',
  height: 'w-[320px]',
  root: 'w-[320px]',
  availability: 'w-[260px]',
}

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 7)

/** Check mark of an active toggle chip; it pops in from .6 (no motion under reduced motion). */
export function ToggleCheck() {
  return <Check aria-hidden size={14} strokeWidth={2.6} className="shrink-0 animate-pop-in motion-reduce:animate-none" />
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
                  <PriceFields filters={filters} onChange={onChange} close={close} error={error} errorId={errorId} />
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
          className="h-[38px] rounded-lg px-2.5 text-sm leading-[normal] font-semibold text-forest underline underline-offset-[3px] hover:text-olive-text"
        >
          Sıfırla
        </button>
      )}
    </div>
  )
}

export function optionClass(on: boolean, touch?: boolean) {
  return cn(
    'rounded-full border px-3.5 text-sm leading-[normal] font-medium whitespace-nowrap transition-colors duration-(--dur-fast)',
    touch ? 'h-11' : 'h-[38px]',
    on ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface text-ink hover:border-forest',
  )
}

interface ChoiceOptionsProps {
  options: Array<{ value: string; label: string }>
  value: string
  onPick: (value: string) => void
  touch?: boolean
}

/** Single-choice pills; picking the chosen one again clears the filter. */
export function ChoiceOptions({ options, value, onPick, touch }: ChoiceOptionsProps) {
  const autofocus = options.some((o) => o.value === value) ? value : options[0]?.value
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          data-autofocus={o.value === autofocus || undefined}
          onClick={() => onPick(o.value === value ? '' : o.value)}
          className={optionClass(o.value === value, touch)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface PriceFieldsProps {
  filters: HeroFilters
  onChange: (filters: HeroFilters) => void
  /** Popover only: Enter and a preset close it and return focus to the chip. */
  close?: () => void
  error?: string
  errorId: string
  touch?: boolean
}

export function PriceFields({ filters, onChange, close, error, errorId, touch }: PriceFieldsProps) {
  // Enter applies the typed range and returns to the chip instead of submitting the search.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !close) return
    e.preventDefault()
    close()
  }
  const field = (key: 'min' | 'max', prefix: string, label: string) => (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-option border border-line-strong px-3 text-[13px] leading-[normal] text-muted md:h-[42px] has-[input:focus-visible]:border-olive has-[input:focus-visible]:outline-1 has-[input:focus-visible]:outline-olive has-aria-invalid:border-danger">
      {prefix}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-autofocus={key === 'min' || undefined}
        value={filters[key]}
        onChange={(e) => onChange({ ...filters, [key]: digitsOnly(e.target.value) })}
        onKeyDown={onKeyDown}
        className="w-full min-w-0 flex-1 bg-transparent text-[15px] text-ink tabular-nums outline-none"
      />
    </label>
  )
  return (
    <>
      <div className="flex items-center gap-2">
        {/* Each name starts with the field's visible prefix (label in name, WCAG 2.5.3). */}
        {field('min', 'min.', 'min. qiymət, ₼')}
        <span aria-hidden className="text-muted">
          –
        </span>
        {field('max', 'maks.', 'maks. qiymət, ₼')}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs leading-[1.5] text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {pricePresets.map((p) => {
          const on = filters.min === p.min && filters.max === p.max
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChange({ ...filters, min: on ? '' : p.min, max: on ? '' : p.max })
                close?.()
              }}
              className={optionClass(on, touch)}
            >
              {p.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
