/**
 * Deployment-level SEO switches. Kept free of imports so `next.config.ts` can load it too.
 *
 * Indexing is OFF unless BOTH are true:
 *   - SEO_INDEXABLE=true            (explicit opt-in per environment — production only)
 *   - DATA_SOURCE is not "mock"     (the sample listings must never be indexed as real inventory)
 * Today the only data source is the Figma demo data, so every environment is non-indexable.
 */
export type DataSource = 'mock' | 'api'

export function dataSource(env: Record<string, string | undefined> = process.env): DataSource {
  return env.DATA_SOURCE === 'api' ? 'api' : 'mock'
}

export function isIndexable(env: Record<string, string | undefined> = process.env): boolean {
  return env.SEO_INDEXABLE === 'true' && dataSource(env) !== 'mock'
}

/** Public origin used for canonical URLs, Open Graph, the sitemap and robots.txt (no trailing slash). */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** Paths that are private, per-user or demo tooling — never indexed, even in production. */
export const PRIVATE_PATHS = ['/kabinet', '/secilmisler', '/elan-yerlesdir', '/idareetme', '/daxil-ol', '/qeydiyyat'] as const
