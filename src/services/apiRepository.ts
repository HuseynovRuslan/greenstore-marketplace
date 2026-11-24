/**
 * `MarketplaceRepository` over the GreenStore Web API (DATA_SOURCE=api; backend/ARCHITECTURE.md §10).
 *
 * - **Where:** `API_BASE_URL` (server-only, e.g. http://localhost:5080), every path under /api/v1.
 * - **Headers:** `Accept-Language` (the site is Azerbaijani-only for now), `X-Internal-Key` (`API_INTERNAL_KEY`)
 *   on every call. `X-Client-IP` (the visitor's IP, believed by the API only with the key) goes on per-visitor calls
 *   only: a public read is cached and shared by every visitor, the IP would split that cache per visitor, and reading
 *   the request headers would opt every page out of static rendering. The IP is read only from what the hosting's
 *   proxy writes (`CLIENT_IP_HEADER` / `TRUSTED_PROXY_HOPS`, ./clientIp.ts), never from what a browser can send.
 * - **Cache:** public reads are `fetch(…, { next: { revalidate: 60, tags } })`. Tags name what a read depends on
 *   (`listings`, `listing:<slug or id>`, `sellers`, `services`, `taxonomy`, …), so the API's change notices (phase 3,
 *   `POST /api/revalidate` → `revalidateTag`) can refresh them before the minute is up.
 * - **JSON** is the shape of src/types already (the API's contract tests check it), so responses are returned as
 *   they come. A 404 of a "get one" read is `undefined`; any other failure throws `ApiError`, which carries the
 *   ProblemDetails (`code`, field `errors`, `attemptsLeft`, `Retry-After`) for the Server Action to word.
 * - **Session** (phase 2, backend-contract.md 2.1): the sign-ins keep the API's token in the httpOnly `gs_session`
 *   cookie (src/services/session.ts); every per-visitor call sends it as `Authorization: Bearer`. A 401 means the
 *   session has ended: the cookies are removed and the account reads answer "signed out". The account's phone comes as
 *   E.164 and is returned in the site's spacing ("+994 50 555 12 34").
 * - **Listing cycle** (phase 3, backend-contract.md 3.2–3.6): photo upload addresses, sending and editing a listing
 *   (`Idempotency-Key`), «Elanlarım» and its actions, the owner's statistics, «Nömrəni göstər» and the view beacon.
 *   The owner's and the revealed numbers come as E.164 and are returned in the site's spacing too.
 * - **Reports and support** (phase 4, backend-contract.md 4.1, 4.2): per-visitor writes, guests too.
 * - **Promotion** (phase 5, backend-contract.md 5.1): the packages (a cached public read), an order for the owner's
 *   listing with the payment provider's page (`Idempotency-Key`), and the owner's order after the provider brings
 *   them back.
 * - A method whose endpoint is not there yet throws `NotImplementedError` naming the phase (none since phase 5).
 */
import 'server-only'
import { headers } from 'next/headers'
import { formatPhone } from '@/features/auth/validation'
import type { SearchState } from '@/features/search/searchState'
import type {
  BusinessKind,
  Category,
  City,
  ContactReveal,
  FavoriteItems,
  Listing,
  ListingStats,
  ListingSubmitResult,
  LoginError,
  LoginResult,
  OtpChallenge,
  OtpVerifyResult,
  OwnListing,
  OwnSeller,
  PhotoUpload,
  PromotionCheckout,
  PromotionOrder,
  PromotionPackage,
  SavedSearch,
  Seller,
  Service,
  ServiceProvider,
  UserProfile,
} from '@/types'
import { listingFilterParams, listingSearchParams, sellerListParams, serviceSearchParams } from './apiQuery'
import type { FacetCounts, HomeContent, MarketplaceRepository, PageResult, ServiceSearchResult, SitemapKind, SitemapPage } from './repository'
import { clearSession, sessionToken, storeSession, type SessionGrant } from './session'
import { clientIpOf } from './clientIp'

/** Seconds a public read is served from Next's data cache before it is fetched again. */
export const REVALIDATE_SECONDS = 60

/** The site's language; the API answers names in it (ru and en come with the site's translations). */
const LANGUAGE = 'az'

/** The RFC 9457 body of a failed call: the stable `code`, field errors by field (`{ phone: ['not-mobile'] }`), extras. */
export interface Problem {
  code?: string
  errors?: Record<string, string[]>
  /** A wrong SMS code: tries left. */
  attemptsLeft?: number
}

/** A response other than 2xx, with the API's stable ProblemDetails `code` (`listing.not-found`, `validation`, …). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    path: string,
    readonly problem: Problem = {},
    /** `Retry-After` in seconds (a lockout, a rate limit) */
    readonly retryAfterSec?: number,
  ) {
    super(`GreenStore API ${status}${code ? ` ${code}` : ''}: ${path}`)
    this.name = 'ApiError'
  }

  /** The first error code the API gave for `field` (`required`, `invalid`, `too-weak`, …). */
  fieldError(field: string): string | undefined {
    return this.problem.errors?.[field]?.[0]
  }
}

export function isApiError(error: unknown, code?: string): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code)
}

/** A repository method whose API endpoint is planned for a later phase (backend/ARCHITECTURE.md §17). */
export class NotImplementedError extends Error {
  constructor(
    readonly method: string,
    readonly phase: number,
  ) {
    super(`DATA_SOURCE=api: ${method} is not implemented yet (phase ${phase}).`)
    this.name = 'NotImplementedError'
  }
}

export function isNotImplemented(error: unknown): error is NotImplementedError {
  return error instanceof NotImplementedError
}

/* ---------- Request ---------- */

function apiBase(env: Record<string, string | undefined> = process.env): string {
  const base = env.API_BASE_URL?.trim()
  if (!base) throw new Error('DATA_SOURCE=api needs API_BASE_URL (the GreenStore API, e.g. http://localhost:5080).')
  return `${base.replace(/\/+$/, '')}/api/v1`
}

/** Headers of every call; `clientIp` only on per-visitor (uncached) calls. */
export function apiHeaders(options: { clientIp?: string } = {}, env: Record<string, string | undefined> = process.env): Record<string, string> {
  const result: Record<string, string> = { Accept: 'application/json', 'Accept-Language': LANGUAGE }
  const key = env.API_INTERNAL_KEY?.trim()
  if (key) {
    result['X-Internal-Key'] = key
    if (options.clientIp) result['X-Client-IP'] = options.clientIp
  }
  return result
}

const path = (segments: Array<string | number>) => segments.map((s) => encodeURIComponent(String(s))).join('/')

function urlOf(route: string, query?: URLSearchParams): string {
  const search = query?.toString()
  return `${apiBase()}/${route}${search ? `?${search}` : ''}`
}

async function problemOf(response: Response): Promise<Problem> {
  try {
    const body = (await response.json()) as Record<string, unknown>
    const errors = body.errors && typeof body.errors === 'object' ? (body.errors as Record<string, string[]>) : undefined
    return {
      ...(typeof body.code === 'string' ? { code: body.code } : {}),
      ...(errors ? { errors } : {}),
      ...(typeof body.attemptsLeft === 'number' ? { attemptsLeft: body.attemptsLeft } : {}),
    }
  } catch {
    return {}
  }
}

async function failure(response: Response, route: string): Promise<ApiError> {
  const problem = await problemOf(response)
  const retryAfter = Number(response.headers.get('retry-after'))
  return new ApiError(response.status, problem.code, route, problem, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
}

/** A cached public read. */
async function read<T>(route: string, tags: string[], query?: URLSearchParams): Promise<T> {
  const response = await fetch(urlOf(route, query), { headers: apiHeaders(), next: { revalidate: REVALIDATE_SECONDS, tags } })
  if (!response.ok) throw await failure(response, route)
  return (await response.json()) as T
}

/** A cached public read of one thing: `undefined` when the API says 404. */
async function readOne<T>(route: string, tags: string[]): Promise<T | undefined> {
  try {
    return await read<T>(route, tags)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

/**
 * A per-visitor call (the account, writes, reveals): never cached. It carries the visitor's IP so the API's limits
 * count the visitor, not the Next.js server, the visitor's browser (the API names the device of a new session from
 * it, «Aktiv cihazlar»), and the session token when the visitor is signed in.
 */
export async function send<T>(
  route: string,
  init: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  let clientIp: string | undefined
  let userAgent: string | undefined
  try {
    const request = await headers()
    clientIp = clientIpOf(request)
    userAgent = request.get('user-agent') ?? undefined
  } catch {
    // Outside a request (a script, a build step): the API counts the server's own address.
  }
  const token = await sessionToken()
  const response = await fetch(urlOf(route), {
    method: init.method,
    cache: 'no-store',
    headers: {
      ...apiHeaders({ clientIp }),
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(userAgent ? { 'User-Agent': userAgent } : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!response.ok) {
    const error = await failure(response, route)
    // The session ended (signed out elsewhere, expired, password changed): forget it.
    if (error.status === 401 && token) await clearSession()
    throw error
  }
  return (response.status === 204 ? undefined : await response.json()) as T
}

/** A call that needs a signed-in visitor: without a session it does not go out (401 `unauthorized`, as the API answers). */
async function sendSigned<T>(route: string, init: Parameters<typeof send>[1]): Promise<T> {
  if (!(await sessionToken())) throw new ApiError(401, 'unauthorized', route)
  return send<T>(route, init)
}

/** An account read: `fallback` when nobody is signed in (no cookie, or the API says the session has ended). */
async function readSigned<T>(route: string, fallback: T): Promise<T> {
  try {
    return await sendSigned<T>(route, { method: 'GET' })
  } catch (error) {
    if (isApiError(error) && error.status === 401) return fallback
    throw error
  }
}

/* ---------- Accounts (backend-contract.md 2.1) ---------- */

/** `GET /me` and the sign-ins: the profile with the phone in the site's spacing. */
function toProfile(user: UserProfile): UserProfile {
  return { ...user, phone: user.phone ? formatPhone(user.phone) : '' }
}

interface SessionResponse {
  ok: true
  user: UserProfile
  session: SessionGrant
}

/** A sign-in or registration the API accepted: the session goes into the cookies, the profile to the caller. */
async function signedIn(response: SessionResponse): Promise<LoginResult> {
  await storeSession(response.session.token, response.user.fullName)
  return { ok: true, user: toProfile(response.user) }
}

const LOGIN_ERRORS: Record<string, LoginError> = {
  'auth.wrong-credentials': 'wrong-credentials',
  'auth.locked': 'locked',
  // Too many wrong passwords from one address: the same advice as a lockout (wait, or sign in by SMS code).
  'auth.too-many-attempts': 'locked',
  'auth.blocked': 'blocked',
}

/** A refused sign-in as `LoginResult`; anything else (validation, a spent SMS code, the API down) is thrown. */
function loginFailure(error: unknown): LoginResult {
  const reason = isApiError(error) && error.code ? LOGIN_ERRORS[error.code] : undefined
  if (!reason || !isApiError(error)) throw error
  return { ok: false, error: reason, ...(error.retryAfterSec ? { retryAfterSec: error.retryAfterSec } : {}) }
}

const OTP_ERRORS: Record<string, NonNullable<OtpVerifyResult['error']>> = {
  'otp.wrong-code': 'wrong-code',
  'otp.expired': 'expired',
  'otp.too-many-attempts': 'too-many-attempts',
}

/**
 * A seller's kinds across their change to a list (Nov 2026, docs/handoff/multi-business-kind.md). The site and the API
 * build at the same time on a merge, and an API not yet deployed sends one `businessKind`. Remove the fallback in a
 * later release, once every API sends `businessKinds`.
 */
function withKinds<T extends Seller>(seller: T): T {
  if (Array.isArray(seller.businessKinds)) return seller
  const { businessKind, ...rest } = seller as T & { businessKind?: BusinessKind }
  return { ...rest, businessKinds: businessKind ? [businessKind] : [] } as T
}

/** The business profile's own number in the site's spacing too. */
function toOwnSeller(seller: OwnSeller): OwnSeller {
  const own = withKinds(seller)
  return own.phone ? { ...own, phone: formatPhone(own.phone) } : own
}

/* ---------- The owner's listings (phase 3, backend-contract.md 2.2, 3.3) ---------- */

/** The owner's own number in the site's spacing, as the rest of the site shows numbers. */
function toOwnListing(listing: OwnListing): OwnListing {
  return listing.contactPhone ? { ...listing, contactPhone: formatPhone(listing.contactPhone) } : listing
}

/** «Nömrəni göstər»: the number in the site's spacing; the WhatsApp link as the API gave it. */
function toReveal({ phone, whatsappUrl }: ContactReveal): ContactReveal {
  return { ...(phone ? { phone: formatPhone(phone) } : {}), ...(whatsappUrl ? { whatsappUrl } : {}) }
}

/** An owner's read: `undefined` when the listing is not the session's (404) or nobody is signed in. */
async function readOwn<T>(route: string): Promise<T | undefined> {
  try {
    return await sendSigned<T>(route, { method: 'GET' })
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) return undefined
    throw error
  }
}

/* ---------- Cache tags ---------- */

const TAG = {
  taxonomy: 'taxonomy',
  home: 'home',
  listings: 'listings',
  listing: (key: string) => `listing:${key}`,
  sellers: 'sellers',
  seller: (key: string) => `seller:${key}`,
  services: 'services',
  service: (key: string) => `service:${key}`,
  provider: (id: string) => `provider:${id}`,
  sitemap: (kind: SitemapKind) => `sitemap:${kind}`,
  promotions: 'promotions',
} as const

/**
 * The cache tags a change of this listing touches: the same tags the API's change notices name (backend-contract.md
 * 3.6), so a Server Action that changed a listing can refresh the pages at once (`updateTag`) without waiting for the
 * notice.
 */
export function listingCacheTags(listing: Pick<Listing, 'id' | 'slug' | 'sellerId'> & { kind?: OwnListing['kind'] }): string[] {
  const service = listing.kind === 'service'
  const tags = service
    ? [TAG.service(listing.id), TAG.service(listing.slug), TAG.services, TAG.sitemap('service')]
    : [TAG.listing(listing.id), TAG.listing(listing.slug), TAG.listings, TAG.sitemap('listing')]
  tags.push(TAG.home)
  if (listing.sellerId) tags.push(TAG.seller(listing.sellerId), TAG.sellers)
  return tags
}

/** The listing's own pages only (its page by id and by slug): no shared list, so a caller cannot expire the site's. */
export function listingPageTags(listing: Pick<Listing, 'id' | 'slug'> & { kind?: OwnListing['kind'] }): string[] {
  const tag = listing.kind === 'service' ? TAG.service : TAG.listing
  return [tag(listing.id), tag(listing.slug)]
}

/* ---------- Repository ---------- */

export const apiRepository: MarketplaceRepository = {
  /* Taxonomy */
  async listProductCategories() {
    return read<Category[]>('categories', [TAG.taxonomy, TAG.listings], new URLSearchParams({ kind: 'product' }))
  },
  async getProductCategory(id) {
    const category = await readOne<Category>(`categories/${path([id])}`, [TAG.taxonomy, TAG.listings])
    // The API also answers the services' umbrella category; the product catalogue's pages are for products.
    return category?.kind === 'product' ? category : undefined
  },
  async listCities() {
    return read<City[]>('cities', [TAG.taxonomy])
  },
  async getCity(id) {
    return (await read<City[]>('cities', [TAG.taxonomy])).find((c) => c.id === id)
  },

  /* Listings */
  async getHomeContent() {
    return read<HomeContent>('home', [TAG.home, TAG.listings, TAG.sellers, TAG.services])
  },
  async searchListings(query) {
    const tags = query.sellerId ? [TAG.listings, TAG.seller(query.sellerId)] : [TAG.listings]
    return read<PageResult<Listing>>('listings', tags, listingSearchParams(query))
  },
  async getFacetCounts(state: SearchState) {
    return read<FacetCounts>('listings/facets', [TAG.listings], listingFilterParams(state))
  },
  async countListings({ categoryId, cityId }) {
    const query = new URLSearchParams({ categoryId })
    if (cityId) query.set('cityId', cityId)
    return (await read<{ count: number }>('listings/count', [TAG.listings], query)).count
  },
  async getPublicListing(slug) {
    return readOne<Listing>(`listings/${path([slug])}`, [TAG.listings, TAG.listing(slug)])
  },
  async getRelatedListings(listing) {
    return read<{ fromSeller: Listing[]; similar: Listing[] }>(`listings/${path([listing.id, 'related'])}`, [TAG.listings, TAG.listing(listing.id)])
  },
  async listSitemapEntries(kind, cursor) {
    const query = cursor ? new URLSearchParams({ cursor }) : undefined
    const tags = [TAG.sitemap(kind), kind === 'seller' ? TAG.sellers : kind === 'service' ? TAG.services : TAG.listings]
    return read<SitemapPage>(`sitemap/${path([kind])}`, tags, query)
  },

  /* Sellers */
  async listSellers(query) {
    const found = await read<PageResult<Seller>>('sellers', [TAG.sellers], sellerListParams(query))
    return { ...found, items: found.items.map(withKinds) }
  },
  async getSeller(slug) {
    const seller = await readOne<Seller>(`sellers/${path([slug])}`, [TAG.sellers, TAG.seller(slug)])
    return seller && withKinds(seller)
  },
  async getSellerById(id) {
    const seller = await readOne<Seller>(`sellers/by-id/${path([id])}`, [TAG.sellers, TAG.seller(id)])
    return seller && withKinds(seller)
  },

  /* Services */
  async searchServices(query) {
    return read<ServiceSearchResult>('services', [TAG.services], serviceSearchParams(query))
  },
  async getService(slug) {
    return readOne<Service>(`services/${path([slug])}`, [TAG.services, TAG.service(slug)])
  },
  async getServiceProvider(id) {
    return readOne<ServiceProvider>(`providers/${path([id])}`, [TAG.services, TAG.provider(id)])
  },
  async getRelatedServices(service) {
    return read<{ fromProvider: Service[]; similar: Service[] }>(`services/${path([service.id, 'related'])}`, [TAG.services, TAG.service(service.id)])
  },
  async listProviderServices(providerId) {
    return (await readOne<Service[]>(`providers/${path([providerId, 'services'])}`, [TAG.services, TAG.provider(providerId)])) ?? []
  },

  /* «Elanlarım» and the listing cycle (phase 3, backend-contract.md 2.2, 3.2–3.4): the session decides whose */
  async listOwnListings() {
    return (await readSigned<OwnListing[]>('me/listings', [])).map(toOwnListing)
  },
  async getOwnListing(id) {
    const listing = await readOwn<OwnListing>(`me/listings/${path([id])}`)
    return listing && toOwnListing(listing)
  },
  async getListingStats(listingId) {
    return readOwn<ListingStats>(`me/listings/${path([listingId, 'stats'])}`)
  },
  async createPhotoUpload(input) {
    return sendSigned<PhotoUpload>('photos', { method: 'POST', body: { ...input, purpose: 'listing' } })
  },
  async submitListing(input, idempotencyKey) {
    return sendSigned<ListingSubmitResult>('listings', { method: 'POST', body: input, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined })
  },
  async updateListing(id, input, version) {
    return sendSigned<ListingSubmitResult>(`me/listings/${path([id])}`, { method: 'PUT', body: version ? { ...input, version } : input })
  },
  async renewListing(id) {
    return toOwnListing(await sendSigned<OwnListing>(`me/listings/${path([id, 'renew'])}`, { method: 'POST' }))
  },
  async deactivateListing(id) {
    return toOwnListing(await sendSigned<OwnListing>(`me/listings/${path([id, 'deactivate'])}`, { method: 'POST' }))
  },
  async activateListing(id) {
    return toOwnListing(await sendSigned<OwnListing>(`me/listings/${path([id, 'activate'])}`, { method: 'POST' }))
  },
  async deleteListing(id) {
    await sendSigned<void>(`me/listings/${path([id])}`, { method: 'DELETE' })
  },
  /** Per visitor (IP, browser, the session: the owner's own views are not counted), never cached. */
  async recordListingView(listingId) {
    await send<void>(`listings/${path([listingId, 'views'])}`, { method: 'POST' })
  },
  async revealPhone(listingId) {
    return toReveal(await send<ContactReveal>(`listings/${path([listingId, 'phone-reveals'])}`, { method: 'POST' }))
  },
  async revealSellerPhone(sellerId) {
    return toReveal(await send<ContactReveal>(`sellers/${path([sellerId, 'phone-reveals'])}`, { method: 'POST' }))
  },

  /* Reports and support (phase 4, backend-contract.md 4.1, 4.2): guests too, per visitor (IP-limited) */
  async submitReport(input) {
    return send<{ id: string }>('reports', { method: 'POST', body: input })
  },
  async submitSupportMessage(input) {
    return send<{ ticket: number }>('support', { method: 'POST', body: input })
  },

  /* «Önə çıxar», «İrəli çək» and the bundle (phase 5, backend-contract.md 5.1) */
  async listPromotionPackages() {
    return read<PromotionPackage[]>('promotion-packages', [TAG.promotions])
  },
  async createPromotionOrder(input, idempotencyKey) {
    return sendSigned<PromotionCheckout>('promotion-orders', { method: 'POST', body: input, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined })
  },
  async getPromotionOrder(id) {
    return readOwn<PromotionOrder>(`me/promotion-orders/${path([id])}`)
  },

  /* Accounts (phase 2, backend-contract.md 2.1) */
  async requestOtp(input) {
    return send<OtpChallenge>('auth/otp', { method: 'POST', body: input })
  },
  async verifyOtp(input) {
    try {
      return await send<{ ok: true }>('auth/otp/verify', { method: 'POST', body: input })
    } catch (error) {
      const reason = isApiError(error) && error.code ? OTP_ERRORS[error.code] : undefined
      if (!reason || !isApiError(error)) throw error
      return { ok: false, error: reason, ...(error.problem.attemptsLeft !== undefined ? { attemptsLeft: error.problem.attemptsLeft } : {}) }
    }
  },
  async register(input) {
    return signedIn(await send<SessionResponse>('accounts', { method: 'POST', body: { ...input, client: 'web' } }))
  },
  async resetPassword(input) {
    try {
      return await send<{ ok: true }>('accounts/password-reset', { method: 'POST', body: input })
    } catch (error) {
      if (isApiError(error, 'otp.not-verified')) return { ok: false }
      throw error
    }
  },
  async login(input) {
    try {
      return await signedIn(await send<SessionResponse>('auth/login', { method: 'POST', body: { ...input, client: 'web' } }))
    } catch (error) {
      return loginFailure(error)
    }
  },
  async loginWithOtp(input) {
    try {
      return await signedIn(await send<SessionResponse>('auth/login/otp', { method: 'POST', body: { ...input, client: 'web' } }))
    } catch (error) {
      return loginFailure(error)
    }
  },
  /** Ends the session on the API (always 204) and removes the cookies, also when the API cannot be reached. */
  async logout() {
    try {
      if (await sessionToken()) await send<void>('auth/logout', { method: 'POST' })
    } catch {
      // Signing out of this browser must work even then; the API's session expires on its own.
    } finally {
      await clearSession()
    }
  },
  async getMe() {
    const me = await readSigned<UserProfile | undefined>('me', undefined)
    return me && toProfile(me)
  },
  async updateMe(patch) {
    return toProfile(await sendSigned<UserProfile>('me', { method: 'PATCH', body: patch }))
  },
  async changePassword(input) {
    try {
      return await sendSigned<{ ok: true }>('me/password', { method: 'POST', body: input })
    } catch (error) {
      if (isApiError(error, 'auth.wrong-password')) return { ok: false }
      throw error
    }
  },
  async changePhone(input) {
    return toProfile(await sendSigned<UserProfile>('me/phone', { method: 'POST', body: input }))
  },
  async getOwnSeller() {
    try {
      const seller = await readSigned<OwnSeller | undefined>('me/seller', undefined)
      return seller && toOwnSeller(seller)
    } catch (error) {
      // An individual account has no business profile.
      if (isApiError(error, 'seller.not-found')) return undefined
      throw error
    }
  },
  async updateOwnSeller(patch) {
    return toOwnSeller(await sendSigned<OwnSeller>('me/seller', { method: 'PATCH', body: patch }))
  },

  /* «Seçilmişlər» and saved searches (phase 2, backend-contract.md 2.3) */
  async listFavorites() {
    return readSigned<string[]>('me/favorites', [])
  },
  async setFavorite(kind, id, on) {
    await sendSigned<void>(`me/favorites/${path([kind, id])}`, { method: on ? 'PUT' : 'DELETE' })
  },
  async mergeFavorites(keys) {
    return sendSigned<string[]>('me/favorites/merge', { method: 'POST', body: { keys: keys.slice(0, MERGE_LIMIT) } })
  },
  async listFavoriteItems() {
    return readSigned<FavoriteItems>('me/favorites/items', { listings: [], services: [] })
  },
  async listSavedSearches() {
    return readSigned<SavedSearch[]>('me/saved-searches', [])
  },
  async saveSearch(input) {
    return sendSigned<SavedSearch>('me/saved-searches', { method: 'POST', body: input })
  },
  async updateSavedSearch(id, patch) {
    return sendSigned<SavedSearch>(`me/saved-searches/${path([id])}`, { method: 'PATCH', body: patch })
  },
  async deleteSavedSearch(id) {
    await sendSigned<void>(`me/saved-searches/${path([id])}`, { method: 'DELETE' })
  },
  async markSavedSearchOpened(id) {
    return sendSigned<SavedSearch>(`me/saved-searches/${path([id, 'opened'])}`, { method: 'POST' })
  },
}

/** The most keys one merge sends (the API's limit). */
const MERGE_LIMIT = 500
