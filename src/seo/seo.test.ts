import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptySearchState, parseSearchState } from '@/features/search/searchState'
import { listings } from '@/data/listings'
import { sellerBySlug } from '@/data/sellers'
import { services } from '@/data/services'
import { mockRepository } from '@/services/mockRepository'
import { catalogRule, categoryPageRule, parsePage } from './catalog'
import { dataSource, isIndexable, siteUrl } from './env'
import { breadcrumbJsonLd, listingJsonLd, sellerJsonLd, serviceJsonLd } from './jsonld'
import { describe as describeText, pageMetadata, robotsFor } from './metadata'
import { buildRobots, buildSitemap } from './sitemap'

const state = (query: string) => parseSearchState(new URLSearchParams(query))

describe('indexing switch', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is off unless SEO_INDEXABLE=true and the data source is not mock', () => {
    expect(isIndexable({})).toBe(false)
    expect(isIndexable({ SEO_INDEXABLE: 'true' })).toBe(false)
    expect(isIndexable({ SEO_INDEXABLE: 'true', DATA_SOURCE: 'mock' })).toBe(false)
    expect(isIndexable({ SEO_INDEXABLE: 'false', DATA_SOURCE: 'api' })).toBe(false)
    expect(isIndexable({ SEO_INDEXABLE: 'true', DATA_SOURCE: 'api' })).toBe(true)
    expect(dataSource({ DATA_SOURCE: 'something' })).toBe('mock')
  })

  it('takes the public origin from NEXT_PUBLIC_SITE_URL, then Vercel, then localhost', () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: 'https://staging.example.az/' })).toBe('https://staging.example.az')
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'greenstore.vercel.app', VERCEL_URL: 'x.vercel.app' })).toBe('https://greenstore.vercel.app')
    expect(siteUrl({ VERCEL_URL: 'greenstore-git-x.vercel.app' })).toBe('https://greenstore-git-x.vercel.app')
    expect(siteUrl({})).toBe('http://localhost:3000')
  })

  it('forces noindex,nofollow in page metadata while the site is not indexable', () => {
    vi.stubEnv('SEO_INDEXABLE', 'true')
    vi.stubEnv('DATA_SOURCE', 'mock')
    expect(robotsFor(true, true)).toEqual({ index: false, follow: false })
    vi.stubEnv('DATA_SOURCE', 'api')
    expect(robotsFor(true, true)).toEqual({ index: true, follow: true })
    expect(robotsFor(false, true)).toEqual({ index: false, follow: true })
  })

  it('builds canonical, Open Graph and Twitter metadata', () => {
    const meta = pageMetadata({ title: 'Zeytun ağacı', description: 'Təsvir', canonical: '/elanlar/zeytun', images: [{ url: '/images/home/hero-botanika.webp' }] })
    expect(meta.alternates).toEqual({ canonical: '/elanlar/zeytun' })
    expect(meta.openGraph).toMatchObject({ title: 'Zeytun ağacı', url: '/elanlar/zeytun', locale: 'az_AZ', images: [{ url: '/images/home/hero-botanika.webp' }] })
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image' })
    expect(pageMetadata({ title: 'x', description: 'y' }).alternates).toBeUndefined()
  })

  it('shortens meta descriptions at a word boundary', () => {
    const text = 'söz '.repeat(80)
    const short = describeText(text)
    expect(short.length).toBeLessThanOrEqual(160)
    expect(short.endsWith('…')).toBe(true)
    expect(describeText('qısa  mətn')).toBe('qısa mətn')
  })
})

describe('catalogue canonical and indexing rules', () => {
  it('indexes the plain catalogue and its pages with self-canonicals', () => {
    expect(catalogRule(emptySearchState, 16, 1)).toEqual({ index: true, follow: true, canonical: '/elanlar' })
    expect(catalogRule(emptySearchState, 40, 2)).toEqual({ index: true, follow: true, canonical: '/elanlar?sehife=2' })
  })

  it('ignores sort and view parameters', () => {
    expect(catalogRule(state('siralama=ucuz&gorunus=siyahi'), 16, 1).canonical).toBe('/elanlar')
  })

  it('canonicalises a single category (and one city) to the category pages', () => {
    expect(catalogRule(state('kateqoriya=agaclar'), 10, 1)).toEqual({ index: true, follow: true, canonical: '/kateqoriyalar/agaclar' })
    expect(catalogRule(state('kateqoriya=agaclar&seher=abseron'), 6, 1).canonical).toBe('/kateqoriyalar/agaclar/abseron')
  })

  it('does not index thin category × city combinations', () => {
    expect(catalogRule(state('kateqoriya=agaclar&seher=baki'), 2, 1)).toEqual({ index: false, follow: true })
    expect(categoryPageRule('agaclar', 'baki', 2, 1)).toEqual({ index: false, follow: true, canonical: '/kateqoriyalar/agaclar/baki' })
    expect(categoryPageRule('agaclar', 'abseron', 3, 1).index).toBe(true)
    expect(categoryPageRule('cim-toxumlar', undefined, 0, 1).index).toBe(false)
  })

  it('keeps search queries and filter combinations out of the index but followable', () => {
    for (const query of ['q=zeytun', 'kateqoriya=agaclar&min=30', 'seher=baki,abseron', 'kateqoriya=agaclar&seher=baki,abseron', 'vip=1', 'catdirilma=1', 'saticiNovu=biznes']) {
      expect(catalogRule(state(query), 5, 1)).toEqual({ index: false, follow: true })
    }
  })

  it('treats invalid page numbers as page 1', () => {
    expect(parsePage(null)).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-2')).toBe(1)
    expect(parsePage('2.5')).toBe(1)
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('3')).toBe(3)
  })
})

describe('robots.txt and sitemap', () => {
  it('disallows everything while the site is not indexable', () => {
    expect(buildRobots(false)).toEqual({ rules: { userAgent: '*', disallow: '/' } })
  })

  it('excludes private areas and announces the sitemap when indexable', () => {
    const robots = buildRobots(true)
    expect(robots.rules).toMatchObject({ userAgent: '*', allow: '/' })
    expect((robots.rules as { disallow: string[] }).disallow).toEqual(expect.arrayContaining(['/kabinet', '/elan-yerlesdir', '/idareetme']))
    expect(robots.sitemap).toMatch(/\/sitemap\.xml$/)
  })

  it('lists public pages only: active listings, sellers, services and category pages above the threshold', async () => {
    const urls = (await buildSitemap(mockRepository)).map((e) => new URL(e.url).pathname)
    const active = listings.filter((l) => l.status === 'active')
    const hidden = listings.filter((l) => l.status !== 'active')
    expect(hidden.length).toBeGreaterThan(0)

    for (const l of active) expect(urls).toContain(`/elanlar/${l.slug}`)
    for (const l of hidden) expect(urls).not.toContain(`/elanlar/${l.slug}`)
    for (const s of services) expect(urls).toContain(`/xidmetler/${s.slug}`)
    expect(urls).toEqual(expect.arrayContaining(['/', '/elanlar', '/xidmetler', '/saticilar/abseron-tingcilik', '/kateqoriyalar/agaclar']))
    // Categories without listings and thin category × city pages are left out.
    expect(urls).not.toContain('/kateqoriyalar/cim-toxumlar')
    expect(urls).toContain('/kateqoriyalar/agaclar/baki') // 3 listings
    expect(urls).not.toContain('/kateqoriyalar/agaclar/quba') // 1 listing
    expect(urls.some((u) => /^\/(kabinet|secilmisler|elan-yerlesdir|idareetme|daxil-ol|qeydiyyat)/.test(u))).toBe(false)
    expect(urls.some((u) => u.includes('?'))).toBe(false)
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('structured data', () => {
  const listing = listings.find((l) => l.slug === 'zeytun-agaci-olea-europaea')!
  const seller = sellerBySlug('abseron-tingcilik')!

  it('builds BreadcrumbList with absolute URLs, no URL for the current page and no #anchors', () => {
    const data = breadcrumbJsonLd([{ name: 'Ana səhifə', path: '/' }, { name: 'Satıcılar', path: '/#saticilar' }, { name: 'Abşeron Tingçilik' }])
    expect(data.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Ana səhifə', item: 'http://localhost:3000/' },
      { '@type': 'ListItem', position: 2, name: 'Abşeron Tingçilik' },
    ])
  })

  it('describes a listing as Product + Offer without invented properties', () => {
    const data = listingJsonLd(listing, { images: listing.images, seller }) as { '@type': string; offers: Record<string, unknown> }
    expect(data['@type']).toBe('Product')
    expect(data.offers).toMatchObject({ '@type': 'Offer', price: 145, priceCurrency: 'AZN' })
    expect(data.offers.seller).toMatchObject({ '@type': 'Organization', name: 'Abşeron Tingçilik' })
    const json = JSON.stringify(data)
    for (const invented of ['aggregateRating', 'review', 'availability', 'itemCondition', 'priceValidUntil', 'brand']) {
      expect(json).not.toContain(invented)
    }
  })

  it('keeps individual sellers out of structured data', () => {
    expect(sellerJsonLd({ ...seller, type: 'individual' })).toBeUndefined()
    expect(listingJsonLd(listing, { images: [], seller: { ...seller, type: 'individual' } })).not.toHaveProperty('offers.seller')
    expect(sellerJsonLd(seller)).toMatchObject({ '@type': 'LocalBusiness', name: 'Abşeron Tingçilik', telephone: '+994 50 555 12 34' })
  })

  it('describes services without turning price labels into offers', () => {
    const data = serviceJsonLd(services[0], { categoryName: 'Landşaft dizaynı' })
    expect(data).toMatchObject({ '@type': 'Service', serviceType: 'Landşaft dizaynı' })
    expect(data).not.toHaveProperty('offers')
  })
})
