'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextField } from '@/components/ui/Field'
import { categoryById } from '@/data/categories'
import { formatNumber } from '@/lib/format'
import type { ListingSort } from '@/services/marketplace'
import { FilterPanel } from './FilterPanel'
import { FilterSheet } from './FilterSheet'
import { ActiveFilterChips, SortSelect, ViewToggle } from './SearchControls'
import {
  activeChips,
  activeFilterCount,
  emptySearchState,
  parseSearchState,
  parseSort,
  resultCountLabel,
  withSort,
  withView,
  writeSearchState,
  type FilterChip,
  type SearchState,
  type SearchView,
} from './searchState'

interface SearchShellProps {
  /** Every filter of the page as a query string (for a category page this includes its `kateqoriya` / `seher`). */
  stateQuery: string
  /** Path that sort, view and page changes stay on ("/elanlar" or "/kateqoriyalar/…"). */
  basePath: string
  /** The query string actually in the address bar on `basePath`. */
  urlQuery: string
  /** Total matches across all pages. */
  total: number
  /** Breadcrumb and page heading (server-rendered). */
  header: ReactNode
  /** The server-rendered result list for the current page; ignored when `total` is 0. */
  results: ReactNode
  /** Crawlable pagination (server-rendered links), shown under the results. */
  pagination?: ReactNode
}

/**
 * Interactive frame of the product catalogue — Figma "Məhsul axtarışı · 1440" (sidebar filters ≥ 1280 px) and
 * "Mobil filtr paneli · 390" (bottom sheet below 1280 px). Results are rendered on the server and passed in;
 * every control navigates to a new URL, so filter state stays in the query string (shareable, reloadable).
 * Filter changes go to /elanlar; sort and view changes stay on the current page.
 */
export function SearchShell({ stateQuery, basePath, urlQuery, total, header, results, pagination }: SearchShellProps) {
  const router = useRouter()
  const params = useMemo(() => new URLSearchParams(stateQuery), [stateQuery])
  const state = useMemo(() => parseSearchState(params), [params])
  const sort = parseSort(params.get('siralama'))
  const view: SearchView = params.get('gorunus') === 'siyahi' ? 'list' : 'grid'

  // "Elanlarda axtarış" is edited locally and applied on Enter (or together with the filter panel);
  // it re-syncs whenever the URL query changes from elsewhere (header search, chips, "Hamısını təmizlə").
  const [qInput, setQInput] = useState(state.q)
  const [syncedQ, setSyncedQ] = useState(state.q)
  if (state.q !== syncedQ) {
    setSyncedQ(state.q)
    setQInput(state.q)
  }

  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  // The sheet only exists below 1280 px; close it if the viewport grows into the sidebar layout.
  useEffect(() => {
    if (!sheetOpen) return
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = () => mq.matches && setSheetOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [sheetOpen])

  const go = useCallback((path: string, next: URLSearchParams) => router.push(next.size ? `${path}?${next}` : path, { scroll: false }), [router])
  const commit = useCallback((next: SearchState) => go('/elanlar', writeSearchState(next, params)), [go, params])
  const clearAll = useCallback(() => commit(emptySearchState), [commit])
  const setSort = (next: ListingSort) => {
    const updated = withSort(new URLSearchParams(urlQuery), next)
    updated.delete('sehife')
    go(basePath, updated)
  }
  const setView = (next: SearchView) => go(basePath, withView(new URLSearchParams(urlQuery), next))

  const submitQuery = (e: FormEvent) => {
    e.preventDefault()
    commit({ ...state, q: qInput.trim() })
  }

  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  const chips = activeChips(state)
  const filterCount = activeFilterCount(state)

  const panelProps = {
    applied: state,
    q: qInput,
    onApply: (next: SearchState) => {
      commit(next)
      setSheetOpen(false)
    },
    onClear: () => {
      clearAll()
      setSheetOpen(false)
    },
  }

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 pt-5 pb-9 md:gap-7 md:pt-7 xl:pt-[51px]">
      {header}

      <form role="search" onSubmit={submitQuery} className="w-full">
        <TextField
          label="Elanlarda axtarış"
          type="search"
          enterKeyHint="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder={category ? category.name : 'Məsələn, zeytun ağacı'}
        />
      </form>

      <div className="flex w-full items-start gap-7">
        {/* Desktop sidebar ("Filtr yan paneli", 276 px) */}
        <aside aria-label="Filtrlər" className="hidden w-[276px] shrink-0 xl:block">
          <FilterPanel key={stateQuery} {...panelProps} />
        </aside>

        <section id="axtaris-neticeleri" aria-label="Axtarış nəticələri" className="flex min-w-0 flex-1 scroll-mt-28 flex-col items-start gap-5">
          {/* < 1280 px: "Filtrlər" opens the bottom sheet */}
          <div className="flex w-full items-start gap-2.5 xl:hidden">
            <Button
              variant="secondary"
              className="flex-1 md:flex-none"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              icon={<SlidersHorizontal aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
            >
              {filterCount ? `Filtrlər · ${filterCount}` : 'Filtrlər'}
            </Button>
            <SortSelect value={sort} onChange={setSort} className="md:ml-auto" />
          </div>

          <ActiveFilterChips chips={chips} showClearAll={filterCount > 0} onRemove={(chip: FilterChip) => commit(chip.without)} onClearAll={clearAll} />

          <div className="flex w-full items-start gap-4">
            <p className="shrink-0 text-sm leading-[1.5] text-ink" aria-live="polite">
              {resultCountLabel(total, state)}
            </p>
            <ViewToggle view={view} onChange={setView} />
            <SortSelect value={sort} onChange={setSort} className="ml-auto hidden xl:block" />
          </div>

          {total === 0 ? (
            <EmptyState
              icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
              title="Uyğun elan tapılmadı"
              description="Filtrləri dəyişin və ya başqa açar söz sınayın."
              action={
                <Button fullWidth onClick={clearAll}>
                  Filtrləri təmizlə
                </Button>
              }
            />
          ) : (
            results
          )}

          {total > 0 && pagination}

          {total > 0 && (
            <div className="w-full rounded-lg bg-mint p-[18px] text-ink" role="note">
              <p className="text-sm leading-[1.6] font-semibold">Daha çox seçim axtarırsınız?</p>
              <p className="text-[13px] leading-[1.6]">Şəhər və qiymət filtrlərini dəyişərək digər satıcıların təkliflərinə baxa bilərsiniz.</p>
            </div>
          )}
        </section>
      </div>

      <FilterSheet open={sheetOpen} onClose={closeSheet} summary={`${category?.name ?? 'Məhsullar'} · ${formatNumber(total)} axtarış nəticəsi`}>
        <FilterPanel key={stateQuery} {...panelProps} className="w-full" />
      </FilterSheet>
    </div>
  )
}
