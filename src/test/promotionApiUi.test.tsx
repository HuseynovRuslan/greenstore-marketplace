import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/Toast'
import { promotionPackages } from '@/data/promotions'
import type { AccountProfile } from '@/data/user'
import { encodeSessionHint, SESSION_HINT_COOKIE } from '@/state/bootstrap'
import { AppStoreProvider } from '@/state/store'
import type { OwnListing, PromotionOrder } from '@/types'

/*
 * DATA_SOURCE=api in the browser, phase 5 (backend-contract.md 5.1): «Ödə» on /reklam sends the visitor to the payment
 * provider's page (no card form on the site), the cabinet shows «Önə çıxan» and the choice made while posting, and the
 * return page /kabinet/odenis says what the API's order says. The Server Actions and the repository are fakes.
 */

vi.setConfig({ testTimeout: 20_000 })

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  params: new URLSearchParams(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: nav.refresh }),
  usePathname: () => '/reklam',
  useSearchParams: () => nav.params,
  notFound: nav.notFound,
}))

const account = vi.hoisted(() => ({ loadSession: vi.fn(), setFavorite: vi.fn(), mergeFavorites: vi.fn(), signOut: vi.fn() }))
vi.mock('@/features/account/actions', () => account)

const cabinet = vi.hoisted(() => ({ loadOwnListings: vi.fn(), changeOwnListing: vi.fn() }))
vi.mock('@/features/cabinet/actions', () => cabinet)

const promotion = vi.hoisted(() => ({ buyPromotion: vi.fn(), refreshPromotedListing: vi.fn(), loadPromotionPackages: vi.fn() }))
vi.mock('@/features/promotion/actions', () => promotion)

const openPaymentPage = vi.hoisted(() => vi.fn())
vi.mock('@/features/promotion/checkout', async (original) => ({ ...(await original<typeof import('@/features/promotion/checkout')>()), openPaymentPage }))

const repo = vi.hoisted(() => ({} as Record<string, ReturnType<typeof vi.fn>>))
vi.mock('@/services/repository', () => ({ getRepository: () => repo }))

const { PromotionPlanner } = await import('@/features/promotion/PromotionPlanner')
const { forgetPromotionPackages } = await import('@/features/promotion/usePromotionPackages')
const { PaymentStatusWatcher, POLL_MS, POLL_TRIES } = await import('@/features/promotion/PaymentStatusWatcher')
const { default: DashboardPage } = await import('@/views/account/DashboardPage')
const { default: PaymentResultPage } = await import('@/views/account/PaymentResultPage')
const { default: PromotionPage } = await import('@/views/PromotionPage')

const LISTING = '01937a52-0000-7a1b-9f00-2d5c1e4b8a10'
const ORDER = '01937a52-1111-7a1b-9f00-2d5c1e4b8a10'
const PAY = 'http://localhost:5080/api/v1/payments/fake/checkout/fake_abc?return=%2Fkabinet%2Fodenis%3Forder%3D1'

const business: AccountProfile = {
  id: '0193-u',
  fullName: 'Nigar Rzayeva',
  email: '',
  phone: '+994 55 512 34 56',
  accountType: 'business',
  sellerId: '0193-s',
  role: 'user',
  locale: 'az',
  phoneVerified: true,
  companyName: 'Yaşıl Həyət',
}

const own = (patch: Partial<OwnListing> = {}): OwnListing => ({
  id: LISTING,
  slug: 'tuya-smaragd-140-sm-20324',
  number: 20324,
  title: 'Tuya Smaragd — 140 sm',
  price: 55,
  attributes: ['140 sm'],
  cityId: 'abseron',
  publishedAt: '2026-11-22T09:00:00Z',
  vip: false,
  categoryId: 'agaclar',
  cover: 'http://localhost:5080/media/p/x/1280.webp',
  images: ['http://localhost:5080/media/p/x/1280.webp'],
  sellerId: '0193-s',
  status: 'active',
  kind: 'product',
  contactPhoneVerified: true,
  version: '9',
  photoIds: ['p1'],
  ...patch,
})

const order = (patch: Partial<PromotionOrder> = {}): PromotionOrder => ({
  id: ORDER,
  number: 1001,
  listingId: LISTING,
  packageId: 'one-cixar',
  optionId: 'one-cixar-7',
  amount: 9,
  status: 'paid',
  createdAt: '2026-11-22T10:00:00Z',
  paidAt: '2026-11-22T10:01:00Z',
  ...patch,
})

const setHint = () => (document.cookie = `${SESSION_HINT_COOKIE}=${encodeURIComponent(encodeSessionHint({ initials: 'NR', issuedAt: 1 }))}; path=/`)
const inApi = (ui: ReactNode) =>
  render(
    <AppStoreProvider dataSource="api">
      <ToastProvider>{ui}</ToastProvider>
    </AppStoreProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  nav.params = new URLSearchParams()
  for (const fn of [nav.push, nav.refresh, nav.notFound, openPaymentPage, ...Object.values(account), ...Object.values(cabinet), ...Object.values(promotion)]) fn.mockClear()
  for (const key of Object.keys(repo)) delete repo[key]
  account.loadSession.mockResolvedValue({ account: business, favorites: [] })
  account.mergeFavorites.mockResolvedValue({ ok: true, favorites: [] })
  promotion.refreshPromotedListing.mockResolvedValue({ ok: true })
  promotion.loadPromotionPackages.mockResolvedValue(promotionPackages)
  forgetPromotionPackages()
})

afterEach(() => {
  document.cookie = `${SESSION_HINT_COOKIE}=; path=/; max-age=0`
  vi.useRealTimers()
})

describe('/reklam with DATA_SOURCE=api', () => {
  it('sends the owner to the provider’s page: no card form, the same key for the same «Ödə»', async () => {
    setHint()
    nav.params = new URLSearchParams(`elan=${LISTING}`)
    cabinet.loadOwnListings.mockResolvedValue({ ok: true, listings: [own(), own({ id: 'p-2', title: 'Lavanda', status: 'pending' })], stats: {} })
    promotion.buyPromotion.mockResolvedValue({ ok: true, order: order({ status: 'pending', paidAt: undefined }), paymentUrl: PAY })
    const user = userEvent.setup()

    inApi(<PromotionPlanner packages={promotionPackages} />)
    expect(await screen.findByRole('radio', { name: /Tuya Smaragd/ })).toBeChecked()
    // Only an active listing can be promoted.
    expect(screen.queryByRole('radio', { name: /Lavanda/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '9 ₼ ödə' }))
    const dialog = screen.getByRole('dialog', { name: 'Ödəniş' })
    expect(within(dialog).queryByLabelText('Kart nömrəsi')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/GreenStore onu görmür/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Demo/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '9 ₼ ödə' }))
    await waitFor(() => expect(openPaymentPage).toHaveBeenCalledWith(PAY))
    const [input, key] = promotion.buyPromotion.mock.calls[0]
    expect(input).toEqual({ listingId: LISTING, packageId: 'one-cixar', optionId: 'one-cixar-7' })
    expect(key).toMatch(/^sifaris-/)
    // Leaving for the provider: the button stays busy.
    expect(within(dialog).getByRole('button', { name: 'Ödəniş səhifəsi açılır…' })).toBeDisabled()
    // Nothing is kept in this browser: the API starts the promotion once the provider confirms.
    expect(localStorage.getItem('greenstore:cabinet:changes')).toBeNull()
  })

  it('says why the API refused, with «Daxil ol» when the session has ended, and lets the owner try again', async () => {
    setHint()
    nav.params = new URLSearchParams(`elan=${LISTING}&secim=paket-7`)
    cabinet.loadOwnListings.mockResolvedValue({ ok: true, listings: [own()], stats: {} })
    promotion.buyPromotion.mockResolvedValueOnce({ ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.', signedOut: true })
    promotion.buyPromotion.mockResolvedValueOnce({ ok: false, error: 'Onlayn ödəniş hələ qoşulmayıb. Bir az sonra yenidən cəhd edin.' })
    const user = userEvent.setup()

    inApi(<PromotionPlanner packages={promotionPackages} />)
    // ?secim= opens on the option chosen while posting.
    expect(await screen.findByRole('radio', { name: /7 gün · 13 ₼/ })).toBeChecked()
    await user.click(await screen.findByRole('button', { name: '13 ₼ ödə' }))
    const dialog = screen.getByRole('dialog', { name: 'Ödəniş' })
    await user.click(within(dialog).getByRole('button', { name: '13 ₼ ödə' }))
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent('Sessiyanın vaxtı bitib')
    expect(within(alert).getByRole('link', { name: 'Daxil ol' })).toHaveAttribute('href', `/daxil-ol?next=${encodeURIComponent(`/reklam?elan=${LISTING}`)}`)

    await user.click(within(dialog).getByRole('button', { name: '13 ₼ ödə' }))
    expect(await within(dialog).findByText(/hələ qoşulmayıb/)).toBeInTheDocument()
    // The same «Ödə» again: the same key, so the API answers the same order instead of a second one.
    expect(promotion.buyPromotion.mock.calls[1][1]).toBe(promotion.buyPromotion.mock.calls[0][1])
    expect(promotion.buyPromotion.mock.calls[0][0]).toEqual({ listingId: LISTING, packageId: 'paket', optionId: 'paket-7' })
    expect(openPaymentPage).not.toHaveBeenCalled()
  })
})

describe('«Elanlarım» with DATA_SOURCE=api: promotions', () => {
  it('shows «Önə çıxan» from vip, the end of the running promotion, and the choice made while posting', async () => {
    setHint()
    const until = new Date(Date.now() + 5 * 86_400_000).toISOString()
    cabinet.loadOwnListings.mockResolvedValue({
      ok: true,
      listings: [
        own({ vip: true, promotion: { packageId: 'one-cixar', until } }),
        own({ id: 'l-2', slug: 'lavanda-20325', number: 20325, title: 'Lavanda fidanı', pendingPromotion: { packageId: 'one-cixar', optionId: 'one-cixar-7' } }),
        own({ id: 'l-3', slug: 'qizilgul-20326', number: 20326, title: 'Qızılgül fidanı', status: 'pending', pendingPromotion: { packageId: 'paket', optionId: 'paket-15' } }),
        own({ id: 'l-4', slug: 'nar-20327', number: 20327, title: 'Nar tingi', promotion: { packageId: 'ireli-cek', until } }),
      ],
      stats: {},
    })

    inApi(<DashboardPage />)
    const row = (title: string) => screen.getByRole('link', { name: title }).closest('li')!
    await screen.findByRole('link', { name: 'Tuya Smaragd — 140 sm' })

    const featured = row('Tuya Smaragd — 140 sm')
    expect(within(featured).getByText('Önə çıxan')).toBeInTheDocument()
    expect(within(featured).getByText(/^Reklam .+-dək$/)).toBeInTheDocument()
    expect(featured).not.toHaveTextContent(/vip/i)

    const toPay = row('Lavanda fidanı')
    expect(within(toPay).queryByText('Önə çıxan')).not.toBeInTheDocument()
    // The choice is named from the API's packages (they come a moment after the listings).
    expect(await within(toPay).findByRole('link', { name: /Ödə və işə sal/ })).toHaveAttribute('href', '/reklam?elan=l-2&secim=one-cixar-7')
    expect(toPay).toHaveTextContent('Elan yerləşdirəndə «Önə çıxar · 7 gün» seçmisiniz.')
    expect(promotion.loadPromotionPackages).toHaveBeenCalledTimes(1)

    const waiting = row('Qızılgül fidanı')
    expect(waiting).toHaveTextContent('yoxlamadan keçəndən sonra burada ödəyib işə sala bilərsiniz')
    expect(within(waiting).queryByRole('link', { name: /Ödə və işə sal/ })).not.toBeInTheDocument()

    // A running «İrəli çək» alone keeps its own name.
    const bumped = row('Nar tingi')
    expect(within(bumped).getByText('İrəli çək')).toBeInTheDocument()
    expect(within(bumped).queryByText('Önə çıxan')).not.toBeInTheDocument()
  })
})

describe('/reklam with DATA_SOURCE=api while nothing can be bought (the API lists no packages)', () => {
  it('says online payment is coming and points to free posting: no prices, no «Ödə»', () => {
    inApi(<PromotionPage packages={[]} demo={false} />)

    expect(screen.getByText('Onlayn ödəniş tezliklə qoşulacaq')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Elan yerləşdir' })).toHaveAttribute('href', '/elan-yerlesdir')
    expect(screen.queryByRole('button', { name: /ödə/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/₼/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Qiymətlər manatla/)).not.toBeInTheDocument()
  })
})

describe('«Elanlarım» with DATA_SOURCE=api while nothing can be bought', () => {
  it('names a choice made while posting by the API, and hides it with its «Ödə və işə sal» while it is not on sale', async () => {
    setHint()
    cabinet.loadOwnListings.mockResolvedValue({
      ok: true,
      listings: [own({ id: 'l-2', slug: 'lavanda-20325', number: 20325, title: 'Lavanda fidanı', pendingPromotion: { packageId: 'one-cixar', optionId: 'one-cixar-7' } })],
      stats: {},
    })
    promotion.loadPromotionPackages.mockResolvedValue([])

    inApi(<DashboardPage />)
    const row = (await screen.findByRole('link', { name: 'Lavanda fidanı' })).closest('li')!

    await waitFor(() => expect(promotion.loadPromotionPackages).toHaveBeenCalled())
    await act(async () => undefined)
    expect(row).not.toHaveTextContent('seçmisiniz')
    expect(within(row).queryByRole('link', { name: /Ödə və işə sal/ })).not.toBeInTheDocument()
  })
})

describe('the return page /kabinet/odenis', () => {
  const page = async (query: Record<string, string>) => inApi(await PaymentResultPage({ searchParams: Promise.resolve(query) }))

  beforeEach(() => {
    repo.getMe = vi.fn(async () => business)
    repo.listPromotionPackages = vi.fn(async () => promotionPackages)
  })

  it('says a paid «Önə çıxar» works, until when, and refreshes the listing’s pages once', async () => {
    repo.getPromotionOrder = vi.fn(async () => order())
    repo.getOwnListing = vi.fn(async () => own({ vip: true, promotion: { packageId: 'one-cixar', until: '2026-11-29T10:01:00Z' } }))
    await page({ order: ORDER, payment: 'paid' })

    expect(screen.getByRole('heading', { level: 1, name: 'Ödəniş qəbul olundu' })).toBeInTheDocument()
    expect(screen.getByText(/Elan 29 noyabr-dək «Önə çıxan» nişanı ilə ana səhifədə və axtarışın başındadır\./)).toBeInTheDocument()
    expect(screen.getByText('№ 1001')).toBeInTheDocument()
    expect(screen.getByText('Önə çıxar · 7 gün')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Elana bax' })).toHaveAttribute('href', '/elanlar/tuya-smaragd-140-sm-20324')
    expect(screen.getByRole('link', { name: 'Elanlarım' })).toHaveAttribute('href', '/kabinet')
    expect(repo.getPromotionOrder).toHaveBeenCalledWith(ORDER)
    await waitFor(() => expect(promotion.refreshPromotedListing).toHaveBeenCalledTimes(1))
    expect(promotion.refreshPromotedListing).toHaveBeenCalledWith(ORDER)
    expect(document.body).not.toHaveTextContent(/vip/i)
  })

  it('believes the API, not the address: a pending order is «yoxlanılır» and asked again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'pending', paidAt: undefined }))
    repo.getOwnListing = vi.fn(async () => own())
    await page({ order: ORDER, payment: 'paid' })

    expect(screen.getByRole('heading', { level: 1, name: 'Ödəniş yoxlanılır' })).toBeInTheDocument()
    expect(screen.getByText('Səhifə özü yenilənir…')).toBeInTheDocument()
    expect(promotion.refreshPromotedListing).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS)
    })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    for (let i = 1; i < POLL_TRIES + 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS)
      })
    }
    // A minute of asking, then it stops and offers «Yenilə».
    expect(nav.refresh).toHaveBeenCalledTimes(POLL_TRIES)
    expect(screen.getByText(/Təsdiq hələ gəlməyib/)).toBeInTheDocument()
    await act(async () => {
      screen.getByRole('button', { name: 'Yenilə' }).click()
    })
    expect(nav.refresh).toHaveBeenCalledTimes(POLL_TRIES + 1)
  })

  it('offers «Yenidən cəhd et» with the same listing and option after a failed payment', async () => {
    repo.getPromotionOrder = vi.fn(async () => order({ status: 'failed', paidAt: undefined, packageId: 'paket', optionId: 'paket-7', amount: 13 }))
    repo.getOwnListing = vi.fn(async () => own())
    await page({ order: ORDER, payment: 'failed' })

    expect(screen.getByRole('heading', { level: 1, name: 'Ödəniş alınmadı' })).toBeInTheDocument()
    expect(screen.getByText(/Kartdan pul çıxılmayıb/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Yenidən cəhd et' })).toHaveAttribute('href', `/reklam?elan=${LISTING}&secim=paket-7`)
    expect(screen.queryByRole('link', { name: 'Elana bax' })).not.toBeInTheDocument()
    expect(screen.queryByText('Ödənilib')).not.toBeInTheDocument()
  })

  it('asks a signed-out visitor to sign in and come back to the same order', async () => {
    repo.getMe = vi.fn(async () => undefined)
    repo.getPromotionOrder = vi.fn()
    await page({ order: ORDER })
    expect(screen.getByRole('link', { name: /Daxil ol/ })).toHaveAttribute('href', `/daxil-ol?next=${encodeURIComponent(`/kabinet/odenis?order=${ORDER}`)}`)
    expect(repo.getPromotionOrder).not.toHaveBeenCalled()
  })

  it('is «tapılmadı» for another account’s order, none, or an address that is not one', async () => {
    repo.getPromotionOrder = vi.fn(async () => undefined)
    await expect(PaymentResultPage({ searchParams: Promise.resolve({ order: ORDER }) })).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(PaymentResultPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(PaymentResultPage({ searchParams: Promise.resolve({ order: '../me' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(repo.getPromotionOrder).toHaveBeenCalledTimes(1)
  })
})

describe('PaymentStatusWatcher', () => {
  it('stays quiet for a failed order', () => {
    const { container } = render(<PaymentStatusWatcher orderId={ORDER} status="failed" />)
    expect(container).toBeEmptyDOMElement()
    expect(promotion.refreshPromotedListing).not.toHaveBeenCalled()
  })
})
