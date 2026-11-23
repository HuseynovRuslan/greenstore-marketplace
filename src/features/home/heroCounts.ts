import { emptySearchState } from '@/features/search/searchUrl'
import type { MarketplaceRepository } from '@/services/repository'
import type { Category } from '@/types'
import type { HeroTab } from './heroSearch'

/** The numbers of the home search: the categories row, the tabs and the city field. */
export interface HeroCounts {
  /** Product categories with their listing counts (the categories row). */
  categories: Category[]
  tabs: Record<HeroTab, number>
  /** Product listings per city id; «Bütün şəhərlər» shows `tabs.products`. */
  cities: Record<string, number>
}

/**
 * Counted through the repository on the server, from the same data the catalogue searches (no typed-in totals):
 * «Məhsullar» is the sum of the category counts, «Xidmətlər» the services catalogue's total, «Hamısı» both. The city
 * field's numbers are the catalogue's city facets with nothing else chosen.
 */
export async function loadHeroCounts(repo: MarketplaceRepository): Promise<HeroCounts> {
  const [categories, services, facets] = await Promise.all([
    repo.listProductCategories(),
    repo.searchServices({ q: '', tab: 'all', sort: 'newest', page: 1 }),
    repo.getFacetCounts(emptySearchState),
  ])
  const products = categories.reduce((sum, c) => sum + c.listingCount, 0)
  return {
    categories,
    tabs: { all: products + services.displayTotal, products, services: services.displayTotal },
    cities: facets.cities.byCity,
  }
}
