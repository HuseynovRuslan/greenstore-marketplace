'use client'

import { useId } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { serviceSortOptions, type ServiceSort } from './query'

/*
 * Figma sort control: secondary "Düymə" with arrow-down-up icon + current option ("Ən yenilər").
 * A transparent native <select> covers the button so the menu is accessible and works on touch devices.
 */
export function SortSelect({ value, onChange }: { value: ServiceSort; onChange: (value: ServiceSort) => void }) {
  const id = useId()
  const current = serviceSortOptions.find((o) => o.value === value) ?? serviceSortOptions[0]
  return (
    <div className={buttonClass('secondary', 'relative focus-within:ring-[3px] focus-within:ring-olive focus-within:ring-inset')}>
      <ArrowDownUp aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
      <span aria-hidden>{current.label}</span>
      <label htmlFor={id} className="sr-only">
        Sıralama
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as ServiceSort)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {serviceSortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
