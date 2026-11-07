'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/format'
import { useStickySide } from '@/features/search/useStickySide'

/**
 * A side column that sticks under the header from `lg` (the catalogue sidebar's `sticky-side`): when it fits the
 * window it stays put; a taller one scrolls with the page and then sticks by its bottom edge.
 */
export function StickyAside({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  const ref = useStickySide<HTMLElement>()
  return (
    <aside ref={ref} aria-label={label} className={cn('lg:sticky-side flex flex-col gap-4', className)}>
      {children}
    </aside>
  )
}
