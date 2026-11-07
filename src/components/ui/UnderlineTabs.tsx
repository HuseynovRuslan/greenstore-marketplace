import Link from 'next/link'
import type { ReactNode } from 'react'
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
 * phones (no wrap), with the current tab marked aria-current="page".
 */
export function UnderlineTabs({ label, tabs, className }: { label: string; tabs: UnderlineTab[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn('relative w-full border-b border-line', className)}>
      <ul className="scrollbar-none -mb-px flex gap-1 overflow-x-auto overscroll-x-contain">
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
