import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categoryById } from '@/data/categories'
import { parseWorstCaseMode, worstCaseModes, type WorstCaseMode } from '@/dev/worstCase'
import { worstDraft, worstListing, worstRows, worstSeller, worstServices } from '@/dev/worstPages'
import { WorstCaseDraftCard, WorstCaseRows } from '@/dev/WorstCaseRows'
import { cn } from '@/lib/format'
import type { RawSearchParams } from '@/lib/searchParams'
import { getRepository } from '@/services/repository'
import { ListingDetail } from '@/views/ListingDetailPage'
import SellerPage from '@/views/SellerPage'

export const metadata: Metadata = { title: 'Ən pis hal: səhifələr (dev)', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<RawSearchParams> }

const views = [
  { value: 'elan', label: 'Elan' },
  { value: 'satici', label: 'Satıcı' },
  { value: 'kabinet', label: 'Kabinet' },
  { value: 'onizleme', label: 'Önizləmə' },
] as const
type View = (typeof views)[number]['value']

const DEMO_LISTING = 'zeytun-agaci-olea-europaea'
const DEMO_SELLER = 'abseron-tingcilik'

/**
 * /dev/worst-case/sehifeler — development tool (break-ui, Nov 2026): the listing page, the seller page, the cabinet
 * rows and the posting previews (the aside card and the review step's page) rendered with demo data and with the
 * worst realistic data (src/dev/worstPages.ts), switched with `?view=` and `?data=`. Production builds answer 404.
 */
export default async function Page({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production') notFound()
  const params = await searchParams
  const mode = parseWorstCaseMode(params.data)
  const view: View = views.some((v) => v.value === params.view) ? (params.view as View) : 'elan'
  const repo = getRepository()
  const now = Date.parse('2026-11-07T10:00:00Z')

  let body
  if (view === 'elan' || view === 'onizleme') {
    const demo = (await repo.getPublicListing(DEMO_LISTING))!
    const listing = worstListing(demo, mode)
    const demoSeller = (await repo.getSellerById(demo.sellerId!))!
    const seller = mode === 'empty' ? undefined : worstSeller(demoSeller, mode)
    const related = await repo.getRelatedListings(demo)
    body =
      view === 'elan' ? (
        <ListingDetail listing={listing} seller={seller} category={categoryById(listing.categoryId)} others={mode === 'empty' ? [] : related.fromSeller} similar={mode === 'empty' ? [] : related.similar} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-3">
            <h2 className="text-sm font-semibold text-forest">Kart (addım 1–5)</h2>
            <WorstCaseDraftCard draft={worstDraft(mode)} />
            <h2 className="pt-4 text-sm font-semibold text-forest">Yoxla və göndər (addım 6)</h2>
          </div>
          <ListingDetail listing={listing} seller={seller} category={categoryById(listing.categoryId)} others={[]} similar={[]} mode="preview" />
        </div>
      )
  } else if (view === 'satici') {
    const demo = (await repo.getSeller(DEMO_SELLER))!
    const all = await repo.listServices()
    const own = all.filter((s) => demo.serviceIds?.includes(s.id) || s.providerId === demo.id)
    body = <SellerPage seller={worstSeller(demo, mode)} listingQuery="" services={worstServices(all, own, mode)} />
  } else {
    const own = await repo.listOwnListings(DEMO_SELLER)
    body = (
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-3 pt-6">
        <WorstCaseRows rows={worstRows(own, mode, now)} draft={mode === 'worst' ? { ...worstDraft(mode), title: '', reachedStep: 3 } : undefined} now={now} />
      </div>
    )
  }

  const href = (next: { view?: View; data?: WorstCaseMode }) => `?view=${next.view ?? view}&data=${next.data ?? mode}`
  return (
    <>
      <div className="pb-40">{body}</div>
      {/* Dev chrome, not part of the design under test: plain, fixed above the bottom nav. */}
      <nav
        aria-label="Məlumat"
        className="fixed bottom-[calc(100px+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-1 rounded-2xl bg-disabled p-1 shadow-popover md:bottom-6"
      >
        {[views.map((v) => ({ key: v.value, label: v.label, href: href({ view: v.value }), on: v.value === view })), worstCaseModes.map((m) => ({ key: m.value, label: m.label, href: href({ data: m.value }), on: m.value === mode }))].map((row, i) => (
          <div key={i} className="flex gap-1">
            {row.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-current={item.on ? 'page' : undefined}
                className={cn('rounded-full px-3 py-1.5 text-[13px] leading-[normal] whitespace-nowrap', item.on ? 'bg-surface font-semibold text-ink' : 'text-muted hover:text-ink')}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  )
}
