import { useId, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowDownUp, ChevronRight, Search } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextField } from '@/components/ui/Field'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { categoryById } from '@/data/categories'
import { cn } from '@/lib/format'
import { listingSortOptions, type ListingSort } from '@/services/marketplace'
import type { Seller } from '@/types'
import { wideCardImages, withCardImage } from '@/features/listing/cardImages'
import { paginate, sellerListings } from './sellerListings'
import { sellerStatsFor, type SellerTabStat } from './sellerStats'

const icon = { size: 18, strokeWidth: 1.8, absoluteStrokeWidth: true, 'aria-hidden': true } as const

/**
 * Figma "Satıcının aktiv elanları": category tabs, in-seller search, sort, 3-column grid (6 per page), pagination.
 * State lives in the URL: ?kateqoriya= · q= · siralama= · sehife=
 */
export function SellerListings({ seller }: { seller: Seller }) {
  const [params, setParams] = useSearchParams()
  const sectionRef = useRef<HTMLElement>(null)
  const panelId = useId()
  const stats = sellerStatsFor(seller.id)
  const available = sellerListings(seller.id)

  // Tabs: the seller's stated totals when known (Figma), otherwise counted from the listings in the data.
  const categoryTabs: SellerTabStat[] =
    stats?.tabs ??
    Array.from(new Set(available.map((l) => l.categoryId))).map((id) => ({
      categoryId: id,
      label: categoryById(id)?.name ?? id,
      count: available.filter((l) => l.categoryId === id).length,
    }))
  const total = stats?.total ?? seller.activeListings
  const tabs: SellerTabStat[] = [{ label: 'Hamısı', count: stats?.total ?? available.length }, ...categoryTabs]

  const rawCategory = params.get('kateqoriya') ?? undefined
  const categoryId = categoryTabs.some((t) => t.categoryId === rawCategory) ? rawCategory : undefined
  const q = params.get('q') ?? ''
  const rawSort = params.get('siralama')
  const sort: ListingSort = listingSortOptions.find((o) => o.value === rawSort)?.value ?? 'newest'
  const requestedPage = Math.floor(Number(params.get('sehife') ?? '1')) || 1

  const results = sellerListings(seller.id, { categoryId, q, sort })
  const { page, pageCount, items } = paginate(results, requestedPage)

  const update = (patch: Record<string, string | undefined>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!keepPage) next.delete('sehife')
    setParams(next, { replace: true, preventScrollReset: true })
  }

  const goToPage = (p: number) => {
    update({ sehife: p > 1 ? String(p) : undefined }, true)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearFilters = () => update({ kateqoriya: undefined, q: undefined })

  return (
    <section ref={sectionRef} aria-labelledby={`${panelId}-title`} className="flex w-full scroll-mt-24 flex-col items-start gap-7">
      <SectionHeader
        title={<span id={`${panelId}-title`}>Satıcının aktiv elanları</span>}
        subtitle={`${total} elan · yalnız hazırda satışda olan təkliflər`}
      />

      {available.length === 0 ? (
        <EmptyState
          icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
          title="Uyğun elan tapılmadı"
          description="Bu satıcının elanları hazırda göstərilmir."
          action={
            <ButtonLink to="/elanlar" fullWidth>
              Elanlara bax
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div role="tablist" aria-label="Elan kateqoriyaları" className="scrollbar-none -mx-5 flex w-[calc(100%+40px)] items-start gap-2 overflow-x-auto px-5 md:mx-0 md:w-full md:flex-wrap md:px-0">
            {tabs.map((t) => {
              const active = t.categoryId === categoryId
              return (
                <button
                  key={t.label}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  aria-controls={panelId}
                  onClick={() => update({ kateqoriya: t.categoryId })}
                  className={cn(
                    'min-h-11 shrink-0 rounded-lg p-3 text-[13px] leading-[normal] whitespace-nowrap text-forest transition-colors',
                    active ? 'bg-forest font-semibold text-white' : 'bg-mint hover:bg-[#dfe8de]',
                  )}
                >
                  {t.label} · {t.count}
                </button>
              )
            })}
          </div>

          <div className="flex w-full items-end gap-3 md:items-start" role="search">
            <TextField
              containerClassName="min-w-0 flex-1"
              type="search"
              label="Satıcının elanlarında axtar"
              placeholder="Bitki və ya məhsul adı"
              value={q}
              onChange={(e) => update({ q: e.target.value || undefined })}
            />
            <SortSelect value={sort} onChange={(value) => update({ siralama: value === 'newest' ? undefined : value })} />
          </div>

          <div id={panelId} role="tabpanel" className="w-full">
            {items.length > 0 ? (
              <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                {items.map((l) => (
                  <ListingCard key={l.id} listing={withCardImage(l, wideCardImages)} />
                ))}
              </div>
            ) : (
              <div className="flex w-full justify-center">
                <EmptyState
                  icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
                  title="Uyğun elan tapılmadı"
                  description="Filtrləri dəyişin və ya başqa açar söz sınayın."
                  action={
                    <Button fullWidth onClick={clearFilters}>
                      Filtrləri təmizlə
                    </Button>
                  }
                />
              </div>
            )}
          </div>

          {items.length > 0 && <Pagination page={page} pageCount={pageCount} onChange={goToPage} />}
        </>
      )}
    </section>
  )
}

/** Figma "Ən yenilər" button (arrow-down-up) — a native select layered over the button face. */
function SortSelect({ value, onChange }: { value: ListingSort; onChange: (value: ListingSort) => void }) {
  const id = useId()
  const current = listingSortOptions.find((o) => o.value === value) ?? listingSortOptions[0]
  return (
    <div className={buttonClass('secondary', 'relative focus-within:ring-[3px] focus-within:ring-olive focus-within:ring-inset')}>
      <ArrowDownUp {...icon} />
      <span aria-hidden>{current.label}</span>
      <label htmlFor={id} className="sr-only">
        Sıralama
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as ListingSort)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {listingSortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Figma "Səhifələmə": numbered buttons (current = primary) + "Növbəti". */
function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  return (
    <nav aria-label="Səhifələmə" className="flex w-full flex-wrap items-start justify-center gap-2">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Səhifə ${p}`}
          onClick={() => p !== page && onChange(p)}
          className={buttonClass(p === page ? 'primary' : 'secondary', 'min-w-[39px]')}
        >
          {p}
        </button>
      ))}
      <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className={buttonClass('secondary')}>
        <ChevronRight {...icon} />
        Növbəti
      </button>
    </nav>
  )
}
