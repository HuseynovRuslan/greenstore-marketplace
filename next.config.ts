import type { NextConfig } from 'next'
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
