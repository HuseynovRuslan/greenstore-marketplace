import Link from 'next/link'
import { ListingCard } from '@/components/cards/ListingCard'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { categoryById } from '@/data/categories'
import { cityName } from '@/data/cities'
import { PLANT_CATEGORY_IDS } from '@/data/postAd'
import { CatalogResults, RESULTS_ID } from '@/features/search/CatalogResults'
import { getFacetCounts } from '@/features/search/facets'
import { ListingRow } from '@/features/search/ListingRow'
import { speciesOptions } from '@/features/search/species'
import { subcategoryName } from '@/features/search/taxonomy'
import { withSearchCover } from '@/features/search/searchCovers'
import { activeChips, searchHeading, type SearchState, type SearchView } from '@/features/search/searchState'
import { categoryPath } from '@/seo/catalog'
import type { ListingSort } from '@/services/marketplace'
import type { PageResult } from '@/services/repository'
import type { Listing } from '@/types'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Breadcrumb of the catalogue: "Ana səhifə / Məhsullar / Ağaclar / Dekorativ ağaclar".
 * On a category × city page the city is the last item.
 */
export function searchCrumbs(state: SearchState, opts: { cityPage?: boolean } = {}): Crumb[] {
  const category = state.categoryId ? categoryById(state.categoryId) : undefined
  const subcategory = category && state.subcategory ? subcategoryName(category.id, state.subcategory) : undefined
  const city = opts.cityPage ? state.cityIds[0] : undefined
  const crumbs: Crumb[] = [
    { label: 'Ana səhifə', to: '/' },
    { label: 'Məhsullar', to: category ? '/elanlar' : undefined },
  ]
  if (category) crumbs.push({ label: category.name, to: subcategory || city ? categoryPath(category.id) : undefined })
  if (subcategory) crumbs.push({ label: subcategory })
  if (city) crumbs.push({ label: cityName(city) })
  return crumbs
}

/** The catalogue breadcrumb (its own markup in the Figma search frame: separators inside the items). */
function SearchBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Naviqasiya zənciri" className="w-full text-xs leading-[1.5] text-muted">
      <ol className="flex flex-wrap items-center">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex items-center whitespace-pre">
            {i > 0 && <span aria-hidden> / </span>}
            {c.to ? (
              <Link href={c.to} className="hover:text-forest">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

interface SearchPageProps {
  state: SearchState
  sort: ListingSort
  view: SearchView
  result: PageResult<Listing>
  /** All filters as a query string (category pages include their `kateqoriya` / `seher`). */
  stateQuery: string
  /** "/elanlar" or the category page path. */
  basePath: string
  /** The request's own query string on `basePath`. */
  urlQuery: string
  crumbs: Crumb[]
}

/**
 * "/elanlar" and the category pages (Variant 2). The breadcrumb, result cards, chips and counts are rendered on
 * the server; `CatalogResults` adds the search card, the sidebar and the controls.
 */
export default async function SearchPage({ state, sort, view, result, stateQuery, basePath, urlQuery, crumbs }: SearchPageProps) {
  const items = result.items.map(withSearchCover)
  const facets = await getFacetCounts(state)

  const results =
    view === 'grid' ? (
      <ul className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {items.map((listing) => (
          <li key={listing.id} className="flex">
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>
    ) : (
      <ul className="flex w-full flex-col gap-3 md:gap-5">
        {items.map((listing) => (
          <li key={listing.id}>
            <ListingRow listing={listing} />
          </li>
        ))}
      </ul>
    )

  const pagination =
    result.pageCount > 1 ? (
      <PaginationLinks page={result.page} pageCount={result.pageCount} basePath={basePath} query={urlQuery} scrollTargetId={RESULTS_ID} />
    ) : undefined

  return (
    <CatalogResults
      state={state}
      stateQuery={stateQuery}
      basePath={basePath}
      urlQuery={urlQuery}
      sort={sort}
      view={view}
      total={result.total}
      heading={searchHeading(state)}
      chips={activeChips(state)}
      facets={facets}
      speciesOptions={speciesOptions(state.categoryId)}
      plantCategoryIds={PLANT_CATEGORY_IDS}
      breadcrumb={<SearchBreadcrumb crumbs={crumbs} />}
      results={results}
      pagination={pagination}
    />
  )
}
