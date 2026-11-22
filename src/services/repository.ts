/**
 * Data-access boundary for server-rendered pages.
 *
 * Route files (`src/app/**`) read data only through this interface, so the Figma mock data in `src/data` and the
 * ASP.NET Core Web API are interchangeable: `DATA_SOURCE=mock` (the default) serves `mockRepository`,
 * `DATA_SOURCE=api` serves `apiRepository` (fetch to `API_BASE_URL`, see src/seo/env.ts). Every method is async
 * for that reason. Contract changes: docs/handoff/backend-contract.md.
 */
import type { SearchState } from '@/features/search/searchState'
import type { ServiceQuery } from '@/features/services/query'
import { dataSource } from '@/seo/env'
import { apiRepository } from './apiRepository'
import type { ListingSort } from './marketplace'
import { mockRepository } from './mockRepository'
import type {
  BusinessKind,
  Category,
  City,
  ContactReveal,
  FavoriteItems,
  Listing,
  ListingInput,
  ListingStats,
  ListingSubmitResult,
  LoginResult,
  OtpChallenge,
  OtpPurpose,
  OtpVerifyResult,
  OwnListing,
  OwnSeller,
  PhotoUpload,
  PhotoUploadRequest,
  ProfilePatch,
  PromotionOrder,
  PromotionPackage,
  PromotionPackageId,
  RegistrationInput,
  ReportInput,
  SavedSearch,
  SavedSearchInput,
  Seller,
  SellerProfilePatch,
  Service,
  ServiceProvider,
  ServiceRequestInput,
  ServiceRequestResult,
  SupportMessageInput,
  UserProfile,
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

/** One catalogue page: the filters from the URL, plus the seller whose listings a seller page shows. */
export interface ListingSearchQuery {
  state: SearchState
  sort: ListingSort
  page: number
  pageSize: number
  /** Only this seller's listings (`GET /listings?sellerId=`, the seller page). */
  sellerId?: string
}

/**
 * The counts next to the catalogue's filter options (backend-contract.md 1.4): each one is the number of listings the
 * current filters would find with that option chosen instead (`selectCategory` for the categories).
 */
export interface FacetCounts {
  /** Per category id; `all` is «Hamısı». */
  categories: { all: number; byId: Record<string, number> }
  /** Per sub-category id, every category's (the accordion shows any category's list). */
  subcategories: Record<string, number>
  /** Per city id; `all` is «Bütün şəhərlər». */
  cities: { all: number; byCity: Record<string, number> }
}

export type SitemapKind = 'listing' | 'seller' | 'service'

/** A public page for sitemap.xml: its slug and, where the data has one, the date it last changed. */
export interface SitemapEntry {
  slug: string
  updatedAt?: string
}

/** One page of sitemap entries (backend-contract.md 1.1); pass `nextCursor` back for the next one. */
export interface SitemapPage {
  items: SitemapEntry[]
  nextCursor?: string
}

/** The sellers directory (/saticilar), one page (backend-contract.md 1.1). */
export interface SellerQuery {
  businessKind?: BusinessKind
  cityId?: string
  page: number
  /** 24 when not given; at most 60. */
  pageSize?: number
}

export interface MarketplaceRepository {
  /* Taxonomy */
  listProductCategories(): Promise<Category[]>
  getProductCategory(id: string): Promise<Category | undefined>
  listCities(): Promise<City[]>
  getCity(id: string): Promise<City | undefined>

  /* Listings (public = active only; no phone numbers, backend-contract.md 3.1) */
  getHomeContent(): Promise<HomeContent>
  searchListings(query: ListingSearchQuery): Promise<PageResult<Listing>>
  /** The catalogue's filter counts for the current filters. */
  getFacetCounts(state: SearchState): Promise<FacetCounts>
  countListings(filter: { categoryId: string; cityId?: string }): Promise<number>
  /**
   * The listing a slug names. The number at the end of the slug decides, so an old slug still finds it: when the
   * returned `slug` differs, the page redirects there (backend-contract.md 1.2).
   */
  getPublicListing(slug: string): Promise<Listing | undefined>
  /** "Satıcının digər elanları" and "Oxşar elanlar" for a listing page. */
  getRelatedListings(listing: Listing): Promise<{ fromSeller: Listing[]; similar: Listing[] }>
  /** Public pages for sitemap.xml, a page at a time (backend-contract.md 1.1). */
  listSitemapEntries(kind: SitemapKind, cursor?: string): Promise<SitemapPage>

  /* Sellers */
  listSellers(query: SellerQuery): Promise<PageResult<Seller>>
  getSeller(slug: string): Promise<Seller | undefined>
  getSellerById(id: string): Promise<Seller | undefined>

  /* Services */
  searchServices(query: ServiceQuery): Promise<ServiceSearchResult>
  /** Like `getPublicListing`: the returned `slug` is the current one. */
  getService(slug: string): Promise<Service | undefined>
  getServiceProvider(id: string): Promise<ServiceProvider | undefined>
  /** «Bu ustanın digər xidmətləri» and similar services for a service page (backend-contract.md 1.1). */
  getRelatedServices(service: Service): Promise<{ fromProvider: Service[]; similar: Service[] }>

  /*
   * Added Nov 2026 (docs/handoff/contract-additions.md). Reads first, then writes. Writes are called from Server
   * Actions (src/features/** /actions.ts); in DATA_SOURCE=mock they validate and answer like the API would, but
   * nothing is stored: the demo keeps the user's own data in the browser.
   */
  /**
   * Services a provider publishes (provider page, «Bu ustanın digər xidmətləri», a business's page). `providerId` is
   * `Service.providerId`, or a business's `Seller.id` for the services of that business.
   */
  listProviderServices(providerId: string): Promise<Service[]>
  /**
   * Every listing of the signed-in owner in every status but deleted — «Elanlarım», the last changed first. The session
   * decides whose (backend-contract.md 2.2): the mock answers for the demo seller.
   */
  listOwnListings(): Promise<OwnListing[]>
  /** One of the owner's listings in any status (the cabinet's preview, the edit form); `undefined` when not theirs. */
  getOwnListing(id: string): Promise<OwnListing | undefined>
  /** Owner-only numbers for one listing (14 days of views). */
  getListingStats(listingId: string): Promise<ListingStats | undefined>
  /** «Önə çıxar», «İrəli çək» and the bundle, with their prices. */
  listPromotionPackages(): Promise<PromotionPackage[]>

  /*
   * The listing cycle (backend-contract.md 3.2–3.4). Signed in only: the session decides whose listing it is, and
   * another account's listing answers as not found.
   */
  /**
   * An upload address for one photo of «Elan yerləşdir»: the browser sends the file straight to `uploadUrl` (the API,
   * not this site: a hosting function takes 4.5 MB at most), then `photoId` goes into `ListingInput.photoIds`.
   */
  createPhotoUpload(input: PhotoUploadRequest): Promise<PhotoUpload>
  /**
   * «Elanı göndər»: the listing goes to the moderator. `idempotencyKey` (≤ 80 printable ASCII characters): sending the
   * same key again answers the same listing instead of a second one (a retry after a lost answer).
   */
  submitListing(input: ListingInput, idempotencyKey?: string): Promise<ListingSubmitResult>
  /** An edit: back to the moderator. `version` (`OwnListing.version`): refuse when the listing changed since it was read. */
  updateListing(id: string, input: ListingInput, version?: string): Promise<ListingSubmitResult>
  /** «Yenilə» (an expired listing): 30 more days. */
  renewListing(id: string): Promise<OwnListing>
  /** «Deaktiv et» (an active listing): off the site until «Aktiv et». */
  deactivateListing(id: string): Promise<OwnListing>
  /** «Aktiv et» (a deactivated listing): back on the site, or `expired` when its 30 days are over. */
  activateListing(id: string): Promise<OwnListing>
  /** «Sil»: gone for everyone. */
  deleteListing(id: string): Promise<void>
  /**
   * A view of a listing's (or a service's) page, sent by the browser once per page view (pages are cached, so the
   * render cannot count). The API counts one per visitor a day and never the owner's own.
   */
  recordListingView(listingId: string): Promise<void>
  /**
   * «Nömrəni göstər» on a listing or a service (services are listings): counts the click and returns the number.
   * A hidden number stays hidden; only the WhatsApp link comes back then (backend-contract.md 3.1).
   */
  revealPhone(listingId: string): Promise<ContactReveal>
  /** «Nömrəni göstər» on a seller page (backend-contract.md 3.1). */
  revealSellerPhone(sellerId: string): Promise<ContactReveal>
  createPromotionOrder(input: { listingId: string; packageId: PromotionPackageId; optionId: string }): Promise<PromotionOrder>
  submitReport(input: ReportInput): Promise<{ id: string }>
  submitServiceRequest(input: ServiceRequestInput): Promise<ServiceRequestResult>
  /** «Bizimlə əlaqə» (support form); returns the ticket number. */
  submitSupportMessage(input: SupportMessageInput): Promise<{ ticket: number }>

  /* Accounts: SMS code, registration, password reset */
  requestOtp(input: { phone: string; purpose: OtpPurpose }): Promise<OtpChallenge>
  verifyOtp(input: { challengeId: string; code: string }): Promise<OtpVerifyResult>
  /** The new account is signed in at once (backend-contract.md 2.1). */
  register(input: RegistrationInput): Promise<LoginResult>
  resetPassword(input: { otpChallengeId: string; password: string }): Promise<{ ok: boolean }>

  /*
   * The signed-in account (backend-contract.md 2.1–2.3). The session is not a parameter: in DATA_SOURCE=api the
   * repository keeps it in the httpOnly cookie (src/services/session.ts), which the sign-ins write and `logout`
   * removes, and sends it with every call below. DATA_SOURCE=mock has no server session (the demo signs in in the
   * browser): these answer for the demo account, from memory, as the API would.
   */
  /** Phone (any common shape) or e-mail, and the password. */
  login(input: { login: string; password: string }): Promise<LoginResult>
  /** A verified SMS code of purpose `login`. */
  loginWithOtp(input: { otpChallengeId: string }): Promise<LoginResult>
  logout(): Promise<void>
  /** `undefined` when nobody is signed in (or the session has ended). */
  getMe(): Promise<UserProfile | undefined>
  updateMe(patch: ProfilePatch): Promise<UserProfile>
  /** `{ ok: false }`: the current password is wrong. */
  changePassword(input: { current: string; next: string }): Promise<{ ok: boolean }>
  /** A verified SMS code of purpose `change-phone`, sent to the new number. */
  changePhone(input: { otpChallengeId: string }): Promise<UserProfile>
  /** The business profile («mağaza») of a business account; `undefined` for an individual one. */
  getOwnSeller(): Promise<OwnSeller | undefined>
  updateOwnSeller(patch: SellerProfilePatch): Promise<OwnSeller>

  /* «Seçilmişlər» and saved searches of the signed-in account (backend-contract.md 2.3); guests keep theirs in the browser */
  /** `["listing:<id>", "service:<id>"]`, oldest first (the order the site adds them in). */
  listFavorites(): Promise<string[]>
  setFavorite(kind: 'listing' | 'service', id: string, on: boolean): Promise<void>
  /** After signing in: a guest's favourites join the account's; returns the account's list. */
  mergeFavorites(keys: string[]): Promise<string[]>
  /** The favourites that are for sale now, as cards (the «Seçilmişlər» page). */
  listFavoriteItems(): Promise<FavoriteItems>
  /** Newest first, with `newCount`. */
  listSavedSearches(): Promise<SavedSearch[]>
  saveSearch(input: SavedSearchInput): Promise<SavedSearch>
  updateSavedSearch(id: string, patch: { name?: string; alerts?: boolean }): Promise<SavedSearch>
  deleteSavedSearch(id: string): Promise<void>
  /** The user opened the search: what it found until now is no longer new (`newCount: 0`). */
  markSavedSearchOpened(id: string): Promise<SavedSearch>
}

export { isNotImplemented } from './apiRepository'

/** The repository of this deployment (src/seo/env.ts `dataSource`). */
export function getRepository(): MarketplaceRepository {
  return dataSource() === 'api' ? apiRepository : mockRepository
}
