import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listingById } from '@/data/listings'
import { promotionPackages } from '@/data/promotions'
import { cardErrors, formatCard, formatExpiry, luhn } from '@/features/promotion/card'
import { PromotionPlanner } from '@/features/promotion/PromotionPlanner'
import { AppStoreProvider } from '@/state/store'

// Long user-event flows: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/reklam',
  useSearchParams: () => new URLSearchParams('elan=tuya-smaragd'),
}))
vi.mock('@/features/cabinet/actions', () => ({
  loadOwnListings: async () => ({ ok: true, listings: [listingById('tuya-smaragd')!, listingById('lavanda-fidani')!], stats: {} }),
}))
const buyPromotion = vi.fn(async (input: { listingId: string; packageId: string; optionId: string }) => ({
  ok: true as const,
  order: { id: 'ord-5100', listingId: input.listingId, packageId: input.packageId as 'one-cixar', optionId: input.optionId, amount: 9, status: 'paid' as const, createdAt: '' },
}))
vi.mock('@/features/promotion/actions', () => ({ buyPromotion: (input: { listingId: string; packageId: string; optionId: string }) => buyPromotion(input) }))

describe('mock card checks', () => {
  it('formats and validates a card', () => {
    expect(formatCard('4111111111111111')).toBe('4111 1111 1111 1111')
    expect(formatExpiry('8')).toBe('08')
    expect(formatExpiry('0828')).toBe('08/28')
    expect(luhn('4111111111111111')).toBe(true)
    expect(luhn('4111111111111112')).toBe(false)
    const now = new Date('2026-11-07')
    expect(cardErrors({ number: '4111 1111 1111 1111', expiry: '08/28', cvc: '123' }, now)).toEqual({})
    expect(cardErrors({ number: '4111 1111', expiry: '13/28', cvc: '1' }, now)).toEqual({
      number: expect.stringMatching(/16 rəqəmi/),
      expiry: expect.stringMatching(/AA\/İİ/),
      cvc: expect.stringMatching(/3 rəqəmi/),
    })
    expect(cardErrors({ number: '4111 1111 1111 1111', expiry: '10/26', cvc: '123' }, now).expiry).toBe('Kartın müddəti bitib.')
  })
})

describe('promotion planner', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('greenstore:session', JSON.stringify({ id: 'u-elvin', fullName: 'Elvin Əliyev', email: 'e@x.az', phone: '+994 50 555 12 34', accountType: 'business', sellerId: 'abseron-tingcilik' }))
  })

  it('buys «Önə çıxar» for the listing from the link and marks it in the cabinet', async () => {
    const user = userEvent.setup()
    render(
      <AppStoreProvider>
        <PromotionPlanner packages={promotionPackages} />
      </AppStoreProvider>,
    )
    // Only active listings can be promoted; the one from ?elan= is chosen.
    expect(await screen.findByRole('radio', { name: /Tuya — Smaragd/ })).toBeChecked()
    expect(screen.queryByRole('radio', { name: /Lavanda/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /3 gün · 5 ₼/ }))
    await user.click(screen.getByRole('button', { name: '5 ₼ ödə' }))
    const dialog = screen.getByRole('dialog', { name: 'Ödəniş' })
    await user.click(within(dialog).getByRole('button', { name: /ödə/ }))
    expect(within(dialog).getByText('Kart nömrəsini yazın.')).toBeInTheDocument()
    expect(buyPromotion).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Kart nömrəsi'), '4111111111111111')
    await user.type(within(dialog).getByLabelText('Bitmə tarixi'), '0829')
    await user.type(within(dialog).getByLabelText('CVC'), '123')
    await user.click(within(dialog).getByRole('button', { name: /ödə/ }))
    expect(buyPromotion).toHaveBeenCalledWith({ listingId: 'tuya-smaragd', packageId: 'one-cixar', optionId: 'one-cixar-3' })
    expect(await within(dialog).findByText('Paket aktivdir')).toBeInTheDocument()
    const changes = JSON.parse(localStorage.getItem('greenstore:cabinet:changes') ?? '{}')
    expect(changes['tuya-smaragd'].promotion.packageId).toBe('one-cixar')
  })
})
