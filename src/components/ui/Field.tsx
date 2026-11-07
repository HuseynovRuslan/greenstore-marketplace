'use client'

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/format'

/*
 * Figma "Form sahəsi": label 13 px semibold #20352b, 7 px gap,
 * "Daxiletmə sahəsi" min-h 48, p 13, radius 8, 1 px #dee3d9 border, 14 px text (leading 1.5).
 * Focus → 2 px #788149 border, error → 1 px #b6443f border + 12 px error text, disabled → #e8ebe5.
 * Placeholders are muted (an example, never a value), and the hint / error are tied to the control with
 * aria-describedby, so a screen reader reads them with the field.
 */
export const controlClass =
  // 16 px on touch screens: iOS zooms into any field under 16 px and stays zoomed.
  'w-full min-h-12 rounded-lg border border-line bg-surface px-[13px] py-3 text-sm leading-[1.5] text-ink placeholder:text-muted pointer-coarse:text-base ' +
  'outline-none transition-[border-color] hover:border-line-strong focus:border-2 focus:border-olive focus:px-3 focus:py-[11px] ' +
  'disabled:bg-disabled disabled:text-muted aria-[invalid=true]:border-danger'

/** Ids of a field's control, hint and error (the hint and error ids are only referenced while they are shown). */
export function useFieldIds(id?: string) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return { fieldId, hintId: `${fieldId}-hint`, errorId: `${fieldId}-error` }
}

/** aria-describedby for a control: its error when there is one, otherwise its hint. */
export function describedBy(ids: { hintId: string; errorId: string }, hint: ReactNode, error?: string, extra?: string) {
  return [error ? ids.errorId : hint ? ids.hintId : undefined, extra].filter(Boolean).join(' ') || undefined
}

interface FieldShellProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  htmlFor?: string
  hintId?: string
  errorId?: string
  /** Adds «istəyə bağlı» after the label (most fields are required, so the few optional ones are marked). */
  optional?: boolean
  /** Right side of the label row, e.g. a character counter. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

export function FieldShell({ label, hint, error, htmlFor, hintId, errorId, optional, aside, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-[7px]', className)}>
      {(label || aside) && (
        <div className="flex w-full items-baseline justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] leading-[normal] font-semibold text-ink">
              {label}
              {optional && <span className="font-normal text-muted"> (istəyə bağlı)</span>}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="w-full text-xs leading-[1.5] text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="w-full text-xs leading-[1.5] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  aside?: ReactNode
  containerClassName?: string
}

export function TextField({ label, hint, error, optional, aside, containerClassName, className, id, 'aria-describedby': extra, ...rest }: TextFieldProps) {
  const ids = useFieldIds(id)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} aside={aside} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <input
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error, extra)}
        className={cn(controlClass, className)}
        {...rest}
      />
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  aside?: ReactNode
  containerClassName?: string
}

export function TextAreaField({ label, hint, error, optional, aside, containerClassName, className, id, 'aria-describedby': extra, ...rest }: TextAreaFieldProps) {
  const ids = useFieldIds(id)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} aside={aside} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <textarea
        id={ids.fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, hint, error, extra)}
        className={cn(controlClass, 'min-h-[116px] resize-y', className)}
        {...rest}
      />
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  options: SelectOption[]
  containerClassName?: string
}

export function SelectField({ label, hint, error, optional, options, containerClassName, className, id, ...rest }: SelectFieldProps) {
  const ids = useFieldIds(id)
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <div className="relative w-full">
        <select
          id={ids.fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          className={cn(controlClass, 'cursor-pointer appearance-none pr-10', className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={1}
          absoluteStrokeWidth
          className="pointer-events-none absolute top-1/2 right-[13px] -translate-y-1/2 text-forest"
        />
      </div>
    </FieldShell>
  )
}

/** «22 / 80»: a quiet counter that turns red past the limit. Polite, so it isn't read on every keystroke. */
export function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max
  return (
    <span className={cn('text-xs leading-[normal] tabular-nums', over ? 'font-semibold text-danger' : 'text-muted')}>
      {value.length} / {max}
    </span>
  )
}
