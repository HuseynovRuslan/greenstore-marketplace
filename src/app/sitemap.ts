import type { MetadataRoute } from 'next'
import { isIndexable } from '@/seo/env'
import { buildSitemap } from '@/seo/sitemap'
import { getRepository } from '@/services/repository'

/** Empty while the site is not indexable (staging, mock data); see src/seo/env.ts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return []
  return buildSitemap(getRepository())
}
