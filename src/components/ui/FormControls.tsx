'use client'

import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/format'
import { nameChars, NAME_PART_MAX } from '@/lib/names'
import { formatLocal, LOCAL_MASK, localDigits, phoneValue } from '@/lib/phone'
import { controlClass, describedBy, FieldShell, TextField, useFieldIds, useErrorRole } from './Field'

/*
 * Form controls added for the posting flow, auth and the cabinet (Nov 2026). They share Field.tsx's shell: a
 * visible label, a hint or an error tied to the control, 48 px boxes and 16 px text on touch screens.
 */

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

interface PhoneFieldProps extends InputProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  /** "+994 50 555 12 34" or '' */
  value: string
  onValueChange: (value: string) => void
  labelHidden?: boolean
  containerClassName?: string
}

/**
 * Phone number: «+994 __ ___ __ __». The code is fixed, digits take the places of the mask as they are typed and
 * nothing else gets in (letters, symbols, a leading 0: lib/phone.ts). The mask is a layer behind the input: the typed
 * part is repeated in it invisibly, so the rest of the mask starts exactly where the caret is. `type="tel"` gets the
 * phone keypad; `autocomplete="tel"` lets the browser fill a saved number, whatever its shape.
 */
export function PhoneField({ label = 'Telefon nömrəsi', hint, error, optional, value, onValueChange, labelHidden, containerClassName, id, className, ...rest }: PhoneFieldProps) {
  const ids = useFieldIds(id)
  const local = formatLocal(localDigits(value))
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} labelHidden={labelHidden} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <div
        className={cn(
          controlClass,
          // `p-0!`: controlClass's px/py come later in the CSS than a plain p-0 and would make the box 72 px tall.
          'flex cursor-text items-center p-0! tabular-nums focus-within:border-olive focus-within:shadow-[inset_0_0_0_1px_var(--color-olive)] has-[input[aria-invalid=true]]:border-danger',
          className,
        )}
      >
        {/* A label too, so a tap on the code puts the caret in the number (the input's aria-label names it). */}
        <label htmlFor={ids.fieldId} aria-hidden className="shrink-0 cursor-text pl-[13px] text-ink select-none">
          +994&nbsp;
        </label>
        <span className="relative flex min-w-0 flex-1 items-center">
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center whitespace-pre text-muted select-none">
            <span className="invisible">{local}</span>
            {LOCAL_MASK.slice(local.length)}
          </span>
          <input
            id={ids.fieldId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            // The visible «+994» and mask are decoration; the accessible name says the code is already there.
            aria-label={typeof label === 'string' ? `${label}, +994 kodu ilə` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(ids, hint, error)}
            value={local}
            onChange={(e) => onValueChange(phoneValue(e.target.value))}
            className="relative h-[46px] w-full min-w-0 bg-transparent pr-[13px] text-ink outline-none"
            {...rest}
          />
        </span>
      </div>
    </FieldShell>
  )
}

interface NameFieldProps extends InputProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  optional?: boolean
  aside?: ReactNode
  labelHidden?: boolean
  value: string
  onValueChange: (value: string) => void
  containerClassName?: string
}

/**
 * A person's name («Ad», «Soyad», «Adınız»): letters only, so a digit or a symbol does not get in, typed or pasted
 * (lib/names.ts). Words start with a capital on phone keyboards; no spell check underlines a surname.
 */
export function NameField({ value, onValueChange, maxLength = NAME_PART_MAX, ...rest }: NameFieldProps) {
  return (
    <TextField
      type="text"
      autoCapitalize="words"
      spellCheck={false}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onValueChange(nameChars(e.target.value))}
      {...rest}
    />
  )
}

interface PasswordFieldProps extends InputProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  value: string
  onValueChange: (value: string) => void
  /** "current-password" (sign in) or "new-password" (registration, reset) — password managers rely on it. */
  autoComplete: 'current-password' | 'new-password'
  containerClassName?: string
  aside?: ReactNode
}

/** Password with a show / hide button (44 px, its state announced with aria-pressed). Paste always works. */
export function PasswordField({ label = 'Şifrə', hint, error, value, onValueChange, autoComplete, containerClassName, aside, id, 'aria-describedby': extra, ...rest }: PasswordFieldProps) {
  const ids = useFieldIds(id)
  const [shown, setShown] = useState(false)
  return (
    <FieldShell label={label} hint={hint} error={error} aside={aside} htmlFor={ids.fieldId} {...ids} className={containerClassName}>
      <div className="relative w-full">
        <input
          id={ids.fieldId}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error, extra)}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn(controlClass, 'pr-12 focus:pr-12')}
          {...rest}
        />
        <button
          type="button"
          aria-pressed={shown}
          aria-label="Şifrəni göstər"
          aria-controls={ids.fieldId}
          onClick={() => setShown((s) => !s)}
          className="absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-option text-muted transition-colors duration-(--dur-fast) hover:text-forest"
        >
          {shown ? <EyeOff aria-hidden size={19} strokeWidth={1.8} /> : <Eye aria-hidden size={19} strokeWidth={1.8} />}
        </button>
      </div>
    </FieldShell>
  )
}

interface OtpFieldProps extends InputProps {
  ref?: Ref<HTMLInputElement>
  label?: ReactNode
  hint?: ReactNode
  error?: string
  value: string
  onValueChange: (value: string) => void
  length?: number
}

/**
 * SMS code: one real input (`autocomplete="one-time-code"` lets iOS and Android offer the code from the message,
 * paste works) drawn as boxes. The input sits over the boxes, transparent; the box after the last digit shows the
 * focus ring.
 */
export function OtpField({ label = 'SMS kodu', hint, error, value, onValueChange, length = 4, id, ...rest }: OtpFieldProps) {
  const ids = useFieldIds(id)
  const digits = value.replace(/\D/g, '').slice(0, length)
  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={ids.fieldId} {...ids}>
      <div className="group relative">
        <div aria-hidden className="flex gap-2.5">
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                'flex size-14 items-center justify-center rounded-lg border bg-surface text-[22px] font-semibold text-ink tabular-nums transition-[border-color] duration-(--dur-fast)',
                error ? 'border-danger' : 'border-line',
                i === Math.min(digits.length, length - 1) && 'group-focus-within:border-2 group-focus-within:border-olive',
              )}
            >
              {digits[i] ?? ''}
            </span>
          ))}
        </div>
        <input
          id={ids.fieldId}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, hint, error)}
          value={digits}
          onChange={(e) => onValueChange(e.target.value.replace(/\D/g, '').slice(0, length))}
          className="absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
          {...rest}
        />
      </div>
    </FieldShell>
  )
}

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
  id?: string
}

/** On/off setting with role="switch": the whole row (≥ 44 px) toggles it. */
export function Switch({ checked, onCheckedChange, label, description, disabled, className, id }: SwitchProps) {
  const ids = useFieldIds(id)
  return (
    <button
      id={ids.fieldId}
      type="button"
      role="switch"
      aria-checked={checked}
      // Named by the label alone; the description is read as the description.
      aria-labelledby={`${ids.fieldId}-label`}
      aria-describedby={description ? ids.hintId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn('group flex min-h-11 w-full items-start justify-between gap-4 py-1.5 text-left disabled:opacity-50', className)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={`${ids.fieldId}-label`} className="text-sm leading-[1.4] font-medium text-ink">
          {label}
        </span>
        {description && (
          <span id={ids.hintId} className="text-xs leading-[1.5] text-muted">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative mt-0.5 inline-flex h-7 w-12 shrink-0 rounded-full transition-colors duration-(--dur-base) ease-out',
          checked ? 'bg-forest' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow-sm transition-transform duration-(--dur-base) ease-out motion-reduce:transition-none',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  )
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  error?: string
}

/** Checkbox with its label in one ≥ 44 px row; forest when checked. */
export function CheckboxField({ label, error, className, id, ...rest }: CheckboxFieldProps) {
  const ids = useFieldIds(id)
  const errorRole = useErrorRole()
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={ids.fieldId} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5 text-sm leading-[1.45] text-ink">
        <input
          id={ids.fieldId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.errorId : undefined}
          className="mt-px size-5 shrink-0 cursor-pointer accent-forest"
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={ids.errorId} role={errorRole} className="text-xs leading-[1.5] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

interface ChoiceCardProps {
  name: string
  value: string
  checked: boolean
  onChange: (value: string) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  /** Extra line at the end, e.g. a price */
  meta?: ReactNode
  className?: string
  describedById?: string
  /** Id of the input (error summaries focus it) */
  id?: string
  /** `checkbox`: one of several that can all be on (a business's kinds); its mark is square, not round */
  type?: 'radio' | 'checkbox'
}

/**
 * A radio choice drawn as a card (account type, price type, promotion package), or a checkbox one (`type`, a
 * business's kinds). A native input inside a label: arrow keys move within a radio group, Tab between checkboxes; the
 * group needs a <fieldset> + <legend> around it.
 */
export function ChoiceCard({ name, value, checked, onChange, title, description, icon, meta, className, describedById, id, type = 'radio' }: ChoiceCardProps) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer gap-3 rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,scale] duration-(--dur-fast) ease-out active:scale-[0.99] motion-reduce:active:scale-100',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive',
        checked ? 'border-forest bg-mint shadow-[inset_0_0_0_1px_var(--color-forest)]' : 'border-line bg-surface hover:border-line-strong',
        className,
      )}
    >
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        aria-describedby={describedById}
        className="sr-only"
      />
      {icon && (
        <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', checked ? 'bg-surface text-forest' : 'bg-mint text-forest')}>
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="pr-7 text-[15px] leading-[1.35] font-semibold text-ink">{title}</span>
        {description && <span className="text-[13px] leading-[1.5] text-muted">{description}</span>}
        {meta}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute top-4 right-4 flex size-5 items-center justify-center border transition-colors duration-(--dur-fast)',
          type === 'checkbox' ? 'rounded-md' : 'rounded-full',
          checked ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface',
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
    </label>
  )
}

/** Fieldset with a visible legend in the label style — the wrapper for ChoiceCard groups and option pills. */
export function FieldGroup({ legend, hint, error, optional, children, className }: { legend: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode; className?: string }) {
  const ids = useFieldIds()
  const errorRole = useErrorRole()
  return (
    <fieldset aria-describedby={error ? ids.errorId : hint ? ids.hintId : undefined} aria-invalid={error ? true : undefined} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <legend className="mb-2.5 text-[13px] leading-[normal] font-semibold text-ink">
        {legend}
        {optional && <span className="font-normal text-muted"> (istəyə bağlı)</span>}
      </legend>
      {children}
      {error ? (
        <p id={ids.errorId} role={errorRole} className="text-xs leading-[1.5] text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={ids.hintId} className="text-xs leading-[1.5] text-muted">
            {hint}
          </p>
        )
      )}
    </fieldset>
  )
}
