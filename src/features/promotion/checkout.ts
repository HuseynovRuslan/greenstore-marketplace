import type { PromotionOrder, PromotionPackage, PromotionPackageId } from '@/types'

/*
 * «Ödə» with DATA_SOURCE=api (backend-contract.md 5.1): the order goes to the API, the visitor goes to the payment
 * provider's page, and the provider brings them back to PAYMENT_RETURN_PATH with `?order=<id>`. Pure helpers, shared
 * by the Server Action, the planner and the return page (tested in src/test/promotionApi.test.ts).
 */

/** The site's page the payment provider brings the visitor back to; the API adds `?order=<id>` (and the fake one `&payment=`). */
export const PAYMENT_RETURN_PATH = '/kabinet/odenis'

/** An `Idempotency-Key` the API takes: ≤ 80 printable ASCII characters. */
export const ORDER_KEY_RE = /^[\x21-\x7e]{1,80}$/

/** A key for one «Ödə» (one listing and option): pressing again after a lost answer gets the same order and page. */
export function newOrderKey(): string {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return `sifaris-${id}`
}

/** The provider's page is an absolute http(s) address; anything else is not followed. */
export function isPaymentUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Leaves the site for the provider's page (a full page load: the provider's page is another site). */
export function openPaymentPage(url: string): void {
  window.location.assign(url)
}

/** What the visitor reads when the API refuses the order, by its ProblemDetails `code` (and status). */
export function orderErrorMessage(status: number | undefined, code: string | undefined): { error: string; signedOut?: boolean } {
  if (status === 401) return { error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true }
  switch (code) {
    case 'listing.wrong-status':
      return { error: 'Elan artıq saytda deyil. Yalnız aktiv elanı önə çıxarmaq olar: «Elanlarım»a baxın.' }
    case 'listing.not-found':
      return { error: 'Elan tapılmadı: silinmiş ola bilər. Səhifəni yeniləyin.' }
    case 'validation':
      return { error: 'Bu paket artıq satışda deyil. Səhifəni yeniləyib yenidən seçin.' }
    case 'promotion-order.too-many':
      return { error: 'Son 24 saatda çox ödənilməmiş sifariş açmısınız. Bir saat sonra yenidən cəhd edin.' }
    case 'payment.unavailable':
      return { error: 'Onlayn ödəniş hələ qoşulmayıb. Bir az sonra yenidən cəhd edin.' }
    case 'idempotency.key-reused':
      return { error: 'Sifariş dəyişib. Pəncərəni bağlayıb yenidən «Ödə» basın.' }
    default:
      return { error: 'Ödənişə keçmək alınmadı. Kartdan pul çıxılmayıb — bir az sonra yenidən cəhd edin.' }
  }
}

/** «Yenidən cəhd et» after a failed payment: /reklam with the same listing and option chosen. */
export function retryPath(order: Pick<PromotionOrder, 'listingId' | 'optionId'>): string {
  return `/reklam?${new URLSearchParams({ elan: order.listingId, secim: order.optionId })}`
}

/** The package and option an order (or a choice made while posting) names, from the packages on offer. */
export function describeOption(packages: PromotionPackage[], optionId: string): { packageId: PromotionPackageId; name: string; label: string; days?: number } | undefined {
  for (const pkg of packages) {
    const option = pkg.options.find((o) => o.id === optionId)
    if (option) return { packageId: pkg.id, name: pkg.name, label: option.label, ...(option.days ? { days: option.days } : {}) }
  }
  return undefined
}

/** The package and the option with this id among `packages` (the ones on sale); undefined when it is not on sale. */
export function findOption(packages: PromotionPackage[], optionId: string): { pkg: PromotionPackage; option: PromotionPackage['options'][number] } | undefined {
  for (const pkg of packages) {
    const option = pkg.options.find((o) => o.id === optionId)
    if (option) return { pkg, option }
  }
  return undefined
}

/** The package and option the planner opens with: `?secim=` when it is on offer, else «Önə çıxar» 7 days (or the first). */
export function initialChoice(packages: PromotionPackage[], optionId: string | null): { packageId: PromotionPackageId; optionId: string } {
  const wanted = optionId ? describeOption(packages, optionId) : undefined
  if (wanted && optionId) return { packageId: wanted.packageId, optionId }
  const preferred = describeOption(packages, 'one-cixar-7')
  if (preferred) return { packageId: preferred.packageId, optionId: 'one-cixar-7' }
  const first = packages.find((p) => p.id === 'one-cixar') ?? packages[0]
  return { packageId: first?.id ?? 'one-cixar', optionId: first?.options[0]?.id ?? '' }
}
