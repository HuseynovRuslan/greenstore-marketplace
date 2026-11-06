'use client'

import { ChevronDown, MapPin } from 'lucide-react'
import { Listbox, listboxChevronClass, type ListboxOption } from '@/components/ui/Listbox'
import { cn } from '@/lib/format'
import { PARAM } from './filterDefs'

/**
 * City field of the search cards (home hero, catalogue): the custom Listbox from md up, a native <select> on phones
 * (their own pickers are better there). Both show the same value; only the native one has a `name`, for the
 * no-JavaScript form submit.
 */
export function CityField({ value, onChange, options }: { value: string; onChange: (city: string) => void; options: ListboxOption[] }) {
  const pin = <MapPin aria-hidden size={18} strokeWidth={2} className="shrink-0 text-muted" />
  return (
    <>
      <Listbox
        label="Şəhər"
        value={value}
        onChange={onChange}
        options={options}
        icon={pin}
        className="hidden h-[52px] w-[196px] shrink-0 border-l border-line pl-1.5 md:block"
      />
      <label className="relative flex h-12 min-w-0 flex-1 items-center gap-2 rounded-option border border-line bg-cream pl-3 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-olive md:hidden">
        {pin}
        <span className="sr-only">Şəhər</span>
        <select
          name={PARAM.city}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-9 text-[15px] leading-[normal] font-medium text-ink outline-none pointer-coarse:text-base"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden size={16} strokeWidth={2} className={cn(listboxChevronClass, 'pointer-events-none absolute right-3')} />
      </label>
    </>
  )
}
