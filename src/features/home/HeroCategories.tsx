import Link from 'next/link'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { cn, formatNumber } from '@/lib/format'
import { categoryHref } from '@/seo/catalog'
import type { Category } from '@/types'

/**
 * Variant 2 categories row, compacted in November 2026 so the listings start higher: a 44 px white circle with the
 * category icon and, beside it, the name over the listing count, so the whole row is one 48 px line. From lg the
 * five items are a centred group; narrower, they keep their width and the row scrolls sideways from screen edge to
 * screen edge (the last item cut off at the edge shows there is more); while the hero's pause button is shown
 * (HeroStage, not under reduced motion) the scroller stops short of it. The row sits on the hero photo: white circles
 * with forest icons, white names, mint counts, white focus outlines. `selected` mirrors the Kateqoriya filter of the
 * search card (forest circle with a white edge and icon). `#kateqoriyalar` is the target of the menu link
 * "Kateqoriyalar". `items` are the product categories with their counts (heroCounts.ts; the dev worst-case page
 * passes its own).
 */
export function HeroCategories({ items, selected, className }: { items: Category[]; selected?: string; className?: string }) {
  return (
    <div id="kateqoriyalar" className={cn('scroll-mt-24', className)}>
      <h2 className="sr-only">Kateqoriyalar</h2>
      {/* relative: the visually hidden " elan" labels are absolutely positioned and must be clipped by this scroller. */}
      {/* overscroll-x-contain: a swipe past the row's start must not become the browser's back gesture. */}
      {/* justify-center-safe: centred while the row fits, start-aligned (so nothing is cut off) when it scrolls. */}
      {/* Phones / tablets: the button is 44 px at the content's right edge, so the scroller ends 8 px before it
          (gutter 20 / 28 px + 44 + 8). */}
      <ul className="scrollbar-none relative flex justify-center-safe gap-1 overflow-x-auto overscroll-x-contain px-5 motion-safe:max-md:mr-[72px] md:gap-2 md:px-7 motion-safe:md:max-lg:mr-20 lg:gap-5 lg:overflow-visible lg:px-0">
        {items.map((c, i) => {
          const on = c.id === selected
          return (
            // Fades up after the search card, 30 ms apart.
            <li key={c.id} style={{ animationDelay: `${120 + i * 30}ms` }} className="shrink-0 animate-fade-up motion-reduce:animate-none">
              {/* The pill around circle and text is the 48 px target and the focus outline. */}
              <Link href={categoryHref(c)} className="group flex h-12 items-center gap-2.5 rounded-full py-0.5 pr-3 pl-0.5 focus-visible:outline-white">
                <span
                  aria-hidden
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full border transition-[translate,scale,border-color,background-color,color] duration-(--dur-fast)',
                    'motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5 motion-safe:group-active:scale-[0.96]',
                    on ? 'border-white bg-forest text-white' : 'border-line-strong bg-surface text-forest group-hover:border-forest group-focus-visible:border-forest',
                  )}
                >
                  <CategoryIcon name={c.icon} size={20} className="shrink-0" />
                </span>{' '}
                <span className="flex max-w-40 min-w-0 flex-col gap-px">
                  {/* Real names fit one line. A long single word breaks inside the 160 px column instead of widening
                      the item; `title` shows a clamped name in full on hover. */}
                  <span
                    title={c.name}
                    className="line-clamp-2 text-[13px] leading-[1.25] font-semibold wrap-anywhere hyphens-auto text-white lg:text-sm"
                  >
                    {c.name}
                  </span>{' '}
                  <span className="text-xs leading-[1.3] text-mint tabular-nums">
                    {formatNumber(c.listingCount)}
                    <span className="sr-only"> elan</span>
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
