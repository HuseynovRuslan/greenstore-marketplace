import { sellerById } from '@/data/sellers'
import type { ServiceProvider } from '@/types'

/**
 * Figma never shows a phone number for service providers. The revealed contact state in the components frame
 * ("Nömrə göstərilib · +994 50 555 12 34") is used as a demo number for the "Nömrəni göstər" interaction.
 */
export const DEMO_CONTACT_PHONE = '+994 50 555 12 34'

export interface ProviderContact {
  phone: string
  summary?: string
  hours?: string
  sellerSlug?: string
  /** "Təsdiqlənmiş şirkət" for verified companies, "Təsdiqlənmiş xidmət göstərən" for other verified providers */
  badge?: string
}

/** Provider data + the linked public seller profile (Abşeron Tingçilik) when there is one. */
export function providerContact(provider: ServiceProvider | undefined): ProviderContact {
  const seller = sellerById(provider?.sellerId)
  const sellerSummary = seller?.kind ? [seller.kind, seller.memberSince && `${seller.memberSince}-dən GreenStore-da`].filter(Boolean).join(' · ') : undefined
  return {
    phone: provider?.phone ?? seller?.phone ?? DEMO_CONTACT_PHONE,
    summary: provider?.summary ?? sellerSummary,
    hours: provider?.workingHours ?? seller?.workingHours,
    sellerSlug: seller?.slug,
    badge: provider?.verified ? (provider.kind === 'company' ? 'Təsdiqlənmiş şirkət' : 'Təsdiqlənmiş xidmət göstərən') : undefined,
  }
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`
