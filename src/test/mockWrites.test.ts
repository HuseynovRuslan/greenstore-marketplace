import { describe, expect, it } from 'vitest'
import { listingById, listings } from '@/data/listings'
import { DEMO_OTP_CODE, maskPhone, mockListingStats, mockOtp } from '@/services/mockWrites'
import { mockRepository } from '@/services/mockRepository'

describe('mock SMS code', () => {
  const now = 1_762_500_000_000

  it('masks the number and accepts the demo code', () => {
    const challenge = mockOtp.request('+994 50 555 12 34', now)
    expect(challenge.phoneMasked).toBe('+994 50 *** ** 34')
    expect(challenge.demoCode).toBe(DEMO_OTP_CODE)
    expect(mockOtp.verify(challenge.challengeId, DEMO_OTP_CODE, now + 1000)).toEqual({ ok: true })
  })

  it('counts wrong codes down and then locks the challenge', () => {
    const { challengeId } = mockOtp.request('+994 70 111 22 33', now)
    expect(mockOtp.verify(challengeId, '0000', now)).toEqual({ ok: false, error: 'wrong-code', attemptsLeft: 4 })
    for (let i = 0; i < 3; i++) mockOtp.verify(challengeId, '0000', now)
    expect(mockOtp.verify(challengeId, '0000', now)).toEqual({ ok: false, error: 'too-many-attempts', attemptsLeft: 0 })
    expect(mockOtp.verify(challengeId, DEMO_OTP_CODE, now).error).toBe('too-many-attempts')
  })

  it('expires after five minutes', () => {
    const { challengeId } = mockOtp.request('+994 55 000 00 01', now)
    expect(mockOtp.verify(challengeId, DEMO_OTP_CODE, now + 301_000)).toEqual({ ok: false, error: 'expired' })
  })

  it('refuses a malformed number', () => {
    expect(() => mockOtp.request('12345', now)).toThrow()
    expect(maskPhone('abc')).toBe('+994 ** *** ** **')
  })
})

describe('mock listing statistics', () => {
  it('is deterministic and keeps the listing view total', () => {
    const listing = listingById('zeytun-agaci')!
    const a = mockListingStats(listing, new Date('2026-11-07T10:00:00'))
    const b = mockListingStats(listing, new Date('2026-11-07T10:00:00'))
    expect(a).toEqual(b)
    expect(a.views).toBe(248)
    expect(a.viewsByDay).toHaveLength(14)
    expect(a.viewsByDay.at(-1)?.date).toBe('2026-11-07')
    expect(a.phoneReveals).toBeGreaterThan(0)
  })
})

describe('mock repository additions', () => {
  it('lists every status of the demo seller', async () => {
    const own = await mockRepository.listOwnListings('abseron-tingcilik')
    expect(new Set(own.map((l) => l.status))).toEqual(new Set(['active', 'pending', 'expired', 'rejected', 'inactive']))
    expect(own.find((l) => l.status === 'rejected')?.rejectionReason).toBeTruthy()
  })

  it('merges the plant facts into the listings', () => {
    expect(listings.find((l) => l.id === 'zeytun-agaci')?.plant?.species).toBe('Olea europaea')
  })

  it('prices a promotion option and refuses an unknown one', async () => {
    const order = await mockRepository.createPromotionOrder({ listingId: 'zeytun-agaci', packageId: 'one-cixar', optionId: 'one-cixar-7' })
    expect(order).toMatchObject({ amount: 9, status: 'paid', packageId: 'one-cixar' })
    await expect(mockRepository.createPromotionOrder({ listingId: 'zeytun-agaci', packageId: 'ireli-cek', optionId: 'one-cixar-7' })).rejects.toThrow()
  })

  it('keeps a hidden number hidden', async () => {
    expect(await mockRepository.revealPhone('limon-agaci')).toEqual({})
    expect((await mockRepository.revealPhone('zeytun-agaci')).phone).toBe('+994 50 555 12 34')
  })
})
