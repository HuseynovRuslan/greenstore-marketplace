import Link from 'next/link'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { categories } from '@/data/categories'
import { cn, formatNumber } from '@/lib/format'

/** Product categories open their own page; the services umbrella opens the services catalogue. */
const categoryHref = (c: (typeof categories)[number]) => (c.kind === 'service' ? '/xidmetler' : `/kateqoriyalar/${c.slug}`)

/**
 * Variant 2 categories row: a 48 px white circle with the category icon, the name (two lines reserved so the counts
 * line up) and the listing count. Phones and tablets scroll it sideways with 78 px items.
 * `selected` mirrors the Kateqoriya filter of the search card (forest circle, white icon).
 */
export function HeroCategories({ selected, className }: { selected?: string; className?: string }) {
  return (
    // relative: the visually hidden " elan" labels are absolutely positioned and must be clipped by this scroller.
    <ul className={cn('scrollbar-none relative flex gap-1 overflow-x-auto', className)}>
      {categories.map((c) => {
        const on = c.id === selected
        return (
          <li key={c.id} className="flex w-[78px] shrink-0">
            <Link href={categoryHref(c)} className="group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-option p-0.5">
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
              <span className="line-clamp-2 min-h-[34px] text-center text-xs leading-[1.4] font-semibold text-forest">{c.name}</span>{' '}
              <span className="text-xs leading-[normal] text-muted tabular-nums">
                {formatNumber(c.listingCount)}
                <span className="sr-only"> elan</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
