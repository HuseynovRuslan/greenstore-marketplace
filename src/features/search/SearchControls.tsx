'use client'

import { ChevronDown } from 'lucide-react'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/format'
import { listingSortOptions, type ListingSort } from '@/services/marketplace'
import type { FilterChip, SearchView } from './searchState'

/** Figma "Seçilmiş filtrlər": 12 px semibold "Nişan" chips on #eaf0e9 with "×", then a 12 px "Hamısını təmizlə" link. */
export function ActiveFilterChips({ chips, showClearAll, onRemove, onClearAll }: {
  chips: FilterChip[]
  showClearAll: boolean
  onRemove: (chip: FilterChip) => void
  onClearAll: () => void
}) {
  if (!chips.length && !showClearAll) return null
  return (
    <div className="flex w-full flex-wrap items-start gap-2" aria-label="Seçilmiş filtrlər" role="group">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip)}
          aria-label={`${chip.label} filtrini sil`}
          className="inline-flex shrink-0 items-start rounded-[5px] bg-mint px-[9px] py-[5px] text-xs leading-[normal] font-semibold whitespace-nowrap text-forest transition-colors hover:bg-[#dfe8de]"
        >
          {chip.label} ×
        </button>
      ))}
      {showClearAll && (
        <button type="button" onClick={onClearAll} className="text-xs leading-[1.5] whitespace-nowrap text-forest hover:text-olive hover:underline">
          Hamısını təmizlə
        </button>
      )}
    </div>
  )
}

/** Figma "Bölmə seçimləri": "Şəbəkə" / "Siyahı" (min-h 44, p 12, r 8, 13 px; active #173f32 semibold, idle #eaf0e9). */
export function ViewToggle({ view, onChange }: { view: SearchView; onChange: (view: SearchView) => void }) {
  const items: Array<[SearchView, string]> = [
    ['grid', 'Şəbəkə'],
    ['list', 'Siyahı'],
  ]
  return (
    <div role="group" aria-label="Görünüş" className="flex shrink-0 items-start gap-2">
      {items.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={cn(
            'min-h-11 rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors',
            view === value ? 'bg-forest font-semibold text-white' : 'bg-mint text-forest hover:bg-[#dfe8de]',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Figma sort "Düymə" (white, 1 px border, 18 px chevron-down + 14 px semibold "Ən yenilər").
 * A transparent native <select> sits on top so the options and keyboard handling stay native.
 */
export function SortSelect({ value, onChange, className }: { value: ListingSort; onChange: (sort: ListingSort) => void; className?: string }) {
  const label = listingSortOptions.find((o) => o.value === value)?.label ?? listingSortOptions[0].label
  return (
    <div className={cn('group relative shrink-0 rounded-lg has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-olive', className)}>
      <span aria-hidden className={buttonClass('secondary', 'pointer-events-none w-full group-hover:border-olive')}>
        <ChevronDown size={18} strokeWidth={1.8} absoluteStrokeWidth />
        {label}
      </span>
      <select
        aria-label="Sıralama"
        value={value}
        onChange={(e) => onChange(e.target.value as ListingSort)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {listingSortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
