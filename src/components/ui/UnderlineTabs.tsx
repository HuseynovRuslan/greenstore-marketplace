'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn, formatNumber } from '@/lib/format'

export interface UnderlineTab {
  key: string
  label: string
  count?: number
  href: string
  active: boolean
  /** Small mark after the label, e.g. a dot for "needs attention" */
  badge?: ReactNode
}

/**
 * Section tabs that are links (the state lives in the URL, so Back and sharing work): the hero's underline look —
 * 15 px medium label, muted count, a 2 px forest underline on the current one. One row that scrolls sideways on
 * phones (no wrap), with the current tab marked aria-current="page". When the row is wider than the screen its
 * cut-off side fades out (a cue that it scrolls) and the current tab is scrolled into view, so «Qaralamalar» or
 * «Profil» is never selected off screen.
 */
export function UnderlineTabs({ label, tabs, className }: { label: string; tabs: UnderlineTab[]; className?: string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const activeKey = tabs.find((t) => t.active)?.key

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => setEdges({ start: list.scrollLeft > 4, end: list.scrollLeft + list.clientWidth < list.scrollWidth - 4 })
    const current = list.querySelector<HTMLElement>('[aria-current="page"]')
    if (current && list.scrollWidth > list.clientWidth) {
      // Only the row scrolls (never the page): the current tab ends up with its neighbour peeking on each side.
      const left = current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2
      list.scrollLeft = Math.max(0, left)
    }
    measure()
    list.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      list.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [activeKey])

  const fade = 'linear-gradient(to right, transparent, black 32px, black calc(100% - 32px), transparent)'
  const mask = edges.start && edges.end ? fade : edges.end ? 'linear-gradient(to right, black calc(100% - 32px), transparent)' : edges.start ? 'linear-gradient(to right, transparent, black 32px)' : undefined

  return (
    <nav aria-label={label} className={cn('relative w-full border-b border-line', className)}>
      <ul ref={listRef} className="scrollbar-none -mb-px flex gap-1 overflow-x-auto overscroll-x-contain" style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
        {tabs.map((t) => (
          <li key={t.key} className="shrink-0">
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.active ? 'page' : undefined}
              className={cn(
                'relative flex h-12 items-center gap-1.5 px-3 text-[15px] leading-[normal] font-medium whitespace-nowrap transition-colors duration-(--dur-fast)',
                t.active
                  ? "text-forest after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-forest after:content-['']"
                  : 'text-ink-soft hover:text-forest active:opacity-70',
              )}
            >
              {t.label}
              {t.count != null && <span className="text-[13px] font-medium text-muted tabular-nums">{formatNumber(t.count)}</span>}
              {t.badge}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
