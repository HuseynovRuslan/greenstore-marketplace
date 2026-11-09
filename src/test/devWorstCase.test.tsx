import { afterEach, describe, expect, it, vi } from 'vitest'
import Page from '@/app/(main)/dev/worst-case/page'
import { TITLE_MAX } from '@/data/postAd'
import { LONGEST_TITLE, parseWorstCaseMode, worstCaseCategories, worstCaseListings } from '@/dev/worstCase'
import { buildSitemap } from '@/seo/sitemap'
import { mockRepository } from '@/services/mockRepository'

describe('/dev/worst-case', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('answers 404 in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
  })

  it('is never in the sitemap', async () => {
    const urls = (await buildSitemap(mockRepository)).map((entry) => entry.url)
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((url) => new URL(url).pathname.startsWith('/dev'))).toEqual([])
  })

  it('opens on the worst case and accepts the four modes only', () => {
    expect(parseWorstCaseMode(undefined)).toBe('worst')
    expect(parseWorstCaseMode('demo')).toBe('demo')
    expect(parseWorstCaseMode('empty')).toBe('empty')
    expect(parseWorstCaseMode('one')).toBe('one')
    expect(parseWorstCaseMode('nonsense')).toBe('worst')
  })

  it('uses values at the real limits, one failure per card', async () => {
    expect(LONGEST_TITLE).toHaveLength(TITLE_MAX)
    const { latest } = await mockRepository.getHomeContent()
    const worst = worstCaseListings(latest)
    expect(worst.map((l) => l.id)).toEqual(['wc-title', 'wc-price', 'wc-photo', 'wc-details', 'wc-zero', 'wc-short'])
    expect(worst.map((l) => l.price)).toContain(9_999_999)
    expect(new Set(worst.map((l) => l.id)).size).toBe(worst.length)
    const categories = await mockRepository.listProductCategories()
    const row = worstCaseCategories(categories)
    expect(row.map((c) => c.listingCount).slice(0, 2)).toEqual([99_999, 0])
    expect(row).toHaveLength(categories.length)
  })
})
