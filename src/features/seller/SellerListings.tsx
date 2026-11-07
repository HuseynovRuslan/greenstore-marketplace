'use client'

import { useId, useRef, useState, type MouseEvent } from 'react'
import { ArrowDownUp, ChevronRight, Search } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { Button, ButtonLink, buttonClass } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Listbox } from '@/components/ui/Listbox'
import { optionClass } from '@/features/search/filterStyles'
import { categoryById } from '@/data/categories'
import { cn } from '@/lib/format'
import { listingSortOptions, type ListingSort } from '@/services/listingSort'
import type { Seller } from '@/types'
import { wideCardImages, withCardImage } from '@/features/listing/cardImages'
import { paginate, sellerListings } from './sellerListingQuery'
import { sellerStatsFor, type SellerTabStat } from './sellerStats'

const icon = { size: 18, strokeWidth: 1.8, absoluteStrokeWidth: true, 'aria-hidden': true } as const

/**
 * Figma "Satıcının aktiv elanları": category tabs, in-seller search, sort, 3-column grid (6 per page), pagination.
 * State lives in the URL: ?kateqoriya= · q= · siralama= · sehife=
 * The server page passes the query it rendered with; later changes update the address bar in place
 * (`history.replaceState`, which the App Router keeps in sync) without a server round trip per keystroke.
 */
export function SellerListings({ seller, initialQuery = '' }: { seller: Seller; initialQuery?: string }) {
  const [state, setState] = useState({ from: initialQuery, query: initialQuery })
  if (state.from !== initialQuery) setState({ from: initialQuery, query: initialQuery })
  const params = new URLSearchParams(state.query)
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
    const query = next.toString()
    setState((prev) => ({ ...prev, query }))
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname)
  }

  const pageHref = (p: number) => {
    const next = new URLSearchParams(params)
    if (p > 1) next.set('sehife', String(p))
    else next.delete('sehife')
    const query = next.toString()
    return query ? `?${query}` : `/saticilar/${seller.slug}`
  }

  const goToPage = (p: number) => {
    update({ sehife: p > 1 ? String(p) : undefined }, true)
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearFilters = () => update({ kateqoriya: undefined, q: undefined })

  return (
    <section ref={sectionRef} aria-labelledby={`${panelId}-title`} className="flex w-full scroll-mt-24 flex-col items-start gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id={`${panelId}-title`} className="text-lg leading-[1.3] font-semibold tracking-[-0.01em] text-forest md:text-[22px]">
          Elanlar
        </h2>
        <p className="text-sm leading-[normal] text-muted tabular-nums">{total} aktiv elan</p>
      </div>

      {available.length === 0 ? (
        <EmptyState
          icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
          title="Hazırda aktiv elan yoxdur"
          description="Satıcının yeni elanları burada görünəcək. Oxşar bitkiləri ümumi axtarışda tapa bilərsiniz."
          action={
            <ButtonLink href="/elanlar" fullWidth>
              Bütün elanlara bax
            </ButtonLink>
          }
        />
      ) : (
        <>
          <div role="group" aria-label="Kateqoriya" className="scrollbar-none -mx-5 flex w-[calc(100%+40px)] gap-2 overflow-x-auto px-5 md:mx-0 md:w-full md:flex-wrap md:px-0">
            {tabs.map((t) => {
              const active = t.categoryId === categoryId
              return (
                <button
                  key={t.label}
                  type="button"
                  aria-pressed={active}
                  aria-controls={panelId}
                  onClick={() => update({ kateqoriya: t.categoryId })}
                  className={cn(optionClass(active), 'inline-flex items-center gap-1.5 pointer-coarse:h-11')}
                >
                  {t.label}
                  <span className={cn('tabular-nums', active ? 'text-white/80' : 'text-muted')}>{t.count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center" role="search">
            <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 focus-within:border-olive focus-within:shadow-[inset_0_0_0_1px_var(--color-olive)]">
              <Search aria-hidden size={18} strokeWidth={1.8} className="shrink-0 text-muted" />
              <span className="sr-only">Satıcının elanlarında axtar</span>
              <input
                type="search"
                enterKeyHint="search"
                // Results update while typing; the return key just puts the keyboard away.
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder="Bu satıcının elanlarında axtar"
                value={q}
                maxLength={100}
                onChange={(e) => update({ q: e.target.value || undefined })}
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted pointer-coarse:text-base"
              />
            </label>
            <div className="h-12 shrink-0 rounded-lg border border-line bg-surface sm:w-[200px]">
              <Listbox
                label="Sıralama"
                className="h-full"
                align="end"
                value={sort}
                onChange={(value) => update({ siralama: value === 'newest' ? undefined : value })}
                options={listingSortOptions.map((o) => ({ value: o.value, label: o.label }))}
                icon={<ArrowDownUp aria-hidden size={16} strokeWidth={1.8} className="shrink-0 text-muted" />}
                triggerClassName="h-full text-sm"
              />
            </div>
          </div>

          <div id={panelId} className="w-full">
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

          {items.length > 0 && <Pagination page={page} pageCount={pageCount} hrefFor={pageHref} onChange={goToPage} />}
        </>
      )}
    </section>
  )
}

/**
 * Figma "Səhifələmə": numbered buttons (current = primary) + "Növbəti".
 * Rendered as real links (`?sehife=N`) so the pages are crawlable; clicks are handled in place.
 */
function Pagination({
  page,
  pageCount,
  hrefFor,
  onChange,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  onChange: (page: number) => void
}) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  const go = (p: number) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    if (p !== page) onChange(p)
  }
  return (
    <nav aria-label="Səhifələmə" className="flex w-full flex-wrap items-start justify-center gap-2">
      {pages.map((p) => (
        <a
          key={p}
          href={hrefFor(p)}
          aria-current={p === page ? 'page' : undefined}
          aria-label={`Səhifə ${p}`}
          onClick={go(p)}
          className={buttonClass(p === page ? 'primary' : 'secondary', 'min-w-[39px]')}
        >
          {p}
        </a>
      ))}
      {page >= pageCount ? (
        <button type="button" disabled className={buttonClass('secondary')}>
          <ChevronRight {...icon} />
          Növbəti
        </button>
      ) : (
        <a href={hrefFor(page + 1)} rel="next" onClick={go(page + 1)} className={buttonClass('secondary')}>
          <ChevronRight {...icon} />
          Növbəti
        </a>
      )}
    </nav>
  )
}
