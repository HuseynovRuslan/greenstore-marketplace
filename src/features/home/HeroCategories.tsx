import Link from 'next/link'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { cn, formatNumber } from '@/lib/format'
import { categoryHref } from '@/seo/catalog'
import type { Category } from '@/types'

/**
 * Hero categories row on the photo (Nov 2026): one 48 px pill per category — a white 36 px circle with the forest
 * icon, the name in white and the count on a mint badge, all centred on one line. The pill is frosted white (12 %,
 * 22 % edge, backdrop blur) so its shape reads on any part of the photo; hover lifts it to 20 %, focus draws a mint
 * outline. From 640 px the pills are a centred group that wraps; narrower, they stay on one line and the row scrolls
 * sideways from screen edge to screen edge, snapping each pill to the gutter. The link is named in full («Ağaclar, 16
 * elan»), so the visual count badge is hidden from screen readers. `selected` mirrors the Kateqoriya filter of the
 * search card (a mint edge). `#kateqoriyalar` is the target of the menu link "Kateqoriyalar". `items` are the
 * product categories with their counts (heroCounts.ts; the dev worst-case page passes its own).
 *
 * Contrast: name (white) on the pill over the photos ≥ 4.6:1 (lightest photo pixel, see .gs-hero in index.css; on a
 * hovered or selected pill 3.9:1, a known gap in docs/handoff/follow-ups.md), count forest on mint 10:1, the mint
 * focus outline ≥ 3:1 on the photo.
 */
export function HeroCategories({ items, selected, className }: { items: Category[]; selected?: string; className?: string }) {
  return (
    <div id="kateqoriyalar" className={cn('scroll-mt-24', className)}>
      <h2 className="sr-only">Kateqoriyalar</h2>
      {/* overscroll-x-contain: a swipe past the row's start must not become the browser's back gesture. */}
      <ul className="scrollbar-none flex snap-x scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 sm:flex-wrap sm:justify-center sm:overflow-visible md:px-7 lg:px-0">
        {items.map((c, i) => {
          const on = c.id === selected
          return (
            // Fades up after the search card, 30 ms apart.
            <li key={c.id} style={{ animationDelay: `${120 + i * 30}ms` }} className="max-w-full shrink-0 animate-fade-up snap-start motion-reduce:animate-none">
              <Link
                href={categoryHref(c)}
                aria-label={`${c.name}, ${formatNumber(c.listingCount)} elan`}
                className={cn(
                  'flex h-12 max-w-full items-center gap-2.5 rounded-full border pr-2 pl-1.5 backdrop-blur-sm transition-[background-color,border-color,scale] duration-(--dur-fast) ease-out hover:bg-surface/20 focus-visible:outline-mint active:scale-[0.97] motion-reduce:active:scale-100',
                  on ? 'border-mint bg-surface/20' : 'border-surface/22 bg-surface/12',
                )}
              >
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-forest">
                  <CategoryIcon name={c.icon} size={18} className="shrink-0" />
                </span>{' '}
                {/* Real names fit; an absurdly long one is cut with an ellipsis rather than widening the row. */}
                <span title={c.name} className="min-w-0 truncate text-[15px] leading-5 font-semibold text-white">
                  {c.name}
                </span>{' '}
                {/* The spaces keep the visible text «Ağaclar 16» inside the name «Ağaclar, 16 elan» (WCAG 2.5.3). */}
                <span aria-hidden className="shrink-0 rounded-full bg-mint px-2.5 py-0.5 text-[12.5px] leading-4 font-semibold text-forest tabular-nums">
                  {formatNumber(c.listingCount)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
