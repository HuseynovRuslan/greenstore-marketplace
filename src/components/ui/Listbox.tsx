'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn, lowerAz } from '@/lib/format'
import { panelAlignClass, panelClass, useOpenPanelCount, useOutsidePress, usePanelAlign, usePresence, type PanelAlign } from './Popover'

export interface ListboxOption {
  value: string
  label: string
  /** Right-aligned secondary text, e.g. the listing count. */
  meta?: ReactNode
}

/**
 * Trigger look shared with the native <select> used below md (same height, text and icons):
 * 15 px medium ink, MapPin-style leading icon, chevron at the end. The caller sets the height and the divider.
 */
export const listboxTriggerClass =
  'flex h-full w-full min-w-0 items-center gap-2 rounded-option px-3 text-left text-[15px] leading-[normal] font-medium text-ink'

export const listboxChevronClass = 'shrink-0 text-muted'

interface ListboxProps {
  /** Accessible name, rendered visually hidden (e.g. "Şəhər"). */
  label: string
  value: string
  onChange: (value: string) => void
  options: ListboxOption[]
  /** Decorative leading icon (aria-hidden). */
  icon?: ReactNode
  /** Adds a hidden input so a plain form submit carries the value. */
  name?: string
  align?: PanelAlign
  className?: string
  triggerClassName?: string
  /** Id of the trigger button (so a form's error summary can move focus to it) */
  id?: string
  /** The field's error, announced with the trigger */
  invalid?: boolean
  describedBy?: string
}

/** Type-ahead keeps the typed letters for this long (WAI-ARIA APG). */
const TYPEAHEAD_MS = 500
const PAGE = 10

/**
 * Select-only combobox (WAI-ARIA APG "select-only combobox"): a button with role="combobox" that opens a
 * listbox. Focus stays on the button; the active option is announced through aria-activedescendant.
 *
 * Closed: Enter, Space, ↓ or ↑ open at the selected option; Home / End open at the first / last option;
 *         a letter opens at the next option starting with it.
 * Open:   ↑ ↓ PageUp PageDown Home End move; letters search (Azerbaijani letters are distinct: ş ≠ s, ı ≠ i);
 *         Enter or Space select and close; Tab selects, closes and moves on (as in the APG);
 *         Esc closes without changing the value.
 * Pointer: click the trigger to toggle, click an option to select it, press outside to close.
 */
export function Listbox({ label, value, onChange, options, icon, name, align, className, triggerClassName, id, invalid, describedBy }: ListboxProps) {
  const baseId = useId()
  const labelId = `${baseId}-label`
  const listboxId = `${baseId}-listbox`
  const optionId = (i: number) => `${baseId}-option-${i}`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Opened or closed from the keyboard: no animation (data-instant) — keyboard actions repeat and must feel immediate.
  const [instant, setInstant] = useState(false)
  const { present, state, onTransitionEnd } = usePresence(open)
  usePanelAlign(present, listRef, align)
  useOpenPanelCount(open)
  useOutsidePress(open, rootRef, () => {
    setInstant(false)
    setOpen(false)
  })

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const selected = options[selectedIndex]
  const last = options.length - 1

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, baseId])

  const openAt = (index: number) => {
    setActive(Math.min(Math.max(index, 0), last))
    setOpen(true)
  }

  const commit = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    setOpen(false)
  }

  const choose = (index: number) => {
    commit(index)
    triggerRef.current?.focus()
  }

  /** Index of the option the typed letters point to, or -1. A repeated letter cycles through its options. */
  const typeahead = (char: string, from: number) => {
    const now = Date.now()
    const t = typed.current
    t.text = now - t.at < TYPEAHEAD_MS ? t.text + char : char
    t.at = now
    const query = lowerAz(t.text)
    const repeated = [...query].every((c) => c === query[0])
    const needle = repeated ? query[0] : query
    const start = repeated ? from + 1 : from
    for (let i = 0; i < options.length; i++) {
      const index = (start + i + options.length) % options.length
      if (lowerAz(options[index].label).startsWith(needle)) return index
    }
    return -1
  }
  const typing = () => Date.now() - typed.current.at < TYPEAHEAD_MS

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    setInstant(true)
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key) && !(e.key === ' ' && typing())) {
        e.preventDefault()
        openAt(selectedIndex)
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        openAt(e.key === 'Home' ? 0 : last)
      } else if (printable) {
        e.preventDefault()
        const match = typeahead(e.key, selectedIndex)
        openAt(match >= 0 ? match : selectedIndex)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (e.altKey && e.key === 'ArrowUp') return choose(active)
        setActive((i) => Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), last))
        return
      case 'PageDown':
      case 'PageUp':
        e.preventDefault()
        setActive((i) => Math.min(Math.max(i + (e.key === 'PageDown' ? PAGE : -PAGE), 0), last))
        return
      case 'Home':
      case 'End':
        e.preventDefault()
        setActive(e.key === 'Home' ? 0 : last)
        return
      case 'Enter':
        e.preventDefault()
        return choose(active)
      case 'Escape':
        // Keep the value; stop here so an enclosing dialog stays open.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        return
      case 'Tab':
        // No preventDefault: focus moves on to the next control.
        commit(active)
        return
    }
    if (e.key === ' ' && !typing()) {
      e.preventDefault()
      return choose(active)
    }
    if (printable) {
      e.preventDefault()
      const match = typeahead(e.key, active)
      if (match >= 0) setActive(match)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        onClick={() => {
          setInstant(false)
          if (open) setOpen(false)
          else openAt(selectedIndex)
        }}
        onKeyDown={onKeyDown}
        // Space is handled on keydown; cancel the button's own click on keyup so it doesn't toggle again.
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        className={cn(listboxTriggerClass, triggerClassName)}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className={cn(
            listboxChevronClass,
            'transition-transform duration-(--dur-panel-in) ease-out motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {/* Always in the DOM so aria-controls resolves; `hidden` once the exit transition is over. */}
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-labelledby={labelId}
        hidden={!present}
        inert={!open}
        data-state={state}
        data-instant={instant || undefined}
        onTransitionEnd={onTransitionEnd}
        // Keep focus on the trigger when an option is pressed.
        onMouseDown={(e) => e.preventDefault()}
        className={cn(panelClass, panelAlignClass, 'max-h-80 w-max min-w-full overflow-y-auto overscroll-contain p-1.5')}
      >
        {options.map((option, i) => {
          const isSelected = i === selectedIndex
          return (
            <li
              key={option.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              data-active={i === active || undefined}
              onPointerMove={() => i !== active && setActive(i)}
              onClick={() => {
                setInstant(false)
                choose(i)
              }}
              className={cn(
                'flex h-11 cursor-pointer items-center gap-3 rounded-option px-3 text-[15px] leading-[normal] whitespace-nowrap',
                'transition-colors duration-(--dur-fast) data-active:bg-mint',
                isSelected ? 'font-semibold text-forest' : 'text-ink',
              )}
            >
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.meta != null && <span className="text-[13px] font-normal text-muted tabular-nums">{option.meta}</span>}
              <Check aria-hidden size={16} strokeWidth={2.4} className={cn('shrink-0 text-forest', !isSelected && 'invisible')} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
