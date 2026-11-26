/** `MarketplaceRepository` over the Figma demo data in `src/data` (DATA_SOURCE=mock). */
import { categoryById, productCategories, subcategoryIdOf } from '@/data/categories'
import { cities } from '@/data/cities'
import { latestListingIds, listingById, listingBySlug, listings, listingsByIds, publicListings, vipListingIds } from '@/data/listings'
import { promotionOption, promotionPackages } from '@/data/promotions'
import { featuredSellerIds, sellerById, sellerBySlug, sellers } from '@/data/sellers'
import { homeServices, providerById, serviceById, serviceBySlug, services } from '@/data/services'
import { otherSellerListings, similarListings } from '@/features/listing/detail'
import { runSearch, selectCategory, type SearchState } from '@/features/search/searchState'
import { searchServices, serviceTypeIdsOf } from '@/features/services/query'
import { filterListings } from './marketplace'
import { displayPhone, maskPhone, mockAccount, mockChallengePhone, mockListingStats, mockOtp, mockSequence } from './mockWrites'
import { filterQuery, MAX_SAVED_SEARCHES } from '@/features/saved-searches/query'
import { businessKindsLabel, orderedKinds } from '@/features/seller/businessKinds'
import { isReasonFor } from '@/features/seller/complaintReasons'
import type { FacetCounts, MarketplaceRepository, PageResult, SitemapEntry } from './repository'
import type { Category, ContactReveal, Listing, ListingInput, ListingSubmitResult, LoginResult, OwnListing, OwnSeller, PromotionOrder, SavedSearch, Seller, SellerProfilePatch, Service, ServiceProvider } from '@/types'
import type { CategoryDef } from '@/data/categories'

/** A category with its number of public listings (the sample data has no separate counts). */
function withListingCount({ id, slug, name, icon, kind, description }: CategoryDef): Category {
  return { id, slug, name, icon, kind, description, listingCount: publicListings.filter((l) => l.categoryId === id).length }
}

function page<T>(all: T[], requested: number, size: number): PageResult<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / size))
  const current = Math.min(Math.max(1, requested), pageCount)
  return { items: all.slice((current - 1) * size, current * size), total: all.length, page: current, pageCount }
}

/* ---------- Public shapes: no phone numbers (backend-contract.md 3.1), like the API ---------- */

/**
 * Figma never shows a number for service providers; this one (the components frame's revealed state, «Nömrə
 * göstərilib · +994 50 555 12 34») is the demo number behind their «Nömrəni göstər».
 */
const DEMO_PROVIDER_PHONE = '+994 50 555 12 34'

const listingNumberOf = (l: Listing) => l.contactPhone ?? sellerById(l.sellerId)?.phone
const providerNumberOf = (p: ServiceProvider) => p.phone ?? sellerById(p.sellerId)?.phone ?? DEMO_PROVIDER_PHONE

/** A listing as public reads send it: the number only masked (none when hidden), the sub-category id added. */
function publicListing(l: Listing): Listing {
  const { contactPhone, ...rest } = l
  const number = contactPhone ?? sellerById(l.sellerId)?.phone
  // The mask, never the number: the page asks revealPhone for it.
  const subcategoryId = l.subcategoryId ?? subcategoryIdOf(l.categoryId, l.subcategory)
  // Every sub-category, as the API sends it (Nov 2026): the sample listings have one each.
  const subcategoryIds = l.subcategoryIds ?? (subcategoryId ? [subcategoryId] : [])
  const subcategories = l.subcategories ?? (l.subcategory ? [l.subcategory] : [])
  return { ...rest, ...(subcategoryId ? { subcategoryId } : {}), subcategoryIds, subcategories, ...(number && !l.phoneHidden ? { phoneMasked: maskPhone(number) } : {}) }
}

function publicSeller(s: Seller): Seller {
  const { phone, ...rest } = s
  return { ...rest, ...(phone ? { phoneMasked: maskPhone(phone) } : {}) }
}

function publicProvider(p: ServiceProvider): ServiceProvider {
  const { phone, ...rest } = p
  return { ...rest, phoneMasked: maskPhone(phone ?? providerNumberOf(p)) }
}

const toPublic = (items: Listing[]) => items.map(publicListing)

/** The demo's promotion orders of this server process, by id and by `Idempotency-Key`; the newest few hundred. */
const mockOrders = new Map<string, PromotionOrder>()
const mockOrderKeys = new Map<string, string>()
const MOCK_ORDERS_KEPT = 500

function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.set(key, value)
  if (map.size > MOCK_ORDERS_KEPT) map.delete(map.keys().next().value!)
}

/** «WhatsApp-a yaz»: https://wa.me/<digits>. */
const whatsappUrl = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`

/** What «Nömrəni göstər» gives: the number unless hidden, the WhatsApp link when the number takes messages. */
function reveal(phone: string | undefined, opts: { whatsapp: boolean; hidden?: boolean }): ContactReveal {
  if (!phone) return {}
  return { ...(opts.hidden ? {} : { phone }), ...(opts.whatsapp ? { whatsappUrl: whatsappUrl(phone) } : {}) }
}

/* ---------- Counts ---------- */

/** Number of public listings for a filter state. */
const countFor = (state: SearchState) => runSearch(state).length

const subcategoryRefs = productCategories.flatMap((c) => c.subcategories.map((s) => ({ id: s.id, categoryId: c.id })))

/** The services a business shows: its own (same id as the seller) and those its profile lists. */
function providerServices(providerId: string): Service[] {
  const listed = sellerById(providerId)?.serviceIds ?? []
  return services.filter((s) => s.providerId === providerId || listed.includes(s.id))
}

export const mockRepository: MarketplaceRepository = {
  async listProductCategories() {
    return productCategories.map(withListingCount)
  },
  async getProductCategory(id) {
    const category = categoryById(id)
    return category?.kind === 'product' ? withListingCount(category) : undefined
  },
  async listCities() {
    return cities
  },
  async getCity(id) {
    return cities.find((c) => c.id === id)
  },

  async getHomeContent() {
    return {
      vip: toPublic(listingsByIds(vipListingIds)),
      latest: toPublic(listingsByIds(latestListingIds)),
      sellers: featuredSellerIds
        .map(sellerById)
        .filter((s): s is Seller => Boolean(s))
        .map(publicSeller),
      services: homeServices
        .map(({ id, image }) => ({ service: serviceById(id), image }))
        .filter((s): s is { service: Service; image: string } => Boolean(s.service)),
    }
  },
  async searchListings({ state, sort, page: requested, pageSize, sellerId }) {
    const found = runSearch(state, sort)
    return page(toPublic(sellerId ? found.filter((l) => l.sellerId === sellerId) : found), requested, pageSize)
  },
  /** One search per option, the same rules as the API's GET /listings/facets (cheap on the sample data). */
  async getFacetCounts(state) {
    const byId = Object.fromEntries(productCategories.map((c) => [c.id, countFor(selectCategory(state, c.id))]))
    const subcategories = Object.fromEntries(subcategoryRefs.map((s) => [s.id, countFor(selectCategory(state, s.categoryId, s.id))]))
    const byCity = Object.fromEntries(cities.map((c) => [c.id, countFor({ ...state, cityIds: [c.id] })]))
    const counts: FacetCounts = {
      categories: { all: countFor(selectCategory(state, '')), byId },
      subcategories,
      cities: { all: countFor({ ...state, cityIds: [] }), byCity },
    }
    return counts
  },
  async countListings({ categoryId, cityId }) {
    return filterListings(publicListings, { categoryId, cityIds: cityId ? [cityId] : undefined }).length
  },
  async getPublicListing(slug) {
    const listing = listingBySlug(slug)
    return listing?.status === 'active' ? publicListing(listing) : undefined
  },
  async getRelatedListings(listing) {
    const fromSeller = otherSellerListings(listing)
    return { fromSeller: toPublic(fromSeller), similar: toPublic(similarListings(listing, fromSeller)) }
  },
  /** Everything on one page: the demo data is small. Sellers and services have no dates, so none is invented. */
  async listSitemapEntries(kind) {
    const latest = (l: Listing) => [l.publishedAt, l.updatedAt, l.bumpedAt].filter((d): d is string => Boolean(d)).sort().at(-1)
    const items: SitemapEntry[] =
      kind === 'listing'
        ? publicListings.map((l) => ({ slug: l.slug, updatedAt: latest(l) }))
        : (kind === 'seller' ? sellers : services).map((s) => ({ slug: s.slug }))
    return { items }
  },

  async listSellers({ businessKind, cityId, page: requested, pageSize = 24 }) {
    // A business with several kinds is listed under each, as in the API.
    const found = sellers.filter((s) => s.type === 'business' && (!businessKind || s.businessKinds?.includes(businessKind)) && (!cityId || s.cityId === cityId))
    return page(found.map(publicSeller), requested, pageSize)
  },
  async getSeller(slug) {
    const seller = sellerBySlug(slug)
    return seller && publicSeller(seller)
  },
  async getSellerById(id) {
    const seller = sellerById(id)
    return seller && publicSeller(seller)
  },

  async searchServices(query) {
    const result = searchServices(query)
    return { items: result.items, total: result.total, page: result.page, pageCount: result.pageCount, displayTotal: result.displayTotal }
  },
  async getService(slug) {
    return serviceBySlug(slug)
  },
  async getServiceProvider(id) {
    const provider = providerById(id)
    return provider && publicProvider(provider)
  },
  /** The provider's others (up to 4), then up to 4 more: the same kind of work first, then any other. */
  async getRelatedServices(service) {
    const fromProvider = providerServices(service.providerId)
      .filter((s) => s.id !== service.id)
      .slice(0, 4)
    const shown = new Set([service.id, ...fromProvider.map((s) => s.id)])
    const rest = services.filter((s) => !shown.has(s.id))
    // Services that share a type come first (a service may have several types).
    const types = serviceTypeIdsOf(service)
    const shares = (s: Service) => serviceTypeIdsOf(s).some((t) => types.includes(t))
    const similar = [...rest.filter(shares), ...rest.filter((s) => !shares(s))].slice(0, 4)
    return { fromProvider, similar }
  },

  /* ---- Nov 2026 additions (docs/handoff/contract-additions.md) ---- */
  async listProviderServices(providerId) {
    return providerServices(providerId)
  },
  /** The demo session's seller (DATA_SOURCE=mock has one account with listings). */
  async listOwnListings() {
    const { sellerId } = mockAccount.state.profile
    return sellerId ? listings.filter((l) => l.sellerId === sellerId).map(ownListing) : []
  },
  async getOwnListing(id) {
    return ownListingById(id)
  },
  async getListingStats(listingId) {
    const listing = listingById(listingId)
    return listing ? mockListingStats(listing) : undefined
  },
  async listPromotionPackages() {
    return promotionPackages
  },

  /** DEMO: nothing is uploaded — the wizard keeps the photos in the browser. The request is checked like the API's. */
  async createPhotoUpload({ contentType, bytes }) {
    if (!PHOTO_TYPES.includes(contentType)) throw new Error('unsupported photo type')
    if (!(bytes > 0) || bytes > PHOTO_MAX_BYTES) throw new Error('photo too large or empty')
    return { photoId: `foto-${mockSequence('photo', 1)}`, uploadUrl: '', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() }
  },
  async submitListing(input, idempotencyKey) {
    checkInput(input)
    const replay = idempotencyKey ? sentByKey.get(idempotencyKey) : undefined
    if (replay) return replay
    const number = mockSequence('listing', 10540)
    const result: ListingSubmitResult = { id: `elan-${number}`, slug: `elan-${number}`, number, status: 'pending' }
    if (idempotencyKey) sentByKey.set(idempotencyKey, result)
    return result
  },
  /** An edit keeps the listing's id, address and number (a listing sent from this browser has its number in the id). */
  async updateListing(id, input) {
    checkInput(input)
    const listing = listingById(id)
    const number = listing?.number ?? Number(/(\d+)$/.exec(id)?.[1] ?? 0)
    return { id, slug: listing?.slug ?? id, number, status: 'pending' }
  },
  async renewListing(id) {
    return changeStatus(id, ['expired'], 'active')
  },
  async deactivateListing(id) {
    return changeStatus(id, ['active'], 'inactive')
  },
  async activateListing(id) {
    return changeStatus(id, ['inactive'], 'active')
  },
  async deleteListing(id) {
    if (!ownListingById(id)) throw new Error('listing not found')
  },
  /** DEMO: views are not counted (the owner's numbers are generated, mockListingStats). */
  async recordListingView() {},
  async revealPhone(listingId) {
    const listing = listingById(listingId)
    if (listing) {
      if (listing.status !== 'active') return {}
      const whatsapp = listing.whatsapp ?? sellerById(listing.sellerId)?.whatsapp ?? false
      return reveal(listingNumberOf(listing), { whatsapp, hidden: listing.phoneHidden })
    }
    // Services are listings too; their page always offers WhatsApp.
    const service = serviceById(listingId)
    const provider = service && providerById(service.providerId)
    return provider ? reveal(providerNumberOf(provider), { whatsapp: true }) : {}
  },
  async revealSellerPhone(sellerId) {
    const seller = sellerById(sellerId)
    return seller ? reveal(seller.phone, { whatsapp: seller.whatsapp ?? false }) : {}
  },
  /** DEMO: priced and paid at once, without a payment page (the API answers `pending` and the provider's page). */
  async createPromotionOrder({ listingId, packageId, optionId }, idempotencyKey) {
    const found = promotionOption(optionId)
    if (!found || found.pkg.id !== packageId) throw new Error('unknown promotion option')
    const replay = idempotencyKey ? mockOrderKeys.get(idempotencyKey) : undefined
    const known = replay && mockOrders.get(replay)
    if (known) return { order: known }
    const number = mockSequence('order', 5100)
    const now = new Date().toISOString()
    const order: PromotionOrder = { id: `ord-${number}`, number, listingId, packageId, optionId, amount: found.option.price, status: 'paid', createdAt: now, paidAt: now }
    remember(mockOrders, order.id, order)
    if (idempotencyKey) remember(mockOrderKeys, idempotencyKey, order.id)
    return { order }
  },
  async getPromotionOrder(id) {
    return mockOrders.get(id)
  },
  /** Like the API: only the target's own reason codes (backend-contract.md 4.1); nothing is stored. */
  async submitReport({ target, reason, comment }) {
    if (!isReasonFor(target, reason)) throw new Error('reason: not-for-target')
    if (reason === 'other' && !comment?.trim()) throw new Error('comment: required')
    return { id: `rep-${mockSequence('report', 880)}` }
  },
  async submitSupportMessage() {
    return { ticket: mockSequence('support', 7210) }
  },

  async requestOtp({ phone }) {
    return mockOtp.request(phone)
  },
  async verifyOtp({ challengeId, code }) {
    return mockOtp.verify(challengeId, code)
  },
  /** A new account has no seller page or listings yet in the demo (the cabinet shows its empty state). */
  async register({ otpChallengeId, accountType, fullName, phone, email }) {
    if (!mockOtp.isVerified(otpChallengeId)) throw new Error('phone not verified')
    const user = { id: `u-${mockSequence('user', 2400)}`, fullName: fullName.trim(), email: email?.trim() ?? '', phone: displayPhone(phone), accountType, role: 'user' as const, locale: 'az' as const }
    return { ok: true, user }
  },
  async resetPassword({ otpChallengeId }) {
    return { ok: mockOtp.isVerified(otpChallengeId) }
  },

  /* ---- The demo account (no server session in the mock: see mockAccount) ---- */
  /** DEMO: any well-formed phone or e-mail with an 8-character password signs the demo account in, as the login page does. */
  async login({ login, password }): Promise<LoginResult> {
    const value = login.trim()
    const wellFormed = value.includes('@') ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) : value.replace(/\D/g, '').length >= 9
    if (!wellFormed || password.length < 8) return { ok: false, error: 'wrong-credentials' }
    return { ok: true, user: { ...mockAccount.state.profile } }
  },
  async loginWithOtp({ otpChallengeId }) {
    if (!mockOtp.isVerified(otpChallengeId)) throw new Error('code not verified')
    return { ok: true, user: { ...mockAccount.state.profile } }
  },
  async logout() {},
  async getMe() {
    return { ...mockAccount.state.profile }
  },
  async updateMe(patch) {
    const profile = mockAccount.state.profile
    mockAccount.state.profile = {
      ...profile,
      ...(patch.fullName !== undefined ? { fullName: patch.fullName.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.locale ? { locale: patch.locale } : {}),
    }
    return { ...mockAccount.state.profile }
  },
  /** DEMO: nothing checks the current password; only an empty one is wrong. */
  async changePassword({ current }) {
    return { ok: current.length > 0 }
  },
  async changePhone({ otpChallengeId }) {
    const phone = mockChallengePhone(otpChallengeId)
    if (!phone || !mockOtp.isVerified(otpChallengeId)) throw new Error('code not verified')
    mockAccount.state.profile = { ...mockAccount.state.profile, phone }
    return { ...mockAccount.state.profile }
  },
  async getOwnSeller() {
    const seller = sellerById(mockAccount.state.profile.sellerId)
    return seller && ownSeller(seller)
  },
  async updateOwnSeller(patch) {
    const seller = sellerById(mockAccount.state.profile.sellerId)
    if (!seller) throw new Error('not a business account')
    const { version, businessKinds, ...rest } = patch
    // DEMO: the profile's photos stay in the browser (the profile page keeps them in the session), not here.
    const fields: Partial<SellerProfilePatch> = { ...rest }
    delete fields.logoPhotoId
    delete fields.coverPhotoId
    if (version && version !== String(mockAccount.state.sellerVersion)) throw new Error('the profile changed meanwhile')
    // "" and [] remove a value, as in the API.
    const cleared = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === '' || (Array.isArray(v) && v.length === 0) ? undefined : v]))
    const kinds = orderedKinds(businessKinds)
    mockAccount.state.seller = { ...mockAccount.state.seller, ...cleared, ...(kinds.length > 0 ? { businessKinds: kinds, kind: businessKindsLabel(kinds) } : {}) }
    mockAccount.state.sellerVersion++
    return ownSeller(seller)
  },

  async listFavorites() {
    return [...mockAccount.state.favorites]
  },
  async setFavorite(kind, id, on) {
    const key = `${kind}:${id}`
    const list = mockAccount.state.favorites.filter((k) => k !== key)
    mockAccount.state.favorites = on ? [...list, key] : list
  },
  /** Well-formed keys of things that exist join the end of the list, in their order; at most 500 are read. */
  async mergeFavorites(keys) {
    const known = (key: string) => (key.startsWith('listing:') ? listingById(key.slice(8))?.status === 'active' : key.startsWith('service:') && Boolean(serviceById(key.slice(8))))
    const list = mockAccount.state.favorites
    for (const key of keys.slice(0, 500)) if (known(key) && !list.includes(key)) list.push(key)
    return [...list]
  },
  async listFavoriteItems() {
    const ids = (kind: string) => mockAccount.state.favorites.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1))
    return {
      listings: toPublic(listingsByIds(ids('listing')).filter((l) => l.status === 'active')),
      services: ids('service')
        .map(serviceById)
        .filter((s): s is Service => Boolean(s)),
    }
  },
  async listSavedSearches() {
    return mockAccount.state.searches.map((s) => ({ ...s }))
  },
  async saveSearch({ name, query, alerts }) {
    const filters = filterQuery(query)
    const existing = mockAccount.state.searches.find((s) => s.query === filters)
    if (existing) return { ...Object.assign(existing, { name: name.trim(), alerts }) }
    const search: SavedSearch = { id: `ss-${mockSequence('saved-search', 100)}`, name: name.trim(), query: filters, alerts, createdAt: new Date().toISOString(), newCount: 0 }
    mockAccount.state.searches = [search, ...mockAccount.state.searches].slice(0, MAX_SAVED_SEARCHES)
    return { ...search }
  },
  async updateSavedSearch(id, patch) {
    return { ...Object.assign(savedSearch(id), patch.name !== undefined ? { name: patch.name.trim() } : {}, patch.alerts !== undefined ? { alerts: patch.alerts } : {}) }
  },
  async deleteSavedSearch(id) {
    mockAccount.state.searches = mockAccount.state.searches.filter((s) => s.id !== id)
  },
  async markSavedSearchOpened(id) {
    return { ...Object.assign(savedSearch(id), { newCount: 0 }) }
  },
}

/* ---------- The demo seller's own listings (backend-contract.md 2.2, 3.3) ---------- */

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 10 * 1024 * 1024

/** Answers already given per `Idempotency-Key` (as long as the server process lives). */
const sentByKey = new Map<string, ListingSubmitResult>()

function checkInput(input: ListingInput) {
  if (!input.title.trim() || !input.categoryId || !input.cityId || input.photoIds.length === 0) throw new Error('invalid listing')
}

/** A demo listing as its owner sees it. The demo's numbers are the seller's own, so they count as verified. */
function ownListing(l: Listing): OwnListing {
  const images = l.images.length ? l.images : [l.cover]
  return {
    ...l,
    kind: categoryById(l.categoryId)?.kind ?? 'product',
    contactPhoneVerified: true,
    version: '1',
    photoIds: images.map((_, i) => `${l.id}-foto-${i + 1}`),
  }
}

function ownListingById(id: string): OwnListing | undefined {
  const { sellerId } = mockAccount.state.profile
  const listing = listingById(id)
  return listing && sellerId && listing.sellerId === sellerId ? ownListing(listing) : undefined
}

const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

/** «Yenilə», «Deaktiv et», «Aktiv et»: allowed only from the statuses the API allows. Nothing is stored. */
function changeStatus(id: string, from: Listing['status'][], to: Listing['status']): OwnListing {
  const listing = ownListingById(id)
  if (!listing) throw new Error('listing not found')
  if (!from.includes(listing.status)) throw new Error(`listing is ${listing.status}`)
  const now = Date.now()
  const renewed = listing.status === 'expired' ? { expiresAt: new Date(now + LIFETIME_MS).toISOString() } : {}
  return { ...listing, ...renewed, status: to }
}

function savedSearch(id: string): SavedSearch {
  const found = mockAccount.state.searches.find((s) => s.id === id)
  if (!found) throw new Error('unknown saved search')
  return found
}

/** The demo seller as its owner sees it: the public shape with the business's own number and a version. */
function ownSeller(seller: Seller): OwnSeller {
  return { ...publicSeller({ ...seller, ...mockAccount.state.seller }), ...(seller.phone ? { phone: seller.phone } : {}), version: String(mockAccount.state.sellerVersion) }
}
