import { sellerById } from '@/data/sellers'
import type { Seller, ServiceProvider } from '@/types'

export interface ProviderContact {
  summary?: string
  hours?: string
  sellerSlug?: string
  /** "Təsdiqlənmiş şirkət" for verified companies, "Təsdiqlənmiş xidmət göstərən" for other verified providers */
  badge?: string
}

/**
 * Provider data + the linked public seller profile (Abşeron Tingçilik) when there is one: from the page, else the
 * demo data. No number: «Nömrəni göstər» asks for it (backend-contract.md 3.1).
 */
export function providerContact(provider: ServiceProvider | undefined, linked?: Seller): ProviderContact {
  const seller = linked ?? sellerById(provider?.sellerId)
  const sellerSummary = seller?.kind ? [seller.kind, seller.memberSince && `${seller.memberSince}-dən GreenStore-da`].filter(Boolean).join(' · ') : undefined
  return {
    summary: provider?.summary ?? sellerSummary,
    hours: provider?.workingHours ?? seller?.workingHours,
    sellerSlug: seller?.slug,
    badge: provider?.verified ? (provider.kind === 'company' ? 'Təsdiqlənmiş şirkət' : 'Təsdiqlənmiş xidmət göstərən') : undefined,
  }
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
export const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '')}`
