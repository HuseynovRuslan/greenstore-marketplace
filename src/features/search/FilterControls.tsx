'use client'

import { type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/format'
import { pricePresets, type FilterOption, type PriceRange } from './filterDefs'

/*
 * Filter controls shared by the home hero search and the catalogue (Variant 2): chips, option pills, the price
 * fields and the «Filtrlər» button. 38 px pills on desktop; `touch` makes them 44 px (the touch-target minimum).
 */

/** Filter chip: a chip with a value is forest-filled and shows it ("Qiymət: 50–150 ₼"). */
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

/** An option pill inside a popover, the sheet or the sidebar. */
export function optionClass(on: boolean, touch?: boolean) {
  return cn(
    'rounded-full border px-3.5 text-sm leading-[normal] font-medium whitespace-nowrap transition-colors duration-(--dur-fast)',
    touch ? 'h-11' : 'h-[38px]',
    on ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface text-ink hover:border-forest',
  )
}

/** Check mark of an active toggle; it pops in from .6 (no motion under reduced motion). */
export function ToggleCheck() {
  return <Check aria-hidden size={14} strokeWidth={2.6} className="shrink-0 animate-pop-in motion-reduce:animate-none" />
}

interface ChoiceOptionsProps {
  options: FilterOption[]
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

const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 7)

interface PriceFieldsProps {
  value: PriceRange
  /** Every keystroke and preset. */
  onChange: (range: PriceRange) => void
  /** Enter in a field, or a preset: the range is final (a popover closes, the sidebar applies it). */
  onSubmit?: (range: PriceRange) => void
  error?: string
  errorId: string
  touch?: boolean
  /** One field per row (the 256 px sidebar): side by side, a 6–7 digit price did not fit after «maks.». */
  stacked?: boolean
}

/** «min.» – «maks.» fields (digits only) and the four presets; picking the chosen preset again clears the price. */
export function PriceFields({ value, onChange, onSubmit, error, errorId, touch, stacked }: PriceFieldsProps) {
  // Enter finishes the typed range instead of submitting the surrounding form.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !onSubmit) return
    e.preventDefault()
    onSubmit(value)
  }
  const field = (key: 'min' | 'max', prefix: string, label: string) => (
    <label
      className={cn(
        'flex h-11 min-w-0 items-center gap-1.5 rounded-option border border-line-strong px-3 text-[13px] leading-[normal] text-muted md:h-[42px] has-[input:focus-visible]:border-olive has-[input:focus-visible]:outline-1 has-[input:focus-visible]:outline-olive has-aria-invalid:border-danger',
        stacked ? 'w-full' : 'flex-1',
      )}
    >
      {prefix}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        data-autofocus={key === 'min' || undefined}
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: digitsOnly(e.target.value) })}
        onKeyDown={onKeyDown}
        className="w-full min-w-0 flex-1 bg-transparent text-[15px] text-ink tabular-nums outline-none pointer-coarse:text-base"
      />
    </label>
  )
  return (
    <>
      <div className={stacked ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
        {/* Each name starts with the field's visible prefix (label in name, WCAG 2.5.3). */}
        {field('min', 'min.', 'min. qiymət, ₼')}
        {!stacked && (
          <span aria-hidden className="text-muted">
            –
          </span>
        )}
        {field('max', 'maks.', 'maks. qiymət, ₼')}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs leading-[1.5] text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {pricePresets.map((p) => {
          const on = value.min === p.min && value.max === p.max
          const next = on ? { min: '', max: '' } : { min: p.min, max: p.max }
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onChange(next)
                onSubmit?.(next)
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

interface FiltersButtonProps {
  /** Active filters; shown as a badge and spoken in the name ("Filtrlər (2 filtr seçilib)", no aria-label). */
  count: number
  expanded: boolean
  onClick: () => void
  className?: string
}

/** «Filtrlər» pill that opens the filter sheet (home phone row, catalogue bar below 1280 px). */
export function FiltersButton({ count, expanded, onClick, className }: FiltersButtonProps) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'flex h-11 shrink-0 items-center gap-[7px] rounded-full border border-forest bg-surface px-3.5 text-sm leading-[normal] font-semibold text-forest transition-transform duration-(--dur-fast) active:scale-[0.97] motion-reduce:active:scale-100',
        className,
      )}
    >
      <SlidersHorizontal aria-hidden size={16} strokeWidth={2} />
      Filtrlər
      {count > 0 && (
        <>
          {/* The badge is visual; the name says it in words and still starts with the visible «Filtrlər» (WCAG 2.5.3). */}
          <span aria-hidden className="flex h-5 min-w-5 items-center justify-center rounded-full bg-forest px-1.5 text-xs leading-none text-white tabular-nums">
            {count}
          </span>
          <span className="sr-only">{` (${count} filtr seçilib)`}</span>
        </>
      )}
    </button>
  )
}
