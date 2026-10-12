import type { Metadata } from 'next'
import { isIndexable } from './env'
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_LOCALE } from './site'

export interface PageSeo {
  /** Page title without the " — GreenStore" suffix (the root layout adds it). */
  title: string
  description: string
  /** Canonical path ("/elanlar/zeytun-agaci-olea-europaea"). Omit for pages that must not declare one (noindex variants). */
  canonical?: string
  /** Page-level rule; the site-wide switch (env.ts) still has to allow indexing. */
  index?: boolean
  /** Links on noindex pages can still be followed (filtered catalogue pages). */
  follow?: boolean
  images?: Array<{ url: string; alt?: string; width?: number; height?: number }>
  type?: 'website' | 'article'
}

/** Effective robots directive: page rule AND the deployment switch (staging/mock data is never indexable). */
export function robotsFor(index = true, follow = true): Metadata['robots'] {
  if (!isIndexable()) return { index: false, follow: false }
  return { index, follow }
}

/** Builds the Next.js metadata object for a public page: title, description, canonical, robots, Open Graph, Twitter. */
export function pageMetadata(seo: PageSeo): Metadata {
  const images = seo.images?.length ? seo.images : [DEFAULT_OG_IMAGE]
  return {
    title: seo.title,
    description: seo.description,
    alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
    robots: robotsFor(seo.index ?? true, seo.follow ?? true),
    openGraph: {
      type: seo.type ?? 'website',
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      images,
    },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: images.map((i) => i.url) },
  }
}

/** Private, per-user and demo-tool pages: never indexed, no canonical, links not followed. */
export function privateMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } }
}

/** Trims text for meta descriptions (~160 characters, cut at a word boundary). */
export function describe(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,.;:—-]+$/, '')}…`
}
