/**
 * Data-access boundary for server-rendered pages.
 *
 * Route files (`src/app/**`) read data only through this interface, so the Figma mock data in `src/data` can be
 * replaced by the ASP.NET Core Web API without touching the UI: implement `MarketplaceRepository` with `fetch`
 * calls and select it with `DATA_SOURCE=api` (see src/seo/env.ts). Every method is async for that reason.
 */
import type { SearchState } from '@/features/search/searchState'
import type { ServiceQuery } from '@/features/services/query'
import { dataSource } from '@/seo/env'
import type { ListingSort } from './marketplace'
import { mockRepository } from './mockRepository'
import type { Category, City, Listing, Seller, Service, ServiceProvider } from '@/types'

export interface PageResult<T> {
  items: T[]
  /** Total matches across all pages. */
  total: number
  /** 1-based page actually returned. */
  page: number
  pageCount: number
}

export interface ServiceSearchResult extends PageResult<Service> {
  /** Count shown in the UI ("252 xidmət elanı"): the platform total while nothing is filtered. */
  displayTotal: number
}

export interface HomeContent {
  vip: Listing[]
  latest: Listing[]
  sellers: Seller[]
  services: Array<{ service: Service; image: string }>
}

export interface MarketplaceRepository {
  /* Taxonomy */
  listProductCategories(): Promise<Category[]>
  getProductCategory(id: string): Promise<Category | undefined>
  listCities(): Promise<City[]>
  getCity(id: string): Promise<City | undefined>

  /* Listings (public = active only) */
  getHomeContent(): Promise<HomeContent>
  searchListings(query: { state: SearchState; sort: ListingSort; page: number; pageSize: number }): Promise<PageResult<Listing>>
  countListings(filter: { categoryId: string; cityId?: string }): Promise<number>
  listPublicListings(): Promise<Listing[]>
  getPublicListing(slug: string): Promise<Listing | undefined>
  /** "Satıcının digər elanları" and "Oxşar elanlar" for a listing page. */
  getRelatedListings(listing: Listing): Promise<{ fromSeller: Listing[]; similar: Listing[] }>

  /* Sellers */
  listSellers(): Promise<Seller[]>
  getSeller(slug: string): Promise<Seller | undefined>
  getSellerById(id: string): Promise<Seller | undefined>

  /* Services */
  searchServices(query: ServiceQuery): Promise<ServiceSearchResult>
  listServices(): Promise<Service[]>
  getService(slug: string): Promise<Service | undefined>
  getServiceProvider(id: string): Promise<ServiceProvider | undefined>
}

export function getRepository(): MarketplaceRepository {
  if (dataSource() === 'api') {
    throw new Error('DATA_SOURCE=api: the Web API repository is not implemented yet. Use DATA_SOURCE=mock.')
  }
  return mockRepository
}
