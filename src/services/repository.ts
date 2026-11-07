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
import type {
  Category,
  City,
  Listing,
  ListingInput,
  ListingStats,
  ListingSubmitResult,
  OtpChallenge,
  OtpPurpose,
  OtpVerifyResult,
  PromotionOrder,
  PromotionPackage,
  PromotionPackageId,
  RegistrationInput,
  ReportInput,
  Seller,
  Service,
  ServiceProvider,
  ServiceRequestInput,
  ServiceRequestResult,
} from '@/types'

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

  /*
   * Added Nov 2026 (docs/handoff/contract-additions.md). Reads first, then writes. Writes are called from Server
   * Actions (src/features/** /actions.ts); in DATA_SOURCE=mock they validate and answer like the API would, but
   * nothing is stored: the demo keeps the user's own data in the browser.
   */
  /** Services a provider publishes (provider page and «Bu ustanın digər xidmətləri»). */
  listProviderServices(providerId: string): Promise<Service[]>
  /** Every listing of a seller in every status — the owner's «Elanlarım». Authorised by the session in the API. */
  listOwnListings(sellerId: string): Promise<Listing[]>
  /** Owner-only numbers for one listing. */
  getListingStats(listingId: string): Promise<ListingStats | undefined>
  /** «Önə çıxar», «İrəli çək» and the bundle, with their prices. */
  listPromotionPackages(): Promise<PromotionPackage[]>

  submitListing(input: ListingInput): Promise<ListingSubmitResult>
  /** Counts a «Nömrəni göstər» click and returns the number (hidden numbers stay hidden). */
  revealPhone(listingId: string): Promise<{ phone?: string }>
  createPromotionOrder(input: { listingId: string; packageId: PromotionPackageId; optionId: string }): Promise<PromotionOrder>
  submitReport(input: ReportInput): Promise<{ id: string }>
  submitServiceRequest(input: ServiceRequestInput): Promise<ServiceRequestResult>

  /* Accounts: SMS code, registration, password reset */
  requestOtp(input: { phone: string; purpose: OtpPurpose }): Promise<OtpChallenge>
  verifyOtp(input: { challengeId: string; code: string }): Promise<OtpVerifyResult>
  register(input: RegistrationInput): Promise<{ userId: string }>
  resetPassword(input: { otpChallengeId: string; password: string }): Promise<{ ok: boolean }>
}

export function getRepository(): MarketplaceRepository {
  if (dataSource() === 'api') {
    throw new Error('DATA_SOURCE=api: the Web API repository is not implemented yet. Use DATA_SOURCE=mock.')
  }
  return mockRepository
}
