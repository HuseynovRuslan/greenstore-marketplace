/*
 * What the site footer links to. Categories and cities come from the same data as the home page (categories row,
 * city field) and /elanlar, in the same order, with the same ids and URLs — nothing here is typed in by hand.
 * Routes, anchors and the social-link env variables: docs/handoff/footer.md.
 */
import { categories as allCategories } from '@/data/categories'
import { cities as allCities } from '@/data/cities'
import { signUpHref } from '@/features/auth/validation'
import { catalogHref, emptySearchState } from '@/features/search/searchUrl'
import { contactHref } from '@/features/support/contactTopics'
import { categoryHref } from '@/seo/catalog'
import type { Category, City, PromotionPackageId } from '@/types'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterGroup {
  id: 'kateqoriyalar' | 'seherler' | 'saticilar' | 'komek' | 'sirket'
  title: string
  links: FooterLink[]
  /** Two sub-columns (Kateqoriyalar). */
  twoColumns?: boolean
  /** A closing link after the list («Bütün kateqoriyalar» when the list was cut). */
  more?: FooterLink
}

/** At most this many categories in the footer; the rest are one «Bütün kateqoriyalar» link away. */
export const FOOTER_CATEGORY_LIMIT = 10

/** The package cards on /reklam carry their id as an anchor (PromotionPlanner). */
const promotionHref = (id: PromotionPackageId) => `/reklam#${id}`

/** The footer's link groups. `categories` / `cities` default to the site data (tests pass their own). */
export function footerGroups({ categories = allCategories, cities = allCities }: { categories?: Category[]; cities?: City[] } = {}): FooterGroup[] {
  return [
    {
      id: 'kateqoriyalar',
      title: 'Kateqoriyalar',
      twoColumns: true,
      links: categories.slice(0, FOOTER_CATEGORY_LIMIT).map((c) => ({ label: c.name, href: categoryHref(c) })),
      // Same target as the header's «Kateqoriyalar»: the home page row that lists every category.
      more: categories.length > FOOTER_CATEGORY_LIMIT ? { label: 'Bütün kateqoriyalar', href: '/#kateqoriyalar' } : undefined,
    },
    {
      id: 'seherler',
      title: 'Şəhərlər',
      links: cities.map((c) => ({ label: c.name, href: catalogHref({ ...emptySearchState, cityIds: [c.id] }, new URLSearchParams()) })),
    },
    {
      id: 'saticilar',
      title: 'Satıcılar üçün',
      links: [
        { label: 'Elan yerləşdir', href: '/elan-yerlesdir' },
        { label: 'Önə çıxar', href: promotionHref('one-cixar') },
        { label: 'İrəli çək', href: promotionHref('ireli-cek') },
        { label: 'Biznes hesabları', href: signUpHref('business') },
        { label: 'Elan qaydaları', href: '/qaydalar' },
      ],
    },
    {
      id: 'komek',
      title: 'Kömək',
      links: [
        { label: 'Tez-tez verilən suallar', href: '/komek' },
        { label: 'Təhlükəsiz alış', href: '/tehlukesiz-alis' },
        { label: 'Problem bildir', href: contactHref('complaint') },
      ],
    },
    {
      id: 'sirket',
      title: 'Şirkət',
      links: [
        { label: 'Haqqımızda', href: '/haqqimizda' },
        { label: 'Bitkiyə qulluq məsləhətləri', href: '/bitkiye-qulluq' },
        { label: 'Əlaqə', href: contactHref() },
      ],
    },
  ]
}

/** Bottom row of the full footer; also part of the compact footer on inner pages. */
export const legalLinks: FooterLink[] = [
  { label: 'İstifadə şərtləri', href: '/istifade-sertleri' },
  { label: 'Məxfilik siyasəti', href: '/mexfilik' },
  { label: 'Sayt xəritəsi', href: '/sayt-xeritesi' },
]

/* ---------- Social profiles ---------- */

export type SocialNetwork = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp'

export interface SocialLink {
  network: SocialNetwork
  name: string
  href: string
}

/** Each profile's URL comes from the environment (set before `next build`); unset → no icon. */
export const SOCIAL_ENV: Record<SocialNetwork, string> = {
  instagram: 'NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL',
  facebook: 'NEXT_PUBLIC_SOCIAL_FACEBOOK_URL',
  tiktok: 'NEXT_PUBLIC_SOCIAL_TIKTOK_URL',
  whatsapp: 'NEXT_PUBLIC_SOCIAL_WHATSAPP_URL',
}

const names: Record<SocialNetwork, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', whatsapp: 'WhatsApp' }

/** `next dev` only, for design review: the networks' own home pages, never a guessed GreenStore profile. */
const devPlaceholders: Record<SocialNetwork, string> = {
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  tiktok: 'https://www.tiktok.com/',
  whatsapp: 'https://www.whatsapp.com/',
}

const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The profiles to show: only networks with a real https URL. In `next dev` the missing ones get placeholders so the
 * row can be reviewed; tests and production builds never invent one.
 */
export function socialLinks(env: Record<string, string | undefined> = process.env): SocialLink[] {
  const dev = env.NODE_ENV === 'development'
  return (Object.keys(SOCIAL_ENV) as SocialNetwork[]).flatMap((network) => {
    const href = env[SOCIAL_ENV[network]]?.trim() || (dev ? devPlaceholders[network] : '')
    return isHttps(href) ? [{ network, name: names[network], href }] : []
  })
}
