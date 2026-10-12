import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { ListingCard } from '@/components/cards/ListingCard'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { TextField } from '@/components/ui/Field'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { categoryById } from '@/data/categories'
import { formatNumber } from '@/lib/format'
import type { ListingSort } from '@/services/marketplace'
import { FilterPanel } from '@/features/search/FilterPanel'
import { FilterSheet } from '@/features/search/FilterSheet'
import { ListingRow } from '@/features/search/ListingRow'
import { ActiveFilterChips, SortSelect, ViewToggle } from '@/features/search/SearchControls'
import { subcategoryName } from '@/features/search/taxonomy'
import {
  activeChips,
  activeFilterCount,
  emptySearchState,
  parseSearchState,
  parseSort,
  resultCountLabel,
  resultSummary,
  runSearch,
  searchHeading,
  withSort,
  withView,
  writeSearchState,
  type FilterChip,
  type SearchState,
  type SearchView,
} from '@/features/search/searchState'

/**
 * "/elanlar" — Figma "Məhsul axtarışı · 1440" (sidebar filters ≥ 1280 px) and
 * "Mobil filtr paneli · 390" (bottom-sheet filters below 1280 px). All filter state lives in the query string.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const search = params.toString()
  const state = useMemo(() => parseSearchState(new URLSearchParams(search)), [search])
  const sort = parseSort(params.get('siralama'))
  const view: SearchView = params.get('gorunus') === 'siyahi' ? 'list' : 'grid'
  const results = useMemo(() => runSearch(state, sort), [state, sort])

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

  const commit = useCallback((next: SearchState) => setParams((prev) => writeSearchState(next, prev)), [setParams])
  const clearAll = useCallback(() => commit(emptySearchState), [commit])
  const setSort = (next: ListingSort) => setParams((prev) => withSort(prev, next))
  const setView = (next: SearchView) => setParams((prev) => withView(prev, next))

  const submitQuery = (e: FormEvent) => {
    e.preventDefault()
    commit({ ...state, q: qInput.trim() })
  }

  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  const subcategory = category && state.subcategory ? subcategoryName(category.id, state.subcategory) : undefined
  const chips = activeChips(state)
  const filterCount = activeFilterCount(state)
  const heading = searchHeading(state)

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

  const crumbs: Array<{ label: string; to?: string }> = [
    { label: 'Ana səhifə', to: '/' },
    { label: 'Məhsullar', to: category ? '/elanlar' : undefined },
  ]
  if (category) crumbs.push({ label: category.name, to: subcategory ? `/elanlar?kateqoriya=${category.id}` : undefined })
  if (subcategory) crumbs.push({ label: subcategory })

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-6 pt-5 pb-9 md:gap-7 md:pt-7 xl:pt-[51px]">
      <nav aria-label="Naviqasiya zənciri" className="w-full text-xs leading-[1.5] text-muted">
        <ol className="flex flex-wrap items-center">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center whitespace-pre">
              {i > 0 && <span aria-hidden> / </span>}
              {c.to ? (
                <Link to={c.to} className="hover:text-forest">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <SectionHeader as="h1" title={heading} subtitle={resultSummary(results.length)} />

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
          <FilterPanel key={search} {...panelProps} />
        </aside>

        <section aria-label="Axtarış nəticələri" className="flex min-w-0 flex-1 flex-col items-start gap-5">
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

          <ActiveFilterChips
            chips={chips}
            showClearAll={filterCount > 0}
            onRemove={(chip: FilterChip) => commit(chip.without)}
            onClearAll={clearAll}
          />

          <div className="flex w-full items-start gap-4">
            <p className="shrink-0 text-sm leading-[1.5] text-ink" aria-live="polite">
              {resultCountLabel(results.length, state)}
            </p>
            <ViewToggle view={view} onChange={setView} />
            <SortSelect value={sort} onChange={setSort} className="ml-auto hidden xl:block" />
          </div>

          {results.length === 0 ? (
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
          ) : view === 'grid' ? (
            <ul className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {results.map((listing) => (
                <li key={listing.id} className="flex">
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex w-full flex-col gap-3 md:gap-5">
              {results.map((listing) => (
                <li key={listing.id}>
                  <ListingRow listing={listing} />
                </li>
              ))}
            </ul>
          )}

          {results.length > 0 && (
            <div className="w-full rounded-lg bg-mint p-[18px] text-ink" role="note">
              <p className="text-sm leading-[1.6] font-semibold">Daha çox seçim axtarırsınız?</p>
              <p className="text-[13px] leading-[1.6]">Şəhər və qiymət filtrlərini dəyişərək digər satıcıların təkliflərinə baxa bilərsiniz.</p>
            </div>
          )}
        </section>
      </div>

      <FilterSheet open={sheetOpen} onClose={closeSheet} summary={`${category?.name ?? 'Məhsullar'} · ${formatNumber(results.length)} axtarış nəticəsi`}>
        <FilterPanel key={search} {...panelProps} className="w-full" />
      </FilterSheet>
    </div>
  )
}
