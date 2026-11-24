import Link from 'next/link'
import { formatNumber, cn } from '@/lib/format'
import type { AdminOverview } from '@/types'

interface Tile {
  title: string
  value: number
  /** What the number is («gözləyən elan») */
  unit: string
  details: string[]
  href?: string
}

/** The overview's tiles, worded (pure, so the words are tested). */
export function overviewTiles(o: AdminOverview, admin: boolean): Tile[] {
  return [
    {
      title: 'Moderasiya',
      value: o.moderation.pending,
      unit: 'gözləyən elan',
      details: [`${formatNumber(o.moderation.recheck)} təkrar yoxlama`, `${formatNumber(o.moderation.rejected)} rədd edilib`],
      href: '/idareetme/moderasiya',
    },
    {
      title: 'Şikayətlər',
      value: o.reports.open,
      unit: 'açıq şikayət',
      details: [`${formatNumber(o.reports.investigating)} araşdırılır`, `${formatNumber(o.reports.resolved)} həll olunub`],
      href: '/idareetme/sikayetler',
    },
    {
      title: 'Elanlar',
      value: o.listings.active,
      unit: 'aktiv elan',
      details: [`${formatNumber(o.listings.pending)} yoxlamada`, `${formatNumber(o.listings.expired)} müddəti bitib`, `${formatNumber(o.listings.inactive)} deaktiv`],
    },
    {
      title: 'İstifadəçilər',
      value: o.users.total,
      unit: 'hesab',
      details: [
        `${formatNumber(o.users.business)} biznes`,
        `${formatNumber(o.users.individual)} fərdi`,
        `${formatNumber(o.users.newThisWeek)} bu həftə`,
        `${formatNumber(o.users.blocked)} bloklanıb`,
      ],
    },
    {
      title: 'Satıcılar',
      value: o.sellers.total,
      unit: 'mağaza',
      details: [`${formatNumber(o.sellers.verified)} təsdiqlənmiş`],
    },
    {
      title: 'Dəstək',
      value: o.support.new,
      unit: 'yeni müraciət',
      details: [`${formatNumber(o.support.answered)} cavablanıb`, `${formatNumber(o.support.closed)} bağlanıb`],
    },
    {
      title: 'Kateqoriyalar',
      value: o.categories.active,
      unit: 'aktiv kateqoriya',
      details: [`cəmi ${formatNumber(o.categories.total)}`, `${formatNumber(o.categories.subcategories)} alt kateqoriya`],
      href: admin ? '/idareetme/kateqoriyalar' : undefined,
    },
  ]
}

/**
 * /idareetme with DATA_SOURCE=api: the numbers of every section (`GET /admin/overview`), a section's tile linking to
 * it.
 */
export function AdminOverviewPanel({ overview, admin }: { overview: AdminOverview; admin: boolean }) {
  return (
    <section aria-labelledby="overview-title" className="flex w-full flex-col gap-3">
      <h2 id="overview-title" className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest">
        İcmal
      </h2>
      <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overviewTiles(overview, admin).map((tile) => {
          const body = (
            <>
              <span className="text-[13px] leading-[1.4] font-semibold text-ink-soft">{tile.title}</span>
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-[26px] leading-[1.2] font-semibold text-forest tabular-nums">{formatNumber(tile.value)}</span>
                <span className="text-sm leading-[1.4] text-ink">{tile.unit}</span>
              </span>
              <span className="text-[13px] leading-[1.5] text-muted">{tile.details.join(' · ')}</span>
            </>
          )
          const box = 'flex h-full w-full flex-col items-start gap-1 rounded-[10px] border border-line bg-surface p-4'
          return (
            <li key={tile.title}>
              {tile.href ? (
                <Link href={tile.href} className={cn(box, 'transition-colors duration-(--dur-fast) hover:border-olive')}>
                  {body}
                </Link>
              ) : (
                <div className={box}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
