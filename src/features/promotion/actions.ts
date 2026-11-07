'use server'

import { getRepository } from '@/services/repository'
import type { PromotionOrder, PromotionPackageId } from '@/types'

const PACKAGES: PromotionPackageId[] = ['ireli-cek', 'one-cixar', 'paket']

/**
 * Buys a promotion for a listing. DEMO: the mock prices the option and answers «paid» at once; no card data reaches
 * the server (a real checkout redirects to the payment provider and confirms by webhook).
 */
export async function buyPromotion(input: { listingId: string; packageId: PromotionPackageId; optionId: string }): Promise<{ ok: true; order: PromotionOrder } | { ok: false; error: string }> {
  if (typeof input?.listingId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.listingId) || !PACKAGES.includes(input.packageId) || typeof input.optionId !== 'string') {
    return { ok: false, error: 'Sifariş düzgün deyil. Səhifəni yeniləyin.' }
  }
  try {
    return { ok: true, order: await getRepository().createPromotionOrder(input) }
  } catch {
    return { ok: false, error: 'Ödənişi tamamlamaq alınmadı. Kartdan pul çıxılmayıb — yenidən cəhd edin.' }
  }
}
