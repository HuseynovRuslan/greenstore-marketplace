import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promotionPackages } from '@/data/promotions'
import { describeOption, initialChoice, isPaymentUrl, newOrderKey, ORDER_KEY_RE, orderErrorMessage, PAYMENT_RETURN_PATH, retryPath } from '@/features/promotion/checkout'
import { ApiError, apiRepository } from '@/services/apiRepository'
import type { PromotionOrder } from '@/types'

/*
 * DATA_SOURCE=api, phase 5 (backend-contract.md 5.1): the promotion methods of the repository against a fake API, and
 * the checkout's pure helpers (the provider's page, the wording of the API's refusals, the planner's first choice).
 */

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 Test' }),
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    has: (name: string) => jar.values.has(name),
    set: (name: string, value: string) => jar.values.set(name, value),
    delete: (name: string) => jar.values.delete(name),
  }),
}))

interface Call {
  url: URL
  init: RequestInit & { headers: Record<string, string>; next?: { revalidate?: number; tags?: string[] } }
}

const calls: Call[] = []
let respond: (url: URL, init: Call['init']) => { status?: number; body?: unknown } = () => ({ body: {} })

const TOKEN = 'c'.repeat(43)
const LISTING = '01937a52-0000-7a1b-9f00-2d5c1e4b8a10'
const ORDER = '01937a52-1111-7a1b-9f00-2d5c1e4b8a10'

const order = (patch: Partial<PromotionOrder> = {}): PromotionOrder => ({
  id: ORDER,
  number: 1001,
  listingId: LISTING,
  packageId: 'one-cixar',
  optionId: 'one-cixar-7',
  amount: 9,
  status: 'pending',
  createdAt: '2026-11-22T10:00:00Z',
  ...patch,
})

beforeEach(() => {
  calls.length = 0
  jar.values.clear()
  respond = () => ({ body: {} })
  vi.stubEnv('API_BASE_URL', 'http://api.test:5080')
  vi.stubEnv('API_INTERNAL_KEY', 'test-key')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: Call['init']) => {
      const url = new URL(input)
      calls.push({ url, init })
      const { status = 200, body } = respond(url, init)
      return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const last = () => calls[calls.length - 1]
const signedIn = () => jar.values.set('gs_session', TOKEN)

describe('apiRepository: promotion (backend-contract.md 5.1)', () => {
  it('reads the packages as a cached public read, in the site’s language', async () => {
    respond = () => ({ body: promotionPackages })
    expect(await apiRepository.listPromotionPackages()).toEqual(promotionPackages)
    expect([last().init.method ?? 'GET', last().url.pathname]).toEqual(['GET', '/api/v1/promotion-packages'])
    expect(last().init.next).toEqual({ revalidate: 60, tags: ['promotions'] })
    expect(last().init.headers['Accept-Language']).toBe('az')
    // A public read is shared by every visitor: no session, no visitor IP.
    expect(last().init.headers.Authorization).toBeUndefined()
    expect(last().init.headers['X-Client-IP']).toBeUndefined()
  })

  it('creates the order with the session, the return page and the Idempotency-Key, and answers the provider’s page', async () => {
    signedIn()
    const checkout = { order: order(), paymentUrl: `http://api.test:5080/api/v1/payments/fake/checkout/fake_abc?return=${encodeURIComponent(`/kabinet/odenis?order=${ORDER}`)}` }
    respond = () => ({ status: 201, body: checkout })
    const input = { listingId: LISTING, packageId: 'one-cixar' as const, optionId: 'one-cixar-7', returnPath: PAYMENT_RETURN_PATH }
    expect(await apiRepository.createPromotionOrder(input, 'sifaris-1')).toEqual(checkout)
    expect([last().init.method, last().url.pathname]).toEqual(['POST', '/api/v1/promotion-orders'])
    expect(JSON.parse(String(last().init.body))).toEqual(input)
    expect(last().init.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}`, 'Idempotency-Key': 'sifaris-1', 'X-Client-IP': '203.0.113.9' })
    expect(last().init.cache).toBe('no-store')
  })

  it('sends no Idempotency-Key when there is none', async () => {
    signedIn()
    respond = () => ({ status: 201, body: { order: order(), paymentUrl: 'http://api.test/p' } })
    await apiRepository.createPromotionOrder({ listingId: LISTING, packageId: 'one-cixar', optionId: 'one-cixar-7' })
    expect(last().init.headers['Idempotency-Key']).toBeUndefined()
  })

  it('does not ask without a session, and throws the API’s refusal with its code', async () => {
    const error = await apiRepository.createPromotionOrder({ listingId: LISTING, packageId: 'one-cixar', optionId: 'one-cixar-7' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized' })
    expect(calls).toHaveLength(0)

    signedIn()
    respond = () => ({ status: 409, body: { status: 409, code: 'listing.wrong-status', listingStatus: 'pending' } })
    await expect(apiRepository.createPromotionOrder({ listingId: LISTING, packageId: 'one-cixar', optionId: 'one-cixar-7' })).rejects.toMatchObject({ status: 409, code: 'listing.wrong-status' })
  })

  it('reads the owner’s order; another account’s, or none, is undefined', async () => {
    signedIn()
    respond = () => ({ body: order({ status: 'paid', paidAt: '2026-11-22T10:01:00Z' }) })
    expect(await apiRepository.getPromotionOrder(ORDER)).toMatchObject({ status: 'paid', number: 1001, paidAt: '2026-11-22T10:01:00Z' })
    expect(last().url.pathname).toBe(`/api/v1/me/promotion-orders/${ORDER}`)
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)

    respond = () => ({ status: 404, body: { status: 404, code: 'promotion-order.not-found' } })
    expect(await apiRepository.getPromotionOrder(ORDER)).toBeUndefined()
    jar.values.clear()
    expect(await apiRepository.getPromotionOrder(ORDER)).toBeUndefined()
  })

  it('names the order in the path safely', async () => {
    signedIn()
    respond = () => ({ status: 404, body: { code: 'promotion-order.not-found' } })
    await apiRepository.getPromotionOrder('../me')
    expect(last().url.pathname).toBe('/api/v1/me/promotion-orders/..%2Fme')
  })
})

describe('the checkout’s helpers', () => {
  it('follows only an absolute http(s) payment page', () => {
    expect(isPaymentUrl('https://pay.example.az/checkout/abc')).toBe(true)
    expect(isPaymentUrl('http://localhost:5080/api/v1/payments/fake/checkout/fake_1?return=%2Fkabinet%2Fodenis')).toBe(true)
    expect(isPaymentUrl('javascript:alert(1)')).toBe(false)
    expect(isPaymentUrl('/kabinet')).toBe(false)
    expect(isPaymentUrl('')).toBe(false)
    expect(isPaymentUrl(undefined)).toBe(false)
    expect(isPaymentUrl(`https://x.az/${'a'.repeat(2000)}`)).toBe(false)
  })

  it('makes a fresh order key the API takes', () => {
    const a = newOrderKey()
    expect(a).toMatch(/^sifaris-/)
    expect(ORDER_KEY_RE.test(a)).toBe(true)
    expect(newOrderKey()).not.toBe(a)
    expect(ORDER_KEY_RE.test('with space')).toBe(false)
    expect(ORDER_KEY_RE.test('x'.repeat(81))).toBe(false)
  })

  it('words every refusal of the API in Azerbaijani', () => {
    expect(orderErrorMessage(401, 'unauthorized')).toEqual({ error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true })
    expect(orderErrorMessage(409, 'listing.wrong-status').error).toMatch(/Yalnız aktiv elanı/)
    expect(orderErrorMessage(404, 'listing.not-found').error).toMatch(/Elan tapılmadı/)
    expect(orderErrorMessage(400, 'validation').error).toMatch(/satışda deyil/)
    expect(orderErrorMessage(429, 'promotion-order.too-many').error).toMatch(/Bir saat sonra/)
    expect(orderErrorMessage(503, 'payment.unavailable').error).toMatch(/hələ qoşulmayıb/)
    expect(orderErrorMessage(422, 'idempotency.key-reused').error).toMatch(/yenidən «Ödə»/)
    expect(orderErrorMessage(500, undefined).error).toMatch(/pul çıxılmayıb/)
    for (const code of ['listing.wrong-status', 'validation', 'payment.unavailable', undefined]) expect(orderErrorMessage(400, code).error).not.toMatch(/vip/i)
  })

  it('retries a failed order with the same listing and option', () => {
    expect(retryPath({ listingId: LISTING, optionId: 'paket-7' })).toBe(`/reklam?elan=${LISTING}&secim=paket-7`)
  })

  it('opens the planner on ?secim= when it is on offer, else on «Önə çıxar» 7 days', () => {
    expect(initialChoice(promotionPackages, 'paket-15')).toEqual({ packageId: 'paket', optionId: 'paket-15' })
    expect(initialChoice(promotionPackages, 'ireli-cek-1')).toEqual({ packageId: 'ireli-cek', optionId: 'ireli-cek-1' })
    expect(initialChoice(promotionPackages, 'no-such-option')).toEqual({ packageId: 'one-cixar', optionId: 'one-cixar-7' })
    expect(initialChoice(promotionPackages, null)).toEqual({ packageId: 'one-cixar', optionId: 'one-cixar-7' })
    // The API's catalogue without «7 gün»: the first option of «Önə çıxar».
    const noSeven = promotionPackages.map((p) => ({ ...p, options: p.options.filter((o) => o.id !== 'one-cixar-7') }))
    expect(initialChoice(noSeven, null)).toEqual({ packageId: 'one-cixar', optionId: 'one-cixar-3' })
    expect(initialChoice([], null)).toEqual({ packageId: 'one-cixar', optionId: '' })
  })

  it('names an order’s package and option from the catalogue', () => {
    expect(describeOption(promotionPackages, 'one-cixar-7')).toEqual({ packageId: 'one-cixar', name: 'Önə çıxar', label: '7 gün', days: 7 })
    expect(describeOption(promotionPackages, 'ireli-cek-1')).toEqual({ packageId: 'ireli-cek', name: 'İrəli çək', label: '1 dəfə' })
    expect(describeOption(promotionPackages, 'x')).toBeUndefined()
  })

  it('keeps ApiError’s problem for the Server Action', () => {
    const error = new ApiError(429, 'promotion-order.too-many', 'promotion-orders', { code: 'promotion-order.too-many' }, 3600)
    expect(orderErrorMessage(error.status, error.code).error).toMatch(/24 saatda/)
  })
})
