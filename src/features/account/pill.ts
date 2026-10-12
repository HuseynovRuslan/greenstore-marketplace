import { cn } from '@/lib/format'

/** Figma "Bölmə" (inside "Bölmə seçimləri"): min-h 44, p 12, radius 8, 13 px; active #173f32 semibold white, rest #eaf0e9. */
export function pillClass(active: boolean, className?: string) {
  return cn(
    'inline-flex min-h-11 shrink-0 items-start rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors',
    active ? 'bg-forest font-semibold text-white' : 'bg-mint text-forest hover:bg-[#dfe8de]',
    className,
  )
}
