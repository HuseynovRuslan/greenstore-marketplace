import type { MetadataRoute } from 'next'
import type { MarketplaceRepository, SitemapEntry, SitemapKind } from '@/services/repository'
import { categoryIndexRule, categoryPath } from './catalog'
import { dataSource, isIndexable, PRIVATE_PATHS, siteUrl } from './env'
import { absoluteUrl } from './site'

/**
 * robots.txt. While the site is not indexable (staging, demo data) every crawler is asked to stay out;
 * in production the private areas are excluded and the sitemap is announced.
 */
export function buildRobots(indexable = isIndexable()): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: '*', disallow: '/' } }
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...PRIVATE_PATHS] },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl(),
  }
}

/** A sitemap file holds at most 50,000 URLs; the API pages its entries 1,000 at a time. */
const MAX_SITEMAP_PAGES = 45

/** Every entry of one kind, following the API's cursor (the mock answers in one page). */
export async function allSitemapEntries(repo: MarketplaceRepository, kind: SitemapKind): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_SITEMAP_PAGES; page++) {
    const result = await repo.listSitemapEntries(kind, cursor)
    entries.push(...result.items)
    if (!result.nextCursor || result.nextCursor === cursor) break
    cursor = result.nextCursor
  }
  return entries
}

/**
 * Every indexable public URL: home, catalogues, category pages that pass the inventory threshold, listings,
 * sellers and services. Filtered, sorted and private URLs are never listed. `lastModified` is only set where the
 * data has a date (`updatedAt` of the sitemap entries); nothing is invented for the other pages.
 */
export async function buildSitemap(repo: MarketplaceRepository): Promise<MetadataRoute.Sitemap> {
  const [categories, cities, listings, sellers, services] = await Promise.all([
    repo.listProductCategories(),
    repo.listCities(),
    allSitemapEntries(repo, 'listing'),
    allSitemapEntries(repo, 'seller'),
    allSitemapEntries(repo, 'service'),
  ])

  const categoryUrls: string[] = []
  for (const category of categories) {
    if (categoryIndexRule(await repo.countListings({ categoryId: category.id }))) categoryUrls.push(categoryPath(category.id))
    for (const city of cities) {
      const count = await repo.countListings({ categoryId: category.id, cityId: city.id })
      if (categoryIndexRule(count, city.id)) categoryUrls.push(categoryPath(category.id, city.id))
    }
  }

  const entry = (path: string, e: SitemapEntry) => ({ url: absoluteUrl(path), ...(e.updatedAt ? { lastModified: new Date(e.updatedAt) } : {}) })
  return [
    { url: absoluteUrl('/') },
    { url: absoluteUrl('/elanlar') },
    { url: absoluteUrl('/xidmetler') },
    { url: absoluteUrl('/saticilar') },
    ...['/reklam', '/komek', '/qaydalar', '/tehlukesiz-alis', '/elaqe', '/istifade-sertleri', '/mexfilik', '/sayt-xeritesi'].map((path) => ({ url: absoluteUrl(path) })),
    ...categoryUrls.map((path) => ({ url: absoluteUrl(path) })),
    ...listings.map((e) => entry(`/elanlar/${e.slug}`, e)),
    ...sellers.map((e) => entry(`/saticilar/${e.slug}`, e)),
    ...services.map((e) => entry(`/xidmetler/${e.slug}`, e)),
  ]
}

/**
 * The slugs a dynamic route prerenders at build time. The mock's few demo pages are all built as before; with the
 * API none are (backend-contract.md 1.1): a page is rendered on its first visit and then served from the cache
 * (`revalidate: 60` on its reads), so a build never waits for thousands of listings.
 */
export async function prerenderedSlugs(repo: MarketplaceRepository, kind: SitemapKind, source = dataSource()): Promise<Array<{ slug: string }>> {
  if (source === 'api') return []
  return (await allSitemapEntries(repo, kind)).map((e) => ({ slug: e.slug }))
}
