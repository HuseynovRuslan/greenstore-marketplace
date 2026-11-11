import type { NextConfig } from 'next'
import { retiredCategoryIds } from './src/data/categories'
import { isIndexable, PRIVATE_PATHS } from './src/seo/env'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    // Next.js streams the RSC payload in inline <script> tags, so script-src needs 'unsafe-inline' until a
    // nonce-based policy (proxy.ts + dynamic rendering) is introduced — see SEO_ARCHITECTURE.md → Security headers.
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // next/image (the home hero photos): AVIF where the browser takes it, WebP otherwise. Quality stays at the default 75.
  images: { formats: ['image/avif', 'image/webp'] },
  /*
   * Category pages of the product categories taken off the site (src/data/categories.ts) lead to the catalogue
   * instead of a 404; a city page keeps its city. Temporary (307): the category list is preliminary, and a
   * permanent redirect would stay cached in browsers if a category came back.
   */
  async redirects() {
    return retiredCategoryIds.flatMap((id) => [
      { source: `/kateqoriyalar/${id}`, destination: '/elanlar', permanent: false },
      { source: `/kateqoriyalar/${id}/:seher`, destination: '/elanlar?seher=:seher', permanent: false },
    ])
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    return [
      // The CSP would block the dev server's eval-based tooling, so it is only sent in production builds.
      { source: '/:path*', headers: isProd ? securityHeaders : securityHeaders.filter((h) => h.key !== 'Content-Security-Policy') },
      // Staging / demo data: keep every URL out of search engines (also covers images and non-HTML responses).
      ...(isIndexable() ? [] : [{ source: '/:path*', headers: noindex }]),
      // Private and demo-tool areas are never indexed.
      ...PRIVATE_PATHS.flatMap((p) => [
        { source: p, headers: noindex },
        { source: `${p}/:path*`, headers: noindex },
      ]),
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }] },
    ]
  },
}

export default nextConfig
