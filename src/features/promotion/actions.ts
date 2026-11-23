'use server'

import { updateTag } from 'next/cache'
import { isApiError, listingPageTags } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import { dataSource } from '@/seo/env'
import type { PromotionOrder, PromotionPackage, PromotionPackageId } from '@/types'
import { isPaymentUrl, ORDER_KEY_RE, orderErrorMessage, PAYMENT_RETURN_PATH } from './checkout'

const PACKAGES: PromotionPackageId[] = ['ireli-cek', 'one-cixar', 'paket']
const ID_RE = /^[a-z0-9-]{1,80}$/

/** The return page refreshes the listing's pages only this soon after the payment: a later visit has nothing new. */
const REFRESH_WINDOW_MS = 10 * 60_000

export type BuyPromotionResult = { ok: true; order: PromotionOrder; paymentUrl?: string } | { ok: false; error: string; signedOut?: boolean }

/**
 * «Ödə» on /reklam: an order for one of the owner's active listings (backend-contract.md 5.1). No card data reaches
 * this server.
 * - DATA_SOURCE=api: the order is `pending` and `paymentUrl` is the payment provider's page; the browser goes there,
 *   and the provider brings the visitor back to /kabinet/odenis?order=<id>. The promotion starts when the provider
 *   confirms the payment to the API. `idempotencyKey`: the same «Ödə» again (a lost answer) gets the same order.
 * - DATA_SOURCE=mock (DEMO): the mock prices the option and answers `paid` at once, without a page.
 */
export async function buyPromotion(input: { listingId: string; packageId: PromotionPackageId; optionId: string }, idempotencyKey?: string): Promise<BuyPromotionResult> {
  if (typeof input?.listingId !== 'string' || !ID_RE.test(input.listingId) || !PACKAGES.includes(input.packageId) || typeof input.optionId !== 'string' || !ID_RE.test(input.optionId)) {
    return { ok: false, error: 'Sifariş düzgün deyil. Səhifəni yeniləyin.' }
  }
  const key = typeof idempotencyKey === 'string' && ORDER_KEY_RE.test(idempotencyKey) ? idempotencyKey : undefined
  try {
    const { order, paymentUrl } = await getRepository().createPromotionOrder(
      { listingId: input.listingId, packageId: input.packageId, optionId: input.optionId, returnPath: PAYMENT_RETURN_PATH },
      key,
    )
    if (paymentUrl === undefined) return { ok: true, order }
    // The provider's page comes from the API; anything but an http(s) address is not followed.
    if (!isPaymentUrl(paymentUrl)) return { ok: false, error: orderErrorMessage(undefined, undefined).error }
    return { ok: true, order, paymentUrl }
  } catch (error) {
    if (isApiError(error)) return { ok: false, ...orderErrorMessage(error.status, error.code) }
    return { ok: false, error: 'Ödənişi tamamlamaq alınmadı. Kartdan pul çıxılmayıb — yenidən cəhd edin.' }
  }
}

/**
 * The packages on sale now, for the screens in the browser that offer them («Elan yerləşdir»'s «Reklam» step, the
 * cabinet's «Ödə və işə sal»): DATA_SOURCE=api asks `GET /promotion-packages` (cached like the other public reads), so
 * names, prices and options are the API's. An empty list means nothing can be bought here now (no payment provider
 * yet), and so does a failed read: posting a listing never waits on it.
 */
export async function loadPromotionPackages(): Promise<PromotionPackage[]> {
  try {
    return await getRepository().listPromotionPackages()
  } catch {
    return []
  }
}

/**
 * The return page saw a paid order (DATA_SOURCE=api): the listing's own page is refreshed at once, so the owner who
 * opens it sees «Önə çıxan» without waiting for the API's change notice (backend-contract.md 3.6). The notice, a few
 * seconds later, refreshes the catalogue, the home page and the seller's page; this action never expires those shared
 * pages. Only the signed-in owner's order, paid within REFRESH_WINDOW_MS, counts.
 */
export async function refreshPromotedListing(orderId: string): Promise<{ ok: boolean }> {
  if (dataSource() !== 'api' || typeof orderId !== 'string' || !ID_RE.test(orderId)) return { ok: false }
  try {
    const repo = getRepository()
    const order = await repo.getPromotionOrder(orderId)
    if (order?.status !== 'paid' || !paidRecently(order.paidAt, Date.now())) return { ok: false }
    const listing = await repo.getOwnListing(order.listingId)
    if (!listing) return { ok: false }
    for (const tag of listingPageTags(listing)) updateTag(tag)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

function paidRecently(paidAt: string | undefined, now: number): boolean {
  const at = paidAt ? Date.parse(paidAt) : Number.NaN
  return Number.isFinite(at) && at <= now + 60_000 && now - at <= REFRESH_WINDOW_MS
}
