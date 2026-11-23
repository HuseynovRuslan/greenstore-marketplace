/**
 * The Content-Security-Policy and next/image's remote photos, from the deployment's settings. Kept free of imports
 * (except ./env, also import-free) so `next.config.ts` can load it. Read when the server starts (`next.config.ts`
 * headers), so the variables belong in the build's and the server's environment alike.
 *
 * With DATA_SOURCE=api the browser talks to the API directly in two ways (backend-contract.md 1.5, 3.2):
 *   - it uploads the posting's photos to the API (`PUT …/photo-uploads/<token>`): `connect-src` names the API's
 *     public origin, `API_PUBLIC_URL` (the address browsers reach it at; `API_BASE_URL` when unset, as in local dev);
 *   - it shows the uploaded photos from the media address (the API's `Media:BaseUrl`, later a CDN): `img-src` and
 *     `images.remotePatterns` name `MEDIA_BASE_URL` (`<API_PUBLIC_URL>/media` when unset, as the API's own default).
 * DATA_SOURCE=mock talks to nothing but this site: the policy stays 'self' only.
 */
import { dataSource } from './env'

type Env = Record<string, string | undefined>

function httpUrl(value: string | undefined): URL | undefined {
  const text = value?.trim()
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

/** The API's origin for the browser (photo uploads), DATA_SOURCE=api only. */
export function apiPublicOrigin(env: Env = process.env): string | undefined {
  if (dataSource(env) !== 'api') return undefined
  return (httpUrl(env.API_PUBLIC_URL) ?? httpUrl(env.API_BASE_URL))?.origin
}

/** Where uploaded photos are served from (no trailing slash), DATA_SOURCE=api only. */
export function mediaBaseUrl(env: Env = process.env): URL | undefined {
  if (dataSource(env) !== 'api') return undefined
  const explicit = httpUrl(env.MEDIA_BASE_URL)
  if (explicit) return explicit
  const api = apiPublicOrigin(env)
  return api ? new URL(`${api}/media`) : undefined
}

export function contentSecurityPolicy(env: Env = process.env): string {
  const api = apiPublicOrigin(env)
  const media = mediaBaseUrl(env)?.origin
  const unique = (values: Array<string | undefined>) => [...new Set(values.filter(Boolean))].join(' ')
  // Next.js streams the RSC payload in inline <script> tags, so script-src needs 'unsafe-inline' until a nonce-based
  // policy (proxy.ts + dynamic rendering) is introduced — see SEO_ARCHITECTURE.md → Security headers.
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${unique(["'self'", 'data:', 'blob:', media])}`,
    "font-src 'self' data:",
    `connect-src ${unique(["'self'", api])}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export interface RemotePattern {
  protocol: 'http' | 'https'
  hostname: string
  port: string
  pathname: string
}

/** next/image may load the uploaded photos (and nothing else from outside). */
export function mediaRemotePatterns(env: Env = process.env): RemotePattern[] {
  const media = mediaBaseUrl(env)
  if (!media) return []
  const path = media.pathname.replace(/\/+$/, '')
  return [{ protocol: media.protocol === 'https:' ? 'https' : 'http', hostname: media.hostname, port: media.port, pathname: `${path}/**` }]
}
