import { describe, expect, it } from 'vitest'
import vercel from '../../vercel.json'

/** Guards the Vercel SPA set-up: deep links must fall back to index.html, real asset folders must not. */
describe('vercel.json', () => {
  const rewrite = vercel.rewrites.find((r) => r.destination === '/index.html')
  const pattern = new RegExp(`^${rewrite!.source}$`)

  it('builds the Vite app into dist', () => {
    expect(vercel.outputDirectory).toBe('dist')
    expect(vercel.buildCommand).toBe('npm run build')
  })

  it.each([
    '/',
    '/elanlar',
    '/elanlar/zeytun-agaci-olea-europaea',
    '/saticilar/abseron-tingcilik',
    '/xidmetler/landsaft-dizayni-ve-yasillasdirma',
    '/kabinet/profil',
    '/elan-yerlesdir/3',
    '/elan-yerlesdir/gonderildi',
    '/idareetme/sikayetler',
  ])('rewrites the deep link %s to index.html', (path) => {
    expect(pattern.test(path)).toBe(true)
  })

  it.each(['/assets/index-abc123.js', '/images/listings/zeytun-agaci-1.webp', '/favicon.svg'])('lets missing static files 404 instead of serving HTML: %s', (path) => {
    expect(pattern.test(path)).toBe(false)
  })

  it('keeps the demo out of search engines and sets basic security headers', () => {
    const all = vercel.headers.find((h) => h.source === '/(.*)')!.headers.map((h) => h.key)
    expect(all).toEqual(expect.arrayContaining(['X-Robots-Tag', 'X-Content-Type-Options', 'Content-Security-Policy', 'X-Frame-Options']))
  })
})
