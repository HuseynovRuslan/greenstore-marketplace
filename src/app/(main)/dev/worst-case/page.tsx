import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListingCard } from '@/components/cards/ListingCard'
import { WorstCaseChips } from '@/dev/WorstCaseChips'
import { demoSearch, oneSearch, parseWorstCaseMode, worstCaseCategories, worstCaseListings, worstCaseModes, worstCaseSearch, type WorstCaseMode } from '@/dev/worstCase'
import { HeroCategories } from '@/features/home/HeroCategories'
import { ListingRow } from '@/features/search/ListingRow'
import { activeChips, resultCountLabel } from '@/features/search/searchState'
import { emptySearchState } from '@/features/search/searchUrl'
import { cn } from '@/lib/format'
import type { RawSearchParams } from '@/lib/searchParams'
import { getRepository } from '@/services/repository'

export const metadata: Metadata = { title: 'Ən pis hal (dev)', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<RawSearchParams> }

const searchFor: Record<WorstCaseMode, typeof emptySearchState> = { worst: worstCaseSearch, demo: demoSearch, one: oneSearch, empty: emptySearchState }

/**
 * /dev/worst-case — a development tool (break-ui): the listing card, the list row, the active-filter chips and the
 * categories row with the demo data and with the worst realistic data, switched with `?data=` (Demo / Ən pis hal /
 * Boş / Bir). Production builds answer 404, and the sitemap never lists it.
 */
export default async function Page({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const mode = parseWorstCaseMode((await searchParams).data)
  const repo = getRepository()
  const [{ latest }, categories] = await Promise.all([repo.getHomeContent(), repo.listProductCategories()])
  const listings = { worst: worstCaseListings(latest), demo: latest.slice(0, 6), one: latest.slice(0, 1), empty: [] }[mode]
  const categoryItems = { worst: worstCaseCategories(categories), demo: categories, one: categories.slice(0, 1), empty: [] }[mode]

  return (
    <>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-8 pt-6 pb-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] leading-[1.25] font-semibold text-forest md:text-[28px]">Ən pis hal</h1>
          <p className="text-sm leading-[1.5] text-muted">
            Yalnız inkişaf rejimində (production-da 404). {resultCountLabel(listings.length)} · kateqoriya: {categoryItems.length}
          </p>
        </div>

        <section aria-labelledby="wc-cards" className="flex flex-col gap-3">
          <h2 id="wc-cards" className="text-sm leading-[normal] font-semibold text-forest">
            Kartlar
          </h2>
          {listings.length ? (
            <ul className="grid w-full max-w-[1056px] grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {listings.map((listing) => (
                <li key={listing.id} className="flex">
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Elan yoxdur.</p>
          )}
        </section>

        <section aria-labelledby="wc-rows" className="flex flex-col gap-3">
          <h2 id="wc-rows" className="text-sm leading-[normal] font-semibold text-forest">
            Siyahı
          </h2>
          {listings.length ? (
            <ul className="flex w-full max-w-[1056px] flex-col gap-3 md:gap-5">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <ListingRow listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Elan yoxdur.</p>
          )}
        </section>

        <WorstCaseChips key={mode} chips={activeChips(searchFor[mode])} />
      </div>

      {/* The categories row on the hero's mint, with the hero's own bleed. */}
      <div className="w-full bg-mint pt-2 pb-32 md:pb-24">
        <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col">
          <HeroCategories items={categoryItems} className="-mx-5 border-t border-line pt-4 md:-mx-7 lg:mx-0 lg:pt-[22px]" />
        </div>
      </div>

      {/* Dev chrome, not part of the design under test: plain, fixed above the bottom nav. */}
      <nav
        aria-label="Məlumat"
        className="fixed bottom-[calc(100px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full bg-disabled p-1 shadow-popover md:bottom-6"
      >
        {worstCaseModes.map((m) => (
          <Link
            key={m.value}
            href={`?data=${m.value}`}
            aria-current={m.value === mode ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-2 text-sm leading-[normal] whitespace-nowrap',
              m.value === mode ? 'bg-surface font-semibold text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {m.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
