import Link from 'next/link'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { cn, formatNumber } from '@/lib/format'
import { categoryHref } from '@/seo/catalog'
import type { Category } from '@/types'

/**
 * Variant 2 categories row: a 48 px white circle with the category icon, the name (two lines reserved so the counts
 * line up) and the listing count. Five categories since November 2026, so the row is a centred group of equal items
 * rather than a stretched grid: on phones the five share the width (64–96 px each, scrolling sideways only below
 * ≈ 350 px), from lg they are 136 px wide. `selected` mirrors the Kateqoriya filter of the search card (forest
 * circle, white icon). `#kateqoriyalar` is the target of the menu link "Kateqoriyalar". `items` are the product
 * categories with their counts (heroCounts.ts; the dev worst-case page passes its own).
 */
export function HeroCategories({ items, selected, className }: { items: Category[]; selected?: string; className?: string }) {
  return (
    <div id="kateqoriyalar" className={cn('scroll-mt-24', className)}>
      <h2 className="sr-only">Kateqoriyalar</h2>
      {/* relative: the visually hidden " elan" labels are absolutely positioned and must be clipped by this scroller. */}
      {/* overscroll-x-contain: a swipe past the row's start must not become the browser's back gesture. */}
      {/* justify-center-safe: centred while the row fits, start-aligned (so nothing is cut off) when it scrolls. */}
      <ul className="scrollbar-none relative flex justify-center-safe gap-1 overflow-x-auto overscroll-x-contain px-2.5 md:gap-2 md:px-5 lg:gap-3 lg:overflow-visible lg:px-0">
        {items.map((c, i) => {
          const on = c.id === selected
          return (
            // Fades up after the search card, 30 ms apart.
            <li
              key={c.id}
              style={{ animationDelay: `${120 + i * 30}ms` }}
              className="flex max-w-24 min-w-16 flex-1 animate-fade-up motion-reduce:animate-none lg:w-[136px] lg:max-w-none lg:flex-none"
            >
              <Link href={categoryHref(c)} className="group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-option p-0.5 lg:gap-2 lg:p-1">
                <span
                  aria-hidden
                  className={cn(
                    'flex size-12 items-center justify-center rounded-full border transition-[translate,scale,border-color,background-color,color] duration-(--dur-fast)',
                    'motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5 motion-safe:group-active:scale-[0.96]',
                    on ? 'border-forest bg-forest text-white' : 'border-line-strong bg-surface text-forest group-hover:border-forest group-focus-visible:border-forest',
                  )}
                >
                  <CategoryIcon name={c.icon} size={20} className="shrink-0" />
                </span>{' '}
                {/* A long single word breaks inside a narrow item instead of running into its neighbours;
                    `title` shows a clamped name in full on hover. */}
                <span
                  title={c.name}
                  className="line-clamp-2 min-h-[34px] w-full text-center text-xs leading-[1.4] font-semibold wrap-anywhere hyphens-auto text-forest lg:min-h-[38px] lg:text-sm lg:leading-[1.35]"
                >
                  {c.name}
                </span>{' '}
                <span className="text-xs leading-[normal] text-muted tabular-nums lg:text-[13px]">
                  {formatNumber(c.listingCount)}
                  <span className="sr-only"> elan</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
