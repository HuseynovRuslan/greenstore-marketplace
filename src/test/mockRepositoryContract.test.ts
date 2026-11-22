import { describe, expect, it } from 'vitest'
import { listings, publicListings } from '@/data/listings'
import { providers, services } from '@/data/services'
import { sellers } from '@/data/sellers'
import { emptySearchState } from '@/features/search/searchUrl'
import { loadSellerListings } from '@/features/seller/sellerListingQuery'
import { allSitemapEntries, prerenderedSlugs } from '@/seo/sitemap'
import { mockRepository as repo } from '@/services/mockRepository'

/** The last 9 digits of every number in the demo data (and the demo number of service providers). */
const knownNumbers = [
  ...listings.map((l) => l.contactPhone),
  ...sellers.map((s) => s.phone),
  ...providers.map((p) => p.phone),
  '+994 50 555 12 34',
]
  .filter((p): p is string => Boolean(p))
  .map((p) => p.replace(/\D/g, '').slice(-9))

/** Every number-like run of digits in a value's strings, so "+994 50 555 12 34" and "994505551234" both count. */
function digitRuns(value: unknown): string[] {
  const strings: string[] = []
  JSON.stringify(value, (_key, v) => (typeof v === 'string' && strings.push(v), v))
  return strings.map((s) => s.replace(/\D/g, '')).filter((d) => d.length >= 9)
}

const leaks = (value: unknown) => digitRuns(value).filter((d) => knownNumbers.some((n) => d.includes(n)))

describe('mock repository: public reads carry no phone numbers (backend-contract.md 3.1)', () => {
  it('knows the demo numbers it checks for', () => {
    expect(knownNumbers.length).toBeGreaterThan(10)
    expect(leaks({ contactPhone: '+994 50 555 12 34' })).toHaveLength(1)
  })

  it('masks listing, seller and provider numbers', async () => {
    const zeytun = (await repo.getPublicListing('zeytun-agaci-olea-europaea'))!
    expect(zeytun).not.toHaveProperty('contactPhone')
    expect(zeytun.phoneMasked).toBe('+994 50 *** ** 34')
    expect(zeytun.subcategoryId).toBe('agaclar-meyve')

    const limon = (await repo.getPublicListing('limon-agaci'))!
    expect(limon.phoneHidden).toBe(true)
    expect(limon).not.toHaveProperty('contactPhone')
    expect(limon).not.toHaveProperty('phoneMasked')

    const seller = (await repo.getSeller('abseron-tingcilik'))!
    expect(seller).not.toHaveProperty('phone')
    expect(seller.phoneMasked).toBe('+994 50 *** ** 34')

    const provider = (await repo.getServiceProvider('aquabag'))!
    expect(provider).not.toHaveProperty('phone')
    expect(provider.phoneMasked).toMatch(/^\+994 \d\d \*\*\* \*\* \d\d$/)
  })

  it('leaves no number in any public read', async () => {
    const reads: unknown[] = [await repo.getHomeContent()]
    for (let page = 1; ; page++) {
      const result = await repo.searchListings({ state: emptySearchState, sort: 'newest', page, pageSize: 20 })
      reads.push(result)
      if (page >= result.pageCount) break
    }
    for (const l of publicListings) {
      const listing = (await repo.getPublicListing(l.slug))!
      reads.push(listing, await repo.getRelatedListings(listing))
    }
    for (const s of sellers) reads.push(await repo.getSeller(s.slug), await repo.getSellerById(s.id), await repo.listProviderServices(s.id))
    reads.push(await repo.listSellers({ page: 1, pageSize: 60 }))
    for (const s of services) {
      const service = (await repo.getService(s.slug))!
      reads.push(service, await repo.getServiceProvider(service.providerId), await repo.getRelatedServices(service), await repo.listProviderServices(service.providerId))
    }
    reads.push(await repo.searchServices({ q: '', tab: 'all', sort: 'newest', page: 1 }))
    expect(leaks(reads)).toEqual([])
  })

  it('gives a number only through «Nömrəni göstər»', async () => {
    expect(await repo.revealPhone('zeytun-agaci')).toEqual({ phone: '+994 50 555 12 34', whatsappUrl: 'https://wa.me/994505551234' })
    expect((await repo.revealPhone('landsaft-dizayni')).phone).toBeTruthy()
    expect(await repo.revealSellerPhone('abseron-tingcilik')).toEqual({ phone: '+994 50 555 12 34', whatsappUrl: 'https://wa.me/994505551234' })
    expect(await repo.revealSellerPhone('yoxdur')).toEqual({})
    expect(await repo.revealPhone('yoxdur')).toEqual({})
  })
})

describe('mock repository: phase 1 methods', () => {
  it('lists the sitemap entries: public listings with their latest date, every seller and service', async () => {
    const entries = await repo.listSitemapEntries('listing')
    expect(entries.nextCursor).toBeUndefined()
    expect(entries.items.map((e) => e.slug)).toEqual(publicListings.map((l) => l.slug))
    for (const e of entries.items) {
      const l = publicListings.find((x) => x.slug === e.slug)!
      expect(e.updatedAt! >= l.publishedAt).toBe(true)
    }
    expect((await allSitemapEntries(repo, 'seller')).map((e) => e.slug)).toEqual(sellers.map((s) => s.slug))
    expect((await allSitemapEntries(repo, 'service')).every((e) => e.updatedAt === undefined)).toBe(true)
  })

  it('prerenders the demo’s pages, and none with the API', async () => {
    expect(await prerenderedSlugs(repo, 'service', 'mock')).toEqual(services.map((s) => ({ slug: s.slug })))
    expect(await prerenderedSlugs(repo, 'listing', 'api')).toEqual([])
  })

  it('pages the sellers directory: businesses only, by kind and city', async () => {
    const all = await repo.listSellers({ page: 1 })
    expect(all.items.every((s) => s.type === 'business')).toBe(true)
    expect(all.total).toBe(sellers.filter((s) => s.type === 'business').length)
    const nurseries = await repo.listSellers({ businessKind: 'nursery', page: 1 })
    expect(nurseries.items.map((s) => s.slug)).toEqual(['abseron-tingcilik', 'quba-fidan'])
    expect((await repo.listSellers({ businessKind: 'nursery', cityId: 'quba', page: 1 })).items.map((s) => s.slug)).toEqual(['quba-fidan'])
    const second = await repo.listSellers({ page: 2, pageSize: 1 })
    expect(second).toMatchObject({ page: 2, pageCount: all.total, total: all.total })
    expect(second.items).toHaveLength(1)
  })

  it('lists a business’s services by its seller id, like the seller page always showed', async () => {
    for (const seller of sellers) {
      const before = services.filter((s) => seller.serviceIds?.includes(s.id) || s.providerId === seller.id)
      expect((await repo.listProviderServices(seller.id)).map((s) => s.id), seller.slug).toEqual(before.map((s) => s.id))
    }
    expect((await repo.listProviderServices('yasil-mekan-landsaft')).map((s) => s.id)).toEqual(['landsaft-dizayni', 'cim-salinmasi'])
  })

  it('relates services like the service page did: the provider’s others, then the same kind of work first', async () => {
    for (const service of services) {
      const own = services.filter((s) => s.providerId === service.providerId && s.id !== service.id).slice(0, 4)
      const shown = new Set([service.id, ...own.map((s) => s.id)])
      const rest = services.filter((s) => !shown.has(s.id))
      const similar = [...rest.filter((s) => s.categoryId === service.categoryId), ...rest.filter((s) => s.categoryId !== service.categoryId)].slice(0, 4)
      const related = await repo.getRelatedServices(service)
      expect(related.fromProvider.map((s) => s.id), service.id).toEqual(own.map((s) => s.id))
      expect(related.similar.map((s) => s.id), service.id).toEqual(similar.map((s) => s.id))
    }
  })

  it('narrows the catalogue to one seller', async () => {
    const own = await repo.searchListings({ state: emptySearchState, sort: 'newest', page: 1, pageSize: 60, sellerId: 'abseron-tingcilik' })
    expect(own.total).toBe(publicListings.filter((l) => l.sellerId === 'abseron-tingcilik').length)
    expect(own.items.every((l) => l.sellerId === 'abseron-tingcilik')).toBe(true)
    const loaded = await loadSellerListings(repo, 'abseron-tingcilik')
    expect(loaded.map((l) => l.id).sort()).toEqual(own.items.map((l) => l.id).sort())
  })
})
