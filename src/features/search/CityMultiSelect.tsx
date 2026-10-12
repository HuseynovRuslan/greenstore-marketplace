'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { FieldShell, controlClass } from '@/components/ui/Field'
import { cities, cityName } from '@/data/cities'
import { cn } from '@/lib/format'

interface CityMultiSelectProps {
  label: string
  value: string[]
  onChange: (cityIds: string[]) => void
}

/**
 * "Şəhər seçin" — closed state looks like the other selects ("Bakı, Abşeron" + chevron),
 * open state follows Figma "Açıq seçim menyusu" (white, 1 px border, r 8, p 18, 13 px title, 14 px ✓ list).
 */
export function CityMultiSelect({ label, value, onChange }: CityMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const display = value.length ? value.map(cityName).join(', ') : 'Bütün Azərbaycan'

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const toggle = (cityId: string) =>
    onChange(value.includes(cityId) ? value.filter((c) => c !== cityId) : cities.map((c) => c.id).filter((c) => c === cityId || value.includes(c)))

  return (
    <FieldShell label={label} htmlFor={`${id}-trigger`} className="w-full">
      <div
        ref={rootRef}
        className="relative w-full"
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Close when keyboard focus leaves the control (Tab past the last city).
          if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
        }}
      >
        <button
          ref={triggerRef}
          id={`${id}-trigger`}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={`${id}-menu`}
          onClick={() => setOpen((v) => !v)}
          className={cn(controlClass, 'relative block cursor-pointer truncate pr-10 text-left', open && 'border-2 border-olive px-3 py-[11px]')}
        >
          {display}
          <ChevronDown
            aria-hidden
            size={16}
            strokeWidth={1}
            absoluteStrokeWidth
            className="pointer-events-none absolute top-1/2 right-[13px] -translate-y-1/2 text-forest"
          />
        </button>
        {open && (
          <div
            id={`${id}-menu`}
            role="group"
            aria-label={label}
            tabIndex={-1}
            className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 flex flex-col gap-3 rounded-lg border border-line bg-surface p-[18px] shadow-card-hover outline-none"
          >
            <p aria-hidden className="text-[13px] leading-[1.5] font-semibold text-ink">
              {label}
            </p>
            <ul className="flex flex-col text-sm leading-[1.5] text-ink">
              <li>
                <label className="flex cursor-pointer items-center rounded py-1 whitespace-pre hover:text-olive has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-olive">
                  <input type="checkbox" className="sr-only" checked={value.length === 0} onChange={() => onChange([])} />
                  <CheckMark checked={value.length === 0} />
                  Bütün Azərbaycan
                </label>
              </li>
              {cities.map((c) => {
                const checked = value.includes(c.id)
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center rounded py-1 whitespace-pre hover:text-olive has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-olive">
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(c.id)} />
                      <CheckMark checked={checked} />
                      {c.name}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </FieldShell>
  )
}

/* Figma writes the selected city as "✓ Abşeron"; unselected cities have no marker. */
function CheckMark({ checked }: { checked: boolean }) {
  return checked ? <span aria-hidden>✓ </span> : null
}
