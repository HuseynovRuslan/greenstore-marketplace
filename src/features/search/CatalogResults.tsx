'use client'

import { useEffect, useId, useMemo, useOptimistic, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatNumber } from '@/lib/format'
import type { ListingSort } from '@/services/marketplace'
import { CatalogSearchCard, type CityCounts } from './CatalogSearchCard'
import { FiltersButton } from './FilterControls'
import { FilterPanel } from './FilterPanel'
import { FilterSheet } from './FilterSheet'
import { FilterSidebar, type SidebarFacets } from './FilterSidebar'
import type { FilterOption } from './filterDefs'
import { ActiveFilterRow, SortSelect, ViewToggle } from './SearchControls'
import { catalogHref, chipActive, withoutFilters, withSort, withView, type FilterChip, type SearchState, type SearchView } from './searchUrl'
import { useStickySide } from './useStickySide'

export const RESULTS_ID = 'axtaris-neticeleri'

interface CatalogResultsProps {
  state: SearchState
  /** Every filter of the page as a query string (a category page includes its `kateqoriya` / `seher`). */
  stateQuery: string
  /** Path that sort, view and page changes stay on ("/elanlar" or "/kateqoriyalar/…"). */
  basePath: string
  /** The query string actually in the address bar on `basePath`. */
  urlQuery: string
  sort: ListingSort
  view: SearchView
  /** Total matches across all pages. */
  total: number
  heading: string
  /** Built on the server (their labels need the data). */
  chips: FilterChip[]
  facets: SidebarFacets & { cities: CityCounts }
  speciesOptions: FilterOption[]
  showPlantFilters: boolean
  breadcrumb: ReactNode
  /** The server-rendered result list for the current page; ignored when `total` is 0. */
  results: ReactNode
  /** Crawlable pagination (server-rendered links), shown under the results. */
  pagination?: ReactNode
}

/**
 * The product catalogue (/elanlar, /kateqoriyalar/*), Variant 2: breadcrumb, the search card, then the filter
 * sidebar (≥ 1280 px) beside the results: heading with the count, sort and view, the active filters, the list.
 * Results are rendered on the server; every control changes the URL inside a transition, so the old results stay
 * and dim (after 150 ms) while the new ones load, and the controls show the new choice at once (useOptimistic,
 * the pattern of Next's "interactive apps" guide). Filters and the search word add a history entry (Back undoes
 * them); sort and view replace it. Filter changes continue on /elanlar; sort and view stay on the current page.
 */
export function CatalogResults(props: CatalogResultsProps) {
  const { state, stateQuery, basePath, urlQuery, sort, view, total, heading, chips, facets, speciesOptions, showPlantFilters } = props
  const router = useRouter()
  const headingId = useId()
  const [isPending, startTransition] = useTransition()
  const [shown, setShown] = useOptimistic(state)
  const [shownSort, setShownSort] = useOptimistic(sort)
  const [shownView, setShownView] = useOptimistic(view)
  const current = useMemo(() => new URLSearchParams(stateQuery), [stateQuery])

  const apply = (next: SearchState) =>
    startTransition(() => {
      setShown(next)
      router.push(catalogHref(next, current), { scroll: false })
    })
  const stay = (next: URLSearchParams) => (next.size ? `${basePath}?${next}` : basePath)
  const changeSort = (next: ListingSort) =>
    startTransition(() => {
      setShownSort(next)
      const query = withSort(new URLSearchParams(urlQuery), next)
      query.delete('sehife')
      router.replace(stay(query), { scroll: false })
    })
  const changeView = (next: SearchView) =>
    startTransition(() => {
      setShownView(next)
      router.replace(stay(withView(new URLSearchParams(urlQuery), next)), { scroll: false })
    })

  const shownChips = chips.filter((chip) => chipActive(chip.key, shown))
  const filterCount = shownChips.filter((chip) => chip.key !== 'q').length
  const reset = () => apply(withoutFilters(shown))

  // After a change: bring the results top back into view if it scrolled away, and announce the new count.
  const sectionRef = useRef<HTMLElement>(null)
  const liveRef = useRef<HTMLParagraphElement>(null)
  const lastQuery = useRef(stateQuery)
  useEffect(() => {
    if (lastQuery.current === stateQuery) return
    lastQuery.current = stateQuery
    const section = sectionRef.current
    if (section && section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: 'start' })
    if (liveRef.current) liveRef.current.textContent = total ? `${formatNumber(total)} elan tapıldı` : 'Bu seçimə uyğun elan yoxdur'
  }, [stateQuery, total])

  // Below 1280 px (until the bar and sheet of the next step): the earlier filter panel in a sheet.
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => {
    if (!sheetOpen) return
    const mq = window.matchMedia('(min-width: 1280px)')
    const onChange = () => mq.matches && setSheetOpen(false)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [sheetOpen])

  const sideRef = useStickySide<HTMLElement>()

  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-4 pb-10 md:gap-5 md:pt-5 md:pb-14">
      {props.breadcrumb}
      <CatalogSearchCard q={shown.q} cityIds={shown.cityIds} query={stateQuery} cityCounts={facets.cities} onSearch={(q, cityIds) => apply({ ...shown, q, cityIds })} />

      <div className="mt-1 flex w-full items-start gap-8 md:mt-2">
        <aside ref={sideRef} aria-label="Filtrlər" className="hidden w-[256px] shrink-0 self-start pb-4 xl:sticky-side xl:block">
          <FilterSidebar
            state={shown}
            current={current}
            facets={facets}
            speciesOptions={speciesOptions}
            showPlantFilters={showPlantFilters}
            onChange={apply}
          />
        </aside>

        <section
          ref={sectionRef}
          id={RESULTS_ID}
          aria-labelledby={headingId}
          aria-busy={isPending || undefined}
          data-pending={isPending || undefined}
          className="group flex min-w-0 flex-1 scroll-mt-28 flex-col gap-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 id={headingId} tabIndex={-1} className="text-[22px] leading-[1.25] font-semibold break-words text-forest md:text-[28px]">
                {heading}
              </h1>
              <p className="text-[15px] leading-[normal] whitespace-nowrap text-muted tabular-nums">{formatNumber(total)} elan</p>
            </div>
            {total > 0 && (
              <div className="hidden items-center gap-2 xl:flex">
                <SortSelect value={shownSort} onChange={changeSort} />
                <ViewToggle view={shownView} onChange={changeView} />
              </div>
            )}
          </div>

          <div className="flex w-full items-center gap-2 xl:hidden">
            <FiltersButton count={filterCount} expanded={sheetOpen} onClick={() => setSheetOpen(true)} />
            {total > 0 && (
              <>
                <SortSelect value={shownSort} onChange={changeSort} className="min-w-0 flex-1 md:ml-auto md:flex-none" />
                <ViewToggle view={shownView} onChange={changeView} />
              </>
            )}
          </div>

          <ActiveFilterRow chips={shownChips} filterCount={filterCount} onRemove={(chip) => apply(chip.without)} onReset={reset} fallbackFocusId={headingId} />

          {/* The old results stay while new ones load; they dim after 150 ms, and brighten at once when done. */}
          <div className="flex flex-col gap-8 transition-opacity duration-(--dur-base) ease-out group-data-pending:opacity-55 group-data-pending:delay-150 motion-reduce:transition-none">
            {total === 0 ? (
              <EmptyState
                icon={<Search aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
                title="Bu seçimə uyğun elan yoxdur"
                description="Filtrləri dəyişin və ya başqa açar söz sınayın."
                action={
                  <Button fullWidth onClick={reset}>
                    Filtrləri sıfırla
                  </Button>
                }
              />
            ) : (
              props.results
            )}
            {total > 0 && props.pagination}
          </div>
          <p ref={liveRef} aria-live="polite" className="sr-only" />
        </section>
      </div>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} summary={`${heading} · ${formatNumber(total)} elan`}>
        <FilterPanel
          key={stateQuery}
          applied={state}
          q={state.q}
          onApply={(next) => {
            apply(next)
            setSheetOpen(false)
          }}
          onClear={() => {
            apply(withoutFilters(state))
            setSheetOpen(false)
          }}
          className="w-full"
        />
      </FilterSheet>
    </div>
  )
}
