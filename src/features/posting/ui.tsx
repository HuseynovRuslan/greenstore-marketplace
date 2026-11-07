'use client'

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, ImageIcon } from 'lucide-react'
import { cityName } from '@/data/cities'
import { optionClass } from '@/features/search/filterStyles'
import { listingPrice } from '@/features/listing/facts'
import { cn } from '@/lib/format'
import { controlClass, describedBy, FieldShell, useFieldIds } from '@/components/ui/Field'
import type { FilterOption } from '@/features/search/filterDefs'
import { STEPS, type PostingDraft, type StepNumber } from './draft'
import { attributeLine } from './attributes'
import { markStepChange, type StepDirection } from './stepMotion'
import { fieldDomId } from './validation'

export const stepPath = (n: number) => `/elan-yerlesdir/${n}`

/**
 * Progress of the six steps: a segmented bar (done and current in forest) and, from 768 px, the step names; steps
 * already reached are links, so Back is never the only way back. Moving forward, the new step's segment fills from
 * the left (.gs-fill).
 */
export function StepProgress({ step, reached, dir }: { step: StepNumber; reached: StepNumber; dir?: StepDirection }) {
  return (
    <nav aria-label="Addımlar" className="flex flex-col gap-2.5">
      <ol className="grid grid-cols-6 gap-1.5">
        {STEPS.map((s) => {
          const state = s.n < step ? 'done' : s.n === step ? 'current' : 'todo'
          const reachable = s.n <= reached && s.n !== step
          const content = (
            <>
              <span
                aria-hidden
                className={cn(
                  'block h-1.5 rounded-full transition-colors duration-(--dur-base) ease-out',
                  state === 'todo' ? (s.n <= reached ? 'bg-line-strong' : 'bg-line') : 'bg-forest',
                  state === 'current' && dir === 'forward' && 'gs-fill',
                )}
              />
              <span
                className={cn(
                  'mt-2 hidden items-center gap-1.5 text-[13px] leading-[1.3] md:flex',
                  state === 'current' ? 'font-semibold text-forest' : state === 'done' ? 'text-ink-soft' : 'text-muted',
                )}
              >
                {state === 'done' && <Check aria-hidden size={14} strokeWidth={2.5} className="shrink-0 text-success" />}
                {s.title}
              </span>
              <span className="sr-only">
                {state === 'done' ? ' — tamamlanıb' : state === 'current' ? ' — indiki addım' : ''}
              </span>
            </>
          )
          return (
            <li key={s.n} className="min-w-0">
              {reachable ? (
                <Link
                  href={stepPath(s.n)}
                  onClick={() => markStepChange(step, s.n)}
                  // The bar is 6 px: the hit area grows to 44 px tall around it without moving anything.
                  className="relative block rounded-sm py-1 after:absolute after:inset-x-0 after:-inset-y-[15px] after:content-[''] hover:opacity-80 md:after:-inset-y-1.5"
                >
                  <span className="sr-only">Addım {s.n}: </span>
                  {content}
                </Link>
              ) : (
                <span aria-current={state === 'current' ? 'step' : undefined} className="block py-1">
                  <span className="sr-only">Addım {s.n}: </span>
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** After a failed «Davam et»: what to fix, each item a link to its field. Receives focus. */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: Record<string, string>; labels: Record<string, string> }>(function ErrorSummary({ errors, labels }, ref) {
  const keys = Object.keys(errors)
  if (!keys.length) return null
  return (
    <div ref={ref} tabIndex={-1} role="alert" aria-labelledby="xeta-basliq" className="rounded-xl border border-danger/40 bg-danger-soft p-4 outline-none">
      <p id="xeta-basliq" className="text-sm leading-[1.5] font-semibold text-ink">
        Davam etmək üçün {keys.length === 1 ? 'bir xananı' : `${keys.length} xananı`} düzəldin
      </p>
      <ul className="mt-1.5 flex flex-col gap-1 text-[13px] leading-[1.5]">
        {keys.map((k) => (
          <li key={k}>
            <a
              href={`#${fieldDomId(k)}`}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(fieldDomId(k))
                el?.focus({ preventScroll: true })
                el?.scrollIntoView({ block: 'center' })
              }}
              className="text-danger underline underline-offset-2 hover:text-ink"
            >
              {labels[k] ? `${labels[k]}: ` : ''}
              {errors[k]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
})

interface PillsProps {
  name: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  /** Picking the chosen pill again clears it (optional fields) */
  clearable?: boolean
  firstId?: string
  invalid?: boolean
}

/** Single choice as pills: native radios (arrow keys move, one Tab stop), 44 px on touch screens. */
export function RadioPills({ name, options, value, onChange, clearable, firstId, invalid }: PillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => (
        <label
          key={o.value}
          className={cn(
            optionClass(o.value === value),
            'inline-flex cursor-pointer items-center pointer-coarse:h-11 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive',
            invalid && o.value !== value && 'border-danger/60',
          )}
        >
          <input
            id={i === 0 ? firstId : undefined}
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
            onClick={() => clearable && o.value === value && onChange('')}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/** Several choices as toggle pills (aria-pressed): months, service areas. */
export function TogglePills({ options, values, onChange, firstId }: { options: FilterOption[]; values: string[]; onChange: (values: string[]) => void; firstId?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o, i) => {
        const on = values.includes(o.value)
        return (
          <button
            key={o.value}
            id={i === 0 ? firstId : undefined}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])}
            className={cn(optionClass(on), 'inline-flex items-center gap-1.5 pointer-coarse:h-11')}
          >
            {on && <Check aria-hidden size={14} strokeWidth={2.6} className="shrink-0" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface UnitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: ReactNode
  unit?: string
  hint?: ReactNode
  error?: string
  optional?: boolean
  value: string
  onValueChange: (value: string) => void
  /** Allow a minus sign (frost hardiness) */
  negative?: boolean
  containerClassName?: string
}

/** Number field with its unit inside the box («sm», «₼», «litr»); a decimal keypad on phones. */
export function UnitInput({ label, unit, hint, error, optional, value, onValueChange, negative, containerClassName, id, ...rest }: UnitInputProps) {
  const ids = useFieldIds(id)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <div className="relative w-full">
        <input
          id={ids.fieldId}
          type="text"
          inputMode={negative ? 'text' : 'decimal'}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          value={value}
          onChange={(e) => onValueChange(e.target.value.replace(negative ? /[^\d.,−-]/g : /[^\d.,]/g, '').slice(0, 12))}
          className={cn(controlClass, 'tabular-nums', unit && 'pr-14 focus:pr-14')}
          {...rest}
        />
        {unit && (
          <span aria-hidden className="pointer-events-none absolute top-1/2 right-[13px] -translate-y-1/2 text-sm text-muted">
            {unit}
          </span>
        )}
      </div>
    </FieldShell>
  )
}

/** The listing as a card, live while the seller fills the form (the aside of steps 1–5). */
export function DraftCard({ draft, cover }: { draft: PostingDraft; cover?: string }) {
  const price = listingPrice({ price: Number(draft.price.replace(',', '.')) || 0, priceType: draft.priceType, priceUnit: draft.priceUnit || undefined })
  const line = attributeLine(draft.categoryId, draft.attrs).join(' · ')
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-[11px]">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-mint text-muted">
        {cover ? <img src={cover} alt="" className="size-full object-cover" /> : <ImageIcon size={28} strokeWidth={1.6} />}
      </div>
      <div className="flex flex-col gap-[3px] px-1 pb-1">
        <p className="text-[21px] leading-[1.25] font-bold text-forest tabular-nums">
          {draft.price || draft.priceType === 'agreement' ? price.amount : '— ₼'}
          {price.unit && draft.price && <span className="ml-1 text-sm font-normal text-muted">{price.unit}</span>}
        </p>
        <p className={cn('line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words', draft.title ? 'text-ink' : 'text-muted')}>
          {draft.title || 'Elanın başlığı'}
        </p>
        {line && <p className="truncate text-[13px] leading-[1.4] text-muted">{line}</p>}
        <p className="text-[13px] leading-[1.4] text-muted">{draft.cityId ? cityName(draft.cityId) : 'Şəhər'} · indi</p>
      </div>
    </div>
  )
}
