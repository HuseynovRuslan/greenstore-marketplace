import { siteUrl } from './env'

export const SITE_NAME = 'GreenStore'
export const SITE_TITLE = 'GreenStore — Bağınız üçün doğru seçim'
export const SITE_DESCRIPTION =
  'GreenStore — Azərbaycanda bitkilər, bağ məhsulları və landşaft xidmətləri üçün açıq elan platforması.'
export const SITE_LOCALE = 'az_AZ'
/** Default social preview: the home page "Botanika vitrini" photo from the approved design. */
export const DEFAULT_OG_IMAGE = { url: '/images/home/hero-botanika.webp', alt: 'Bağ mərkəzində dibçəkdə zeytun ağacları' }

/** Absolute URL on the configured public origin (`NEXT_PUBLIC_SITE_URL`, see env.ts). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
