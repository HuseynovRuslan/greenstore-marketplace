import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiRepository'
import { mockRepository } from '@/services/mockRepository'
import type { OwnListing, PromotionOrder } from '@/types'

/*
 * The promotion's Server Actions (backend-contract.md 5.1): «Ödə» with DATA_SOURCE=api (the order with the return
 * page and the key, the provider's page checked, the API's refusals worded) and with the mock (paid at once, as
 * before), and the return page's cache refresh. The repository is a fake; `updateTag` is a spy.
 */

const { repo, updateTag } = vi.hoisted(() => ({ repo: {} as Record<string, ReturnType<typeof vi.fn>>, updateTag: vi.fn() }))

vi.mock('next/cache', () => ({ updateTag, revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, has: () => false, set: () => {}, delete: () => {} }) }))
vi.mock('@/services/repository', async (original) => ({ ...(await original<typeof import('@/services/repository')>()), getRepository: () => repo }))

const { buyPromotion, refreshPromotedListing } = await import('@/features/promotion/actions')

const LISTING = '01937a52-0000-7a1b-9f00-2d5c1e4b8a10'
const ORDER = '01937a52-1111-7a1b-9f00-2d5c1e4b8a10'
const PAY = `http://localhost:5080/api/v1/payments/fake/checkout/fake_abc?return=${encodeURIComponent(`/kabinet/odenis?order=${ORDER}`)}`
const input = { listingId: LISTING, packageId: 'one-cixar' as const, optionId: 'one-cixar-7' }
const order = (patch: Partial<PromotionOrder> = {}): PromotionOrder => ({ id: ORDER, number: 1001, ...input, amount: 9, status: 'pending', createdAt: '2026-11-22T10:00:00Z', ...patch })
const problem = (status: number, code: string) => new ApiError(status, code, 'promotion-orders', { code })

beforeEach(() => {
  for (const key of Object.keys(repo)) delete repo[key]
  updateTag.mockClear()
  vi.stubEnv('DATA_SOURCE', 'api')
})

describe('«Ödə» (buyPromotion) with DATA_SOURCE=api', () => {
  it('asks for the order with the return page and the key, and answers the provider’s page', async () => {
    repo.createPromotionOrder = vi.fn(async () => ({ order: order(), paymentUrl: PAY }))
    expect(await buyPromotion(input, 'sifaris-1')).toEqual({ ok: true, order: order(), paymentUrl: PAY })
    expect(repo.createPromotionOrder).toHaveBeenCalledWith({ ...input, returnPath: '/kabinet/odenis' }, 'sifaris-1')
  })

  it('drops a key the API would refuse', async () => {
    repo.createPromotionOrder = vi.fn(async () => ({ order: order(), paymentUrl: PAY }))
    await buyPromotion(input, 'with space')
    expect(repo.createPromotionOrder).toHaveBeenCalledWith(expect.anything(), undefined)
  })

  it('never follows a page that is not an http(s) address', async () => {
    repo.createPromotionOrder = vi.fn(async () => ({ order: order(), paymentUrl: 'javascript:alert(1)' }))
    const result = await buyPromotion(input, 'k')
    expect(result.ok).toBe(false)
  })

  it('refuses a broken order without asking the API', async () => {
    repo.createPromotionOrder = vi.fn()
    for (const bad of [
      { ...input, listingId: 'Robert); DROP' },
      { ...input, packageId: 'vip' },
      { ...input, optionId: '' },
      { ...input, optionId: 7 },
      undefined,
    ]) {
      expect(await buyPromotion(bad as never)).toEqual({ ok: false, error: 'Sifariş düzgün deyil. Səhifəni yeniləyin.' })
    }
    expect(repo.createPromotionOrder).not.toHaveBeenCalled()
  })

  it('words the API’s refusals', async () => {
    const cases: Array<[ApiError, RegExp, boolean?]> = [
      [problem(401, 'unauthorized'), /Sessiyanın vaxtı bitib/, true],
      [problem(409, 'listing.wrong-status'), /Yalnız aktiv elanı/],
      [problem(404, 'listing.not-found'), /Elan tapılmadı/],
      [problem(429, 'promotion-order.too-many'), /24 saatda/],
      [problem(503, 'payment.unavailable'), /hələ qoşulmayıb/],
      [problem(400, 'validation'), /satışda deyil/],
    ]
    for (const [error, text, signedOut] of cases) {
      repo.createPromotionOrder = vi.fn(async () => {
        throw error
      })
      const result = await buyPromotion(input, 'k')
      expect(result).toMatchObject({ ok: false, error: expect.stringMatching(text) })
      expect(result.ok === false && result.signedOut).toBe(signedOut ?? undefined)
    }
  })

  it('says nothing was charged when the API cannot be reached', async () => {
    repo.createPromotionOrder = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await buyPromotion(input, 'k')).toEqual({ ok: false, error: 'Ödənişi tamamlamaq alınmadı. Kartdan pul çıxılmayıb — yenidən cəhd edin.' })
  })
})

describe('«Ödə» with DATA_SOURCE=mock', () => {
  it('answers the demo’s paid order at once, without a page', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    repo.createPromotionOrder = vi.fn(mockRepository.createPromotionOrder)
    const result = await buyPromotion({ listingId: 'zeytun-agaci', packageId: 'one-cixar', optionId: 'one-cixar-7' })
    expect(result).toMatchObject({ ok: true, order: { status: 'paid', amount: 9, number: expect.any(Number) } })
    expect('paymentUrl' in result).toBe(false)
  })

  it('keeps the demo’s message for an option it does not sell', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    repo.createPromotionOrder = vi.fn(mockRepository.createPromotionOrder)
    expect(await buyPromotion({ listingId: 'zeytun-agaci', packageId: 'ireli-cek', optionId: 'one-cixar-7' })).toEqual({
      ok: false,
      error: 'Ödənişi tamamlamaq alınmadı. Kartdan pul çıxılmayıb — yenidən cəhd edin.',
    })
  })
})

describe('the return page’s cache refresh (refreshPromotedListing)', () => {
  const own = { id: LISTING, slug: 'tuya-20324', sellerId: 's1', kind: 'product', status: 'active' } as OwnListing

  it('refreshes the own pages of a listing paid just now, never the shared ones', async () => {
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'paid', paidAt: new Date(Date.now() - 30_000).toISOString() }))
    repo.getOwnListing = vi.fn(async () => own)
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: true })
    expect(repo.getOwnListing).toHaveBeenCalledWith(LISTING)
    // The catalogue, the home page and the seller's page wait for the API's change notice (a few seconds).
    expect(updateTag.mock.calls.map((c) => c[0])).toEqual([`listing:${LISTING}`, 'listing:tuya-20324'])
  })

  it('does nothing for a payment made long ago (the action cannot be used to expire pages at will)', async () => {
    repo.getOwnListing = vi.fn(async () => own)
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'paid', paidAt: new Date(Date.now() - 11 * 60_000).toISOString() }))
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'paid' }))
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    expect(repo.getOwnListing).not.toHaveBeenCalled()
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('does nothing for an order that is not paid, not the owner’s, or not one', async () => {
    repo.getOwnListing = vi.fn(async () => own)
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'pending' }))
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    repo.getPromotionOrder = vi.fn(async () => undefined)
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    expect(await refreshPromotedListing('../x')).toEqual({ ok: false })
    repo.getPromotionOrder = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('does nothing with the mock', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    repo.getPromotionOrder = vi.fn()
    expect(await refreshPromotedListing(ORDER)).toEqual({ ok: false })
    expect(repo.getPromotionOrder).not.toHaveBeenCalled()
  })
})
