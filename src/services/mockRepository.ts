/** `MarketplaceRepository` over the Figma demo data in `src/data` (DATA_SOURCE=mock). */
import { categoryById, productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { latestListingIds, listingById, listingBySlug, listings, listingsByIds, publicListings, vipListingIds } from '@/data/listings'
import { promotionOption, promotionPackages } from '@/data/promotions'
import { featuredSellerIds, sellerById, sellerBySlug, sellers } from '@/data/sellers'
import { homeServices, providerById, serviceById, serviceBySlug, services } from '@/data/services'
import { otherSellerListings, similarListings } from '@/features/listing/detail'
import { runSearch } from '@/features/search/searchState'
import { searchServices } from '@/features/services/query'
import { filterListings } from './marketplace'
import { mockListingStats, mockOtp, mockSequence } from './mockWrites'
import type { MarketplaceRepository, PageResult } from './repository'
import type { Category, Seller, Service } from '@/types'
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
      vip: listingsByIds(vipListingIds),
      latest: listingsByIds(latestListingIds),
      sellers: featuredSellerIds.map(sellerById).filter((s): s is Seller => Boolean(s)),
      services: homeServices
        .map(({ id, image }) => ({ service: serviceById(id), image }))
        .filter((s): s is { service: Service; image: string } => Boolean(s.service)),
    }
  },
  async searchListings({ state, sort, page: requested, pageSize }) {
    return page(runSearch(state, sort), requested, pageSize)
  },
  async countListings({ categoryId, cityId }) {
    return filterListings(publicListings, { categoryId, cityIds: cityId ? [cityId] : undefined }).length
  },
  async listPublicListings() {
    return publicListings
  },
  async getPublicListing(slug) {
    const listing = listingBySlug(slug)
    return listing?.status === 'active' ? listing : undefined
  },
  async getRelatedListings(listing) {
    const fromSeller = otherSellerListings(listing)
    return { fromSeller, similar: similarListings(listing, fromSeller) }
  },

  async listSellers() {
    return sellers
  },
  async getSeller(slug) {
    return sellerBySlug(slug)
  },
  async getSellerById(id) {
    return sellerById(id)
  },

  async searchServices(query) {
    const result = searchServices(query)
    return { items: result.items, total: result.total, page: result.page, pageCount: result.pageCount, displayTotal: result.displayTotal }
  },
  async listServices() {
    return services
  },
  async getService(slug) {
    return serviceBySlug(slug)
  },
  async getServiceProvider(id) {
    return providerById(id)
  },

  /* ---- Nov 2026 additions (docs/handoff/contract-additions.md) ---- */
  async listProviderServices(providerId) {
    return services.filter((s) => s.providerId === providerId)
  },
  async listOwnListings(sellerId) {
    return listings.filter((l) => l.sellerId === sellerId)
  },
  async getListingStats(listingId) {
    const listing = listingById(listingId)
    return listing ? mockListingStats(listing) : undefined
  },
  async listPromotionPackages() {
    return promotionPackages
  },

  async submitListing(input) {
    if (!input.title.trim() || !input.categoryId || !input.cityId || input.photoIds.length === 0) throw new Error('invalid listing')
    const number = mockSequence('listing', 10540)
    return { id: `elan-${number}`, slug: `elan-${number}`, number, status: 'pending' }
  },
  async revealPhone(listingId) {
    const listing = listingById(listingId)
    if (!listing || listing.phoneHidden) return {}
    return { phone: listing.contactPhone ?? sellerById(listing.sellerId)?.phone }
  },
  async createPromotionOrder({ listingId, packageId, optionId }) {
    const found = promotionOption(optionId)
    if (!found || found.pkg.id !== packageId) throw new Error('unknown promotion option')
    return { id: `ord-${mockSequence('order', 5100)}`, listingId, packageId, optionId, amount: found.option.price, status: 'paid', createdAt: new Date().toISOString() }
  },
  async submitReport() {
    return { id: `rep-${mockSequence('report', 880)}` }
  },
  async submitSupportMessage() {
    return { ticket: mockSequence('support', 7210) }
  },
  async submitServiceRequest() {
    const number = mockSequence('service-request', 3021)
    return { id: `req-${number}`, number }
  },

  async requestOtp({ phone }) {
    return mockOtp.request(phone)
  },
  async verifyOtp({ challengeId, code }) {
    return mockOtp.verify(challengeId, code)
  },
  async register({ otpChallengeId }) {
    if (!mockOtp.isVerified(otpChallengeId)) throw new Error('phone not verified')
    return { userId: `u-${mockSequence('user', 2400)}` }
  },
  async resetPassword({ otpChallengeId }) {
    return { ok: mockOtp.isVerified(otpChallengeId) }
  },
}
