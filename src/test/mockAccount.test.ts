import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_ACCOUNT_FAVORITES, DEMO_SAVED_SEARCHES } from '@/data/user'
import { mockRepository as repo } from '@/services/mockRepository'
import { mockAccount, mockOtp } from '@/services/mockWrites'

/*
 * DATA_SOURCE=mock has no server session: the account methods (backend-contract.md 2.1–2.3) answer for the demo
 * account, from memory, as the API would. The pages in mock mode keep signing in in the browser (auth.test.tsx).
 */

const verified = (phone = '505551234') => mockOtp.request(phone).challengeId

describe('mock repository: the demo account', () => {
  beforeEach(() => mockAccount.reset())

  it('signs in the demo account with any well-formed login and an 8-character password', async () => {
    expect(await repo.login({ login: '050 555 12 34', password: 'greenstore' })).toMatchObject({ ok: true, user: { id: 'u-elvin', role: 'user', locale: 'az', sellerId: 'abseron-tingcilik' } })
    expect(await repo.login({ login: 'elvin@bag.az', password: 'greenstore' })).toMatchObject({ ok: true })
    expect(await repo.login({ login: 'elvin@', password: 'greenstore' })).toEqual({ ok: false, error: 'wrong-credentials' })
    expect(await repo.login({ login: '0505551234', password: 'qisa' })).toEqual({ ok: false, error: 'wrong-credentials' })
    expect(await repo.loginWithOtp({ otpChallengeId: verified() })).toMatchObject({ ok: true })
    await expect(repo.loginWithOtp({ otpChallengeId: 'otp.bad' })).rejects.toThrow()
  })

  it('registers a new account signed in at once, without a seller page yet', async () => {
    const result = await repo.register({ accountType: 'business', businessKind: 'nursery', companyName: 'Yaşıl', fullName: ' Nigar ', phone: '+994555123456', password: 'bag2026xx', otpChallengeId: verified('555123456') })
    expect(result).toMatchObject({ ok: true, user: { fullName: 'Nigar', phone: '+994 55 512 34 56', email: '', accountType: 'business', role: 'user', locale: 'az' } })
    expect(result.ok && result.user.sellerId).toBeUndefined()
  })

  it('changes the profile, the password and the phone', async () => {
    expect((await repo.updateMe({ fullName: 'Elvin Ə.', email: '' })).email).toBe('')
    expect((await repo.getMe())?.fullName).toBe('Elvin Ə.')
    expect(await repo.changePassword({ current: 'x', next: 'yeni2026x' })).toEqual({ ok: true })
    expect(await repo.changePassword({ current: '', next: 'yeni2026x' })).toEqual({ ok: false })
    expect((await repo.changePhone({ otpChallengeId: verified('707654321') })).phone).toBe('+994 70 765 43 21')
  })

  it('reads and edits the demo «mağaza» with a version, without changing the public demo page', async () => {
    const own = (await repo.getOwnSeller())!
    expect(own).toMatchObject({ slug: 'abseron-tingcilik', phone: '+994 50 555 12 34', version: '1' })
    const changed = await repo.updateOwnSeller({ about: 'Yeni mətn', address: '', version: own.version })
    expect(changed).toMatchObject({ about: 'Yeni mətn', version: '2' })
    expect(changed.address).toBeUndefined()
    await expect(repo.updateOwnSeller({ about: 'Köhnə versiya', version: '1' })).rejects.toThrow()
    expect((await repo.getSeller('abseron-tingcilik'))?.about).not.toBe('Yeni mətn')
  })

  it('keeps the favourites: Figma’s list, adds and removes, merges a guest’s known keys in their order', async () => {
    expect(await repo.listFavorites()).toEqual(DEMO_ACCOUNT_FAVORITES)
    await repo.setFavorite('listing', 'limon-agaci', false)
    await repo.setFavorite('listing', 'tuya-smaragd', true)
    const merged = await repo.mergeFavorites(['listing:alma-fidani', 'listing:yoxdur', 'bad', 'listing:lavanda-fidani', 'listing:tuya-smaragd', 'service:landsaft-dizayni'])
    expect(merged.slice(-2)).toEqual(['listing:tuya-smaragd', 'listing:alma-fidani'])
    // Not for sale (the demo's pending listing): skipped, like the API.
    expect(merged).not.toContain('listing:lavanda-fidani')
    expect(merged).not.toContain('listing:limon-agaci')
    expect(merged).not.toContain('listing:yoxdur')
    const items = await repo.listFavoriteItems()
    expect(items.listings.map((l) => l.id)).toContain('alma-fidani')
    expect(items.listings.every((l) => !('contactPhone' in l))).toBe(true)
    expect(items.services.map((s) => s.id)).toEqual(['landsaft-dizayni'])
  })

  it('saves a search once per filters, newest first, and counts it opened', async () => {
    expect((await repo.listSavedSearches()).map((s) => s.id)).toEqual(DEMO_SAVED_SEARCHES.map((s) => s.id))
    const saved = await repo.saveSearch({ name: ' Quba ', query: 'seher=quba&sehife=2', alerts: false })
    expect(saved).toMatchObject({ name: 'Quba', query: 'seher=quba', newCount: 0 })
    const again = await repo.saveSearch({ name: 'Quba, yenə', query: 'seher=quba', alerts: true })
    expect(again.id).toBe(saved.id)
    expect((await repo.listSavedSearches())[0]).toMatchObject({ id: saved.id, name: 'Quba, yenə', alerts: true })
    expect((await repo.markSavedSearchOpened('ss-demo-1')).newCount).toBe(0)
    expect((await repo.updateSavedSearch('ss-demo-1', { name: 'Ağaclar' })).name).toBe('Ağaclar')
    await repo.deleteSavedSearch('ss-demo-2')
    expect((await repo.listSavedSearches()).map((s) => s.id)).not.toContain('ss-demo-2')
    await expect(repo.updateSavedSearch('yoxdur', { alerts: true })).rejects.toThrow()
  })

  it('lists «Elanlarım» of the demo session’s seller (backend-contract.md 2.2)', async () => {
    const own = await repo.listOwnListings()
    expect(own.length).toBeGreaterThan(0)
    expect(own.every((l) => l.sellerId === 'abseron-tingcilik')).toBe(true)
  })
})
