import type { MetadataRoute } from 'next'
import { buildRobots } from '@/seo/sitemap'

export default function robots(): MetadataRoute.Robots {
  return buildRobots()
}
