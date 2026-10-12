import type { MetadataRoute } from 'next'
import type { MarketplaceRepository } from '@/services/repository'
import { categoryIndexRule, categoryPath } from './catalog'
import { isIndexable, PRIVATE_PATHS, siteUrl } from './env'
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

/**
 * Every indexable public URL: home, catalogues, category pages that pass the inventory threshold, listings,
 * sellers and services. Filtered, sorted and private URLs are never listed. `lastModified` is only set where the
 * data has a date (listings); nothing is invented for the other pages.
 */
export async function buildSitemap(repo: MarketplaceRepository): Promise<MetadataRoute.Sitemap> {
  const [categories, cities, listings, sellers, services] = await Promise.all([
    repo.listProductCategories(),
    repo.listCities(),
    repo.listPublicListings(),
    repo.listSellers(),
    repo.listServices(),
  ])

  const categoryUrls: string[] = []
  for (const category of categories) {
    if (categoryIndexRule(await repo.countListings({ categoryId: category.id }))) categoryUrls.push(categoryPath(category.id))
    for (const city of cities) {
      const count = await repo.countListings({ categoryId: category.id, cityId: city.id })
      if (categoryIndexRule(count, city.id)) categoryUrls.push(categoryPath(category.id, city.id))
    }
  }

  return [
    { url: absoluteUrl('/') },
    { url: absoluteUrl('/elanlar') },
    { url: absoluteUrl('/xidmetler') },
    ...categoryUrls.map((path) => ({ url: absoluteUrl(path) })),
    ...listings.map((l) => ({ url: absoluteUrl(`/elanlar/${l.slug}`), lastModified: new Date(l.publishedAt) })),
    ...sellers.map((s) => ({ url: absoluteUrl(`/saticilar/${s.slug}`) })),
    ...services.map((s) => ({ url: absoluteUrl(`/xidmetler/${s.slug}`) })),
  ]
}
