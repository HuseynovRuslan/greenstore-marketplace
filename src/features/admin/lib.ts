import { useEffect, useState } from 'react'
import { cn, formatFullDate } from '@/lib/format'

/* ------------------------------------------------------------------ */
/* Session state for the admin screens                                   */
/* ------------------------------------------------------------------ */

const sessionCache = new Map<string, unknown>()

/**
 * useState that survives switching between the admin tabs (the pages unmount on navigation) but resets on a full
 * reload, so the demo always starts from the Figma state. Decisions about the user's own wizard listings are
 * persisted separately through `useMyListings().updateListing`.
 */
export function useAdminState<T>(key: string, init: () => T) {
  const [value, setValue] = useState<T>(() => (sessionCache.has(key) ? (sessionCache.get(key) as T) : init()))
  useEffect(() => {
    sessionCache.set(key, value)
  }, [key, value])
  return [value, setValue] as const
}

/* ------------------------------------------------------------------ */
/* Formatting                                                            */
/* ------------------------------------------------------------------ */

const AZ_MONTHS_SHORT = ['yan.', 'fev.', 'mar.', 'apr.', 'may', 'iyn.', 'iyl.', 'avq.', 'sen.', 'okt.', 'noy.', 'dek.']

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-10-12T11:32:00" → "12 okt. · 11:32" (moderation queue rows; zoned ISO strings are shown in local time). */
export function formatQueueTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getDate()} ${AZ_MONTHS_SHORT[date.getMonth()]} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Local "YYYY-MM-DDTHH:MM:SS" for the current moment (no timezone shift). */
export function localIsoNow(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/** Time label for a new "Qərar tarixçəsi" entry: "12 oktyabr 2026, 14:05". */
export function historyTimestamp(date = new Date()): string {
  return `${formatFullDate(localIsoNow(date))}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                        */
/* ------------------------------------------------------------------ */

/** Below 1280 px the list and the detail panel are stacked: bring the detail into view after a selection. */
export function revealWhenStacked(element: HTMLElement | null) {
  if (!element || typeof window === 'undefined') return
  if (window.matchMedia('(max-width: 1279.98px)').matches) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** Figma "Bölmə" chip: min-h 44, p 12, radius 8, 13 px; active = forest + semibold white. */
export function chipClass(active: boolean, className?: string) {
  return cn(
    'inline-flex min-h-11 shrink-0 items-start rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors',
    'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:ring-inset',
    active ? 'bg-forest font-semibold text-white' : 'bg-mint text-forest hover:bg-[#dfe8de]',
    className,
  )
}

/** Selectable queue/list card: selected = mint background (border colour differs per screen in Figma). */
export function rowClass(selected: boolean, selectedBorder: 'forest' | 'line', className?: string) {
  return cn(
    'w-full border text-left transition-colors',
    selected ? cn('bg-mint', selectedBorder === 'forest' ? 'border-forest' : 'border-line') : 'border-line bg-surface hover:border-olive',
    className,
  )
}
