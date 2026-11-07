import { afterEach, describe, expect, it, vi } from 'vitest'
import nextConfig from '../../next.config'

type Rule = { source: string; headers: Array<{ key: string; value: string }> }

async function headerRules(): Promise<Rule[]> {
  return (await nextConfig.headers!()) as Rule[]
}

function headersFor(rules: Rule[], source: string) {
  return rules.filter((r) => r.source === source).flatMap((r) => r.headers)
}

/** Guards the deployment headers in next.config.ts (they replace the Vite build's vercel.json). */
describe('next.config headers', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps every URL out of search engines while the data is mock data', async () => {
    vi.stubEnv('SEO_INDEXABLE', 'true')
    vi.stubEnv('DATA_SOURCE', 'mock')
    const all = headersFor(await headerRules(), '/:path*')
    expect(all).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
  })

  it('drops the site-wide noindex only with SEO_INDEXABLE=true and a real data source', async () => {
    vi.stubEnv('SEO_INDEXABLE', 'true')
    vi.stubEnv('DATA_SOURCE', 'api')
    const rules = await headerRules()
    expect(headersFor(rules, '/:path*').map((h) => h.key)).not.toContain('X-Robots-Tag')
    // Private areas stay noindex even then.
    for (const source of ['/kabinet', '/kabinet/:path*', '/elan-yerlesdir/:path*', '/idareetme/:path*', '/daxil-ol', '/secilmisler']) {
      expect(headersFor(rules, source)).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
    }
  })

  it('sends the CSP and security headers in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const keys = headersFor(await headerRules(), '/:path*').map((h) => h.key)
    expect(keys).toEqual(expect.arrayContaining(['Content-Security-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy']))
  })

  it('does not send the CSP to the dev server', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const keys = headersFor(await headerRules(), '/:path*').map((h) => h.key)
    expect(keys).not.toContain('Content-Security-Policy')
    expect(keys).toContain('X-Content-Type-Options')
  })
})
