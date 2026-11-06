'use client'

import { useSyncExternalStore } from 'react'
import { formatDayMonth, formatRelativeDate } from '@/lib/format'

const subscribe = () => () => {}
// One "now" per page load keeps the snapshot stable between renders.
let pageNow: number | undefined
const clientNow = () => (pageNow ??= Date.now())
const serverNow = () => null

/**
 * "2 gün əvvəl" on cards. The server HTML (and static pages built days earlier) carries the date ("12 oktyabr");
 * the browser swaps in the relative form right after hydration, inside the same one-line box.
 */
export function RelativeDate({ iso }: { iso: string }) {
  const now = useSyncExternalStore(subscribe, clientNow, serverNow)
  return <time dateTime={iso}>{now == null ? formatDayMonth(iso) : formatRelativeDate(iso, now)}</time>
}
