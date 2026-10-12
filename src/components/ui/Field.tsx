'use client'

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/format'

/*
 * Figma "Form sahəsi": label 13 px semibold #20352b, 7 px gap,
 * "Daxiletmə sahəsi" min-h 48, p 13, radius 8, 1 px #dee3d9 border, 14 px text (leading 1.5).
 * Focus → 2 px #788149 border, error → 1 px #b6443f border + 12 px error text, disabled → #e8ebe5.
 */
export const controlClass =
  'w-full min-h-12 rounded-lg border border-line bg-surface px-[13px] py-3 text-sm leading-[1.5] text-ink placeholder:text-ink ' +
  'outline-none transition-[border-color] focus:border-2 focus:border-olive focus:px-3 focus:py-[11px] ' +
  'disabled:bg-disabled disabled:text-muted aria-[invalid=true]:border-danger'

interface FieldShellProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  htmlFor?: string
  className?: string
  children: ReactNode
}

export function FieldShell({ label, hint, error, htmlFor, className, children }: FieldShellProps) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-[7px]', className)}>
      {label && (
        <label htmlFor={htmlFor} className="w-full text-[13px] leading-[normal] font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="w-full text-xs leading-[1.5] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="w-full text-xs leading-[1.5] text-muted">{hint}</p>
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  containerClassName?: string
}

export function TextField({ label, hint, error, containerClassName, className, id, ...rest }: TextFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} className={containerClassName}>
      <input id={fieldId} aria-invalid={error ? true : undefined} className={cn(controlClass, className)} {...rest} />
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  containerClassName?: string
}

export function TextAreaField({ label, hint, error, containerClassName, className, id, ...rest }: TextAreaFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} className={containerClassName}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
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
  options: SelectOption[]
  containerClassName?: string
}

export function SelectField({ label, hint, error, options, containerClassName, className, id, ...rest }: SelectFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={fieldId} className={containerClassName}>
      <div className="relative w-full">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
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
