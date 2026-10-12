/** `MarketplaceRepository` over the Figma demo data in `src/data` (DATA_SOURCE=mock). */
import { categoryById, productCategories } from '@/data/categories'
import { cities } from '@/data/cities'
import { latestListingIds, listingBySlug, listingsByIds, publicListings, vipListingIds } from '@/data/listings'
import { featuredSellerIds, sellerById, sellerBySlug, sellers } from '@/data/sellers'
import { homeServices, providerById, serviceById, serviceBySlug, services } from '@/data/services'
import { otherSellerListings, similarListings } from '@/features/listing/detail'
import { runSearch } from '@/features/search/searchState'
import { searchServices } from '@/features/services/query'
import { filterListings } from './marketplace'
import type { MarketplaceRepository, PageResult } from './repository'
import type { Seller, Service } from '@/types'

function page<T>(all: T[], requested: number, size: number): PageResult<T> {
  const pageCount = Math.max(1, Math.ceil(all.length / size))
  const current = Math.min(Math.max(1, requested), pageCount)
  return { items: all.slice((current - 1) * size, current * size), total: all.length, page: current, pageCount }
}

export const mockRepository: MarketplaceRepository = {
  async listProductCategories() {
    return productCategories
  },
  async getProductCategory(id) {
    const category = categoryById(id)
    return category?.kind === 'product' ? category : undefined
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
}
