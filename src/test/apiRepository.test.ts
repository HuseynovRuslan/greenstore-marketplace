import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeChips, parseSearchState } from '@/features/search/searchState'
import { speciesOptions } from '@/features/search/species'
import { emptySearchState } from '@/features/search/searchUrl'
import { parseServiceQuery } from '@/features/services/query'
import { parsePage } from '@/seo/catalog'
import { API_MAX_AMOUNT, API_MAX_INT, pageParam } from '@/services/apiQuery'
import { ApiError, apiHeaders, apiRepository, isNotImplemented, NotImplementedError, REVALIDATE_SECONDS, send } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import { mockRepository } from '@/services/mockRepository'
import type { Listing, Service } from '@/types'

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }))
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.current }))

interface Call {
  url: URL
  init: RequestInit & { next?: { revalidate?: number; tags?: string[] } }
}

const calls: Call[] = []
let respond: (url: URL) => { status?: number; body?: unknown } = () => ({ body: {} })

function json(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' } })
}

beforeEach(() => {
  calls.length = 0
  respond = () => ({ body: {} })
  vi.stubEnv('API_BASE_URL', 'http://api.test:5080/')
  vi.stubEnv('API_INTERNAL_KEY', 'test-key')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: Call['init']) => {
      const url = new URL(input)
      calls.push({ url, init })
      const { status = 200, body } = respond(url)
      return json(status, body)
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const last = () => calls[calls.length - 1]
const params = (call: Call) => Object.fromEntries(call.url.searchParams)

describe('apiRepository: requests', () => {
  it('reads from API_BASE_URL/api/v1 with the language and the internal key, cached for a minute with tags', async () => {
    respond = () => ({ body: [{ id: 'baki', name: 'Bakı' }] })
    expect(await apiRepository.listCities()).toEqual([{ id: 'baki', name: 'Bakı' }])
    const call = last()
    expect(call.url.origin + call.url.pathname).toBe('http://api.test:5080/api/v1/cities')
    expect(call.init.headers).toEqual({ Accept: 'application/json', 'Accept-Language': 'az', 'X-Internal-Key': 'test-key' })
    expect(call.init.next).toEqual({ revalidate: REVALIDATE_SECONDS, tags: ['taxonomy'] })
    expect(REVALIDATE_SECONDS).toBe(60)
    expect(call.init.cache).toBeUndefined()
  })

  it('never sends the visitor’s IP on a cached public read', async () => {
    requestHeaders.current = new Headers({ 'x-forwarded-for': '203.0.113.7' })
    await apiRepository.getHomeContent()
    expect(last().init.headers).not.toHaveProperty('X-Client-IP')
    // `home` is the tag the API's change notices name for the home page (backend-contract.md 3.6).
    expect(last().init.next?.tags).toEqual(['home', 'listings', 'sellers', 'services'])
  })

  it('sends the catalogue filters as the API’s parameters', async () => {
    respond = () => ({ body: { items: [], total: 0, page: 1, pageCount: 1 } })
    const state = { ...emptySearchState, q: ' zeytun ', categoryId: 'agaclar', subcategory: 'agaclar-meyve', cityIds: ['baki', 'abseron'], min: '50', max: '150', height: '100-200', age: '2-5', root: 'aciq-kok', vip: true, delivery: true, sellerType: 'biznes' as const, species: 'zeytun-agaci' }
    await apiRepository.searchListings({ state, sort: 'price-asc', page: 2, pageSize: 24 })
    expect(last().url.pathname).toBe('/api/v1/listings')
    expect(params(last())).toEqual({
      q: 'zeytun',
      categoryId: 'agaclar',
      subcategoryId: 'agaclar-meyve',
      cityIds: 'baki,abseron',
      minPrice: '50',
      maxPrice: '150',
      promoted: 'true',
      delivery: 'true',
      sellerType: 'business',
      heightMin: '100',
      heightMax: '200',
      ageMin: '2',
      ageMax: '5',
      rootSystem: 'bare-root',
      sort: 'price-asc',
      page: '2',
      pageSize: '24',
    })
    // «Növ» has no API parameter yet.
    expect(last().url.searchParams.has('species')).toBe(false)
  })

  it('brings typed URL values the API would refuse into its ranges, keeping their meaning', async () => {
    respond = () => ({ body: { items: [], total: 0, page: 1, pageCount: 1, displayTotal: 0 } })
    const listingsAt = async (query: string) => {
      await apiRepository.searchListings({ state: parseSearchState(new URLSearchParams(query)), sort: 'newest', page: parsePage(new URLSearchParams(query).get('sehife')), pageSize: 24 })
      return params(last())
    }

    // Prices: never below 0, never above numeric(10,2); a minimum rounds up and a maximum down to whole qəpik.
    expect(await listingsAt('min=-5')).toMatchObject({ minPrice: '0' })
    expect(await listingsAt('max=-1')).toMatchObject({ maxPrice: '0' })
    expect(await listingsAt('max=100000000000')).toMatchObject({ maxPrice: String(API_MAX_AMOUNT) })
    expect(await listingsAt('min=1e20')).toMatchObject({ minPrice: '99999999.99' })
    expect(await listingsAt('min=12.345&max=12.345')).toMatchObject({ minPrice: '12.35', maxPrice: '12.34' })
    expect(await listingsAt('min=1.1&max=0.0000001')).toMatchObject({ minPrice: '1.1', maxPrice: '0' })
    // Heights, ages and pages: whole numbers up to int32.
    expect(await listingsAt('hundurluk=100-99999999999')).toMatchObject({ heightMin: '100', heightMax: String(API_MAX_INT) })
    expect(await listingsAt('hundurluk=3000000000-')).toMatchObject({ heightMin: '2147483647' })
    expect(await listingsAt('yas=1-99999999999999999999999999')).toMatchObject({ ageMin: '1', ageMax: '2147483647' })
    expect(await listingsAt('sehife=99999999999')).toMatchObject({ page: '2147483647' })

    await apiRepository.searchServices(parseServiceQuery(new URLSearchParams('max=100000000000&sehife=99999999999')))
    expect(params(last())).toMatchObject({ maxPrice: '99999999.99', page: '2147483647' })

    await apiRepository.listSellers({ page: parsePage('99999999999') })
    expect(params(last())).toMatchObject({ page: '2147483647' })
  })

  it('never sends a page that is not a page number', () => {
    expect(pageParam(Number.NaN)).toBe('1')
    expect(pageParam(0)).toBe('1')
    expect(pageParam(-3)).toBe('1')
    expect(pageParam(2.7)).toBe('2')
    expect(pageParam(Number.POSITIVE_INFINITY)).toBe('2147483647')
  })

  it('narrows to one seller and tags the read with it', async () => {
    respond = () => ({ body: { items: [], total: 0, page: 1, pageSize: 60, pageCount: 1 } })
    await apiRepository.searchListings({ state: emptySearchState, sort: 'newest', page: 1, pageSize: 60, sellerId: 'f00d' })
    expect(params(last())).toEqual({ sellerId: 'f00d', sort: 'newest', page: '1', pageSize: '60' })
    expect(last().init.next?.tags).toEqual(['listings', 'seller:f00d'])
  })

  it('asks for the facet counts with the filters only', async () => {
    const facets = { categories: { all: 3, byId: { agaclar: 3 } }, subcategories: {}, cities: { all: 3, byCity: { baki: 2 } } }
    respond = () => ({ body: facets })
    expect(await apiRepository.getFacetCounts({ ...emptySearchState, categoryId: 'agaclar', cityIds: ['baki'] })).toEqual(facets)
    expect(last().url.pathname).toBe('/api/v1/listings/facets')
    expect(params(last())).toEqual({ categoryId: 'agaclar', cityIds: 'baki' })
  })

  it('counts, pages sellers and services, and follows sitemap cursors', async () => {
    respond = (url) =>
      url.pathname.endsWith('/count')
        ? { body: { count: 7 } }
        : url.pathname.startsWith('/api/v1/sitemap')
          ? { body: { items: [{ slug: 'a-1', updatedAt: '2026-11-01T10:00:00Z' }], nextCursor: '10482' } }
          : { body: { items: [], total: 0, page: 1, pageCount: 1, displayTotal: 0 } }

    expect(await apiRepository.countListings({ categoryId: 'agaclar', cityId: 'baki' })).toBe(7)
    expect(params(last())).toEqual({ categoryId: 'agaclar', cityId: 'baki' })

    await apiRepository.listSellers({ businessKind: 'garden-centre', cityId: 'quba', page: 2, pageSize: 1 })
    expect(last().url.pathname).toBe('/api/v1/sellers')
    expect(params(last())).toEqual({ businessKind: 'garden-centre', cityId: 'quba', page: '2', pageSize: '1' })

    await apiRepository.searchServices({ q: 'suvarma', categoryId: 'avtomatik-suvarma', cityId: 'quba', tab: 'sirketler', minPrice: 10, maxPrice: 200, sort: 'price-desc', page: 3 })
    expect(params(last())).toEqual({ q: 'suvarma', categoryId: 'avtomatik-suvarma', cityId: 'quba', providerKind: 'company', minPrice: '10', maxPrice: '200', sort: 'price-desc', page: '3', pageSize: '6' })

    expect(await apiRepository.listSitemapEntries('seller', '10400')).toEqual({ items: [{ slug: 'a-1', updatedAt: '2026-11-01T10:00:00Z' }], nextCursor: '10482' })
    expect(last().url.pathname).toBe('/api/v1/sitemap/seller')
    expect(params(last())).toEqual({ cursor: '10400' })
  })

  it('asks for the related lists by id and escapes path segments', async () => {
    respond = () => ({ body: { fromSeller: [], similar: [], fromProvider: [] } })
    await apiRepository.getRelatedListings({ id: '0193-a' } as Listing)
    expect(last().url.pathname).toBe('/api/v1/listings/0193-a/related')
    await apiRepository.getRelatedServices({ id: '0193-b' } as Service)
    expect(last().url.pathname).toBe('/api/v1/services/0193-b/related')
    await apiRepository.getPublicListing('a/b c')
    expect(last().url.pathname).toBe('/api/v1/listings/a%2Fb%20c')
  })
})

describe('apiRepository: answers', () => {
  it('turns a 404 of a single read into undefined', async () => {
    respond = () => ({ status: 404, body: { status: 404, code: 'listing.not-found' } })
    expect(await apiRepository.getPublicListing('yoxdur-1')).toBeUndefined()
    expect(await apiRepository.getSeller('yoxdur')).toBeUndefined()
    expect(await apiRepository.getSellerById('yoxdur')).toBeUndefined()
    expect(await apiRepository.getService('yoxdur')).toBeUndefined()
    expect(await apiRepository.getServiceProvider('yoxdur')).toBeUndefined()
    expect(await apiRepository.getProductCategory('yoxdur')).toBeUndefined()
    expect(await apiRepository.listProviderServices('yoxdur')).toEqual([])
  })

  it('throws other failures with the problem’s code', async () => {
    respond = () => ({ status: 400, body: { status: 400, code: 'validation' } })
    const error = await apiRepository.searchListings({ state: emptySearchState, sort: 'newest', page: 1, pageSize: 24 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, code: 'validation' })
    respond = () => ({ status: 503, body: undefined })
    await expect(apiRepository.getPublicListing('x-1')).rejects.toMatchObject({ status: 503, code: undefined })
  })

  it('keeps the product catalogue to product categories', async () => {
    respond = () => ({ body: { id: 'bag-xidmetleri', slug: 'bag-xidmetleri', name: 'Bağ xidmətləri', icon: 'shovel', listingCount: 6, kind: 'service' } })
    expect(await apiRepository.getProductCategory('bag-xidmetleri')).toBeUndefined()
    respond = () => ({ body: [{ id: 'baki', name: 'Bakı' }, { id: 'quba', name: 'Quba' }] })
    expect(await apiRepository.getCity('quba')).toEqual({ id: 'quba', name: 'Quba' })
    expect(await apiRepository.getCity('paris')).toBeUndefined()
  })

  it('says which later phase brings a method that has no endpoint yet', async () => {
    const error = await apiRepository.submitReport({} as never).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NotImplementedError)
    expect(isNotImplemented(error)).toBe(true)
    expect((error as Error).message).toBe('DATA_SOURCE=api: submitReport is not implemented yet (phase 4).')
    await expect(apiRepository.submitServiceRequest({} as never)).rejects.toThrow('(phase 4)')
    await expect(apiRepository.submitSupportMessage({} as never)).rejects.toThrow('(phase 4)')
    await expect(apiRepository.createPromotionOrder({} as never)).rejects.toThrow('(phase 5)')
    await expect(apiRepository.listPromotionPackages()).rejects.toThrow('(phase 5)')
    expect(calls).toHaveLength(0)
  })

  it('refuses to run without API_BASE_URL', async () => {
    vi.stubEnv('API_BASE_URL', '')
    await expect(apiRepository.listCities()).rejects.toThrow(/API_BASE_URL/)
  })
})

describe('apiRepository: per-visitor calls', () => {
  it('sends X-Client-IP only together with the internal key', () => {
    expect(apiHeaders({ clientIp: '203.0.113.7' }, { API_INTERNAL_KEY: 'k' })).toMatchObject({ 'X-Internal-Key': 'k', 'X-Client-IP': '203.0.113.7' })
    expect(apiHeaders({ clientIp: '203.0.113.7' }, {})).toEqual({ Accept: 'application/json', 'Accept-Language': 'az' })
  })

  it('posts uncached with the visitor’s IP', async () => {
    requestHeaders.current = new Headers({ 'x-forwarded-for': '198.51.100.4' })
    respond = () => ({ body: { id: 'r-1' } })
    expect(await send<{ id: string }>('reports', { method: 'POST', body: { reason: 'other' } })).toEqual({ id: 'r-1' })
    expect(last().init).toMatchObject({ method: 'POST', cache: 'no-store', body: '{"reason":"other"}' })
    expect(last().init.headers).toMatchObject({ 'X-Client-IP': '198.51.100.4', 'X-Internal-Key': 'test-key', 'Content-Type': 'application/json' })
    expect(last().init.next).toBeUndefined()
  })

  it('passes the address the proxy appended, not the one a browser put first', async () => {
    // A visitor's own "X-Forwarded-For: 203.0.113.5", then the hosting's proxy appends the address it saw.
    requestHeaders.current = new Headers({ 'x-forwarded-for': '203.0.113.5, 198.51.100.9' })
    await send('reports', { method: 'POST', body: {} })
    expect(last().init.headers).toMatchObject({ 'X-Client-IP': '198.51.100.9' })
  })
})

describe('getRepository', () => {
  it('serves the mock unless DATA_SOURCE=api', () => {
    expect(getRepository()).toBe(mockRepository)
    vi.stubEnv('DATA_SOURCE', 'api')
    expect(getRepository()).toBe(apiRepository)
    vi.stubEnv('DATA_SOURCE', 'mock')
    expect(getRepository()).toBe(mockRepository)
  })
})

describe('«Növ» with DATA_SOURCE=api', () => {
  const olive = new URLSearchParams('nov=zeytun-agaci')

  it('filters an older link in mock mode, as before', () => {
    const state = parseSearchState(olive)
    expect(state.species).toBe('zeytun-agaci')
    expect(activeChips(state).map((c) => c.key)).toEqual(['species'])
    expect(speciesOptions('').length).toBeGreaterThan(0)
  })

  it('knows no species with the API, so no chip claims a filter the results do not apply', () => {
    vi.stubEnv('DATA_SOURCE', 'api')
    const state = parseSearchState(olive)
    expect(state.species).toBe('')
    expect(activeChips(state)).toEqual([])
    expect(speciesOptions('')).toEqual([])
  })
})
