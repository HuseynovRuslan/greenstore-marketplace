import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NotImplementedError } from '@/services/apiRepository'
import type { Listing, OwnSeller, UserProfile } from '@/types'

/*
 * The account Server Actions with DATA_SOURCE=api (backend-contract.md 2.1–2.3): what they ask the repository, what
 * they answer the pages, and the texts of the API's refusals. The repository is a fake; the cookies a fake jar.
 */

const { repo, jar, updateTag } = vi.hoisted(() => ({
  repo: {} as Record<string, ReturnType<typeof vi.fn>>,
  jar: new Map<string, string>(),
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}))
vi.mock('@/services/repository', async (original) => ({ ...(await original<typeof import('@/services/repository')>()), getRepository: () => repo }))

const { loadSession, saveProfile, changePassword, setFavorite, mergeFavorites } = await import('@/features/account/actions')
const { registerAccount, requestCode, resetPasswordWithCode, signInWithPassword, signInWithCode, verifyCode } = await import('@/features/auth/actions')
const { loadOwnListings } = await import('@/features/cabinet/actions')

const user: UserProfile = { id: '0193-u', fullName: 'Nigar Rzayeva', email: 'nigar@bag.az', phone: '+994 55 512 34 56', accountType: 'business', sellerId: '0193-s', role: 'user', locale: 'az' }
const seller = { id: '0193-s', slug: 'yasil-heyet', name: 'Yaşıl Həyət', kind: 'Bağ mərkəzi', businessKind: 'garden-centre', type: 'business', cityId: 'baki', activeListings: 0, verified: false, image: '', version: '812' } as OwnSeller
const problem = (status: number, code: string, errors?: Record<string, string[]>, retryAfterSec?: number) => new ApiError(status, code, 'x', { code, ...(errors ? { errors } : {}) }, retryAfterSec)

beforeEach(() => {
  for (const key of Object.keys(repo)) delete repo[key]
  jar.clear()
  updateTag.mockClear()
  vi.stubEnv('DATA_SOURCE', 'api')
  Object.assign(repo, {
    getMe: vi.fn(async () => user),
    getOwnSeller: vi.fn(async () => seller),
    listFavorites: vi.fn(async () => ['listing:0193-l']),
  })
})

describe('sign-in actions', () => {
  const registration = { accountType: 'business' as const, businessKind: 'garden-centre' as const, companyName: ' Yaşıl Həyət ', fullName: 'Nigar Rzayeva', phone: '55 512 34 56', password: 'yasil2026', otpChallengeId: 'c-1' }

  it('registers a business: the account comes with its «mağaza», and the sellers’ cached reads are refreshed', async () => {
    repo.register = vi.fn(async () => ({ ok: true, user }))
    const result = await registerAccount(registration)
    expect(repo.register).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Yaşıl Həyət', phone: '+994555123456', otpChallengeId: 'c-1' }))
    expect(result).toMatchObject({ ok: true, userId: '0193-u', account: { companyName: 'Yaşıl Həyət', businessType: 'Bağ mərkəzi', sellerSlug: 'yasil-heyet', sellerVersion: '812', phoneVerified: true } })
    expect(updateTag).toHaveBeenCalledWith('sellers')
  })

  it('says why a registration was refused', async () => {
    const answers: Array<[ApiError, RegExp]> = [
      [problem(409, 'account.phone-taken'), /Bu nömrə ilə hesab artıq var/],
      [problem(409, 'account.email-taken'), /Bu e-poçt başqa hesabdadır/],
      [problem(400, 'otp.not-verified'), /təsdiqinin vaxtı keçib/],
      [problem(400, 'validation', { password: ['too-weak'] }), /hərf və rəqəm/],
      [problem(400, 'validation', { companyName: ['too-long'] }), /2–80 simvol/],
    ]
    for (const [error, text] of answers) {
      repo.register = vi.fn(async () => {
        throw error
      })
      const result = await registerAccount(registration)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error).toMatch(text)
    }
  })

  it('keeps the mock’s answer in DATA_SOURCE=mock: the browser signs the demo in', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    repo.register = vi.fn(async () => ({ ok: true, user }))
    expect(await registerAccount(registration)).toEqual({ ok: true, userId: '0193-u' })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('signs in with a password or a code, and words the refusals', async () => {
    repo.login = vi.fn(async () => ({ ok: true, user: { ...user, accountType: 'individual', sellerId: undefined } }))
    expect(await signInWithPassword(' +994 55 512 34 56 ', 'yasil2026')).toMatchObject({ ok: true, account: { id: '0193-u', accountType: 'individual' } })
    expect(repo.login).toHaveBeenCalledWith({ login: '+994 55 512 34 56', password: 'yasil2026' })
    expect(repo.getOwnSeller).not.toHaveBeenCalled()

    repo.login = vi.fn(async () => ({ ok: false, error: 'locked', retryAfterSec: 840 }))
    expect(await signInWithPassword('x@y.az', 'p')).toEqual({ ok: false, error: 'Çox səhv cəhd oldu. 14 dəqiqə sonra yenidən yoxlayın və ya SMS kodu ilə daxil olun.' })
    repo.login = vi.fn(async () => ({ ok: false, error: 'wrong-credentials' }))
    expect(await signInWithPassword('x@y.az', 'p')).toEqual({ ok: false, error: 'Telefon, e-poçt və ya şifrə səhvdir.' })
    expect(await signInWithPassword('', 'p')).toMatchObject({ ok: false })

    repo.loginWithOtp = vi.fn(async () => ({ ok: false, error: 'blocked' }))
    expect(await signInWithCode('c-2')).toEqual({ ok: false, error: 'Hesabınız bloklanıb. Dəstək xidməti ilə əlaqə saxlayın.' })
    repo.loginWithOtp = vi.fn(async () => {
      throw problem(400, 'otp.not-verified')
    })
    expect(await signInWithCode('c-2')).toEqual({ ok: false, error: 'Kodun vaxtı bitib. Yenisini istəyin.' })
    repo.loginWithOtp = vi.fn(async () => {
      throw problem(429, 'rate-limited', undefined, 30)
    })
    expect(await signInWithCode('c-2')).toEqual({ ok: false, error: 'Çox cəhd oldu. 30 saniyə sonra yenidən yoxlayın.' })
    repo.loginWithOtp = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await signInWithCode('c-2')).toEqual({ ok: false, error: 'Server indi cavab vermir. Bir az sonra yenidən cəhd edin.' })
  })

  it('tells a wrong or expired code apart from a wait and from the API being down', async () => {
    repo.verifyOtp = vi.fn(async () => ({ ok: false, error: 'wrong-code', attemptsLeft: 3 }))
    expect(await verifyCode('c-1', '1234')).toEqual({ ok: false, error: 'wrong-code', attemptsLeft: 3 })
    const answers: Array<[unknown, object]> = [
      [problem(404, 'not-found'), { ok: false, error: 'expired' }],
      [problem(429, 'rate-limited', undefined, 45), { ok: false, message: 'Çox cəhd oldu. 45 saniyə sonra yenidən yoxlayın.' }],
      [problem(503, 'unavailable'), { ok: false, message: 'Server indi cavab vermir. Bir az sonra yenidən cəhd edin.' }],
      [new TypeError('fetch failed'), { ok: false, message: 'Server indi cavab vermir. Bir az sonra yenidən cəhd edin.' }],
    ]
    for (const [error, answer] of answers) {
      repo.verifyOtp = vi.fn(async () => {
        throw error
      })
      expect(await verifyCode('c-1', '1234')).toEqual(answer)
    }
  })

  it('says why no SMS code was sent', async () => {
    const answers: Array<[ApiError, string]> = [
      [problem(404, 'account.not-found'), 'Bu nömrə ilə hesab tapılmadı. Nömrəni yoxlayın və ya qeydiyyatdan keçin.'],
      [problem(429, 'otp.too-soon', undefined, 42), 'Yeni kodu 42 saniyə sonra istəyə bilərsiniz.'],
      [problem(429, 'otp.phone-limit', undefined, 1800), 'Çox kod istənilib. 30 dəqiqə sonra yenidən cəhd edin.'],
      [problem(400, 'validation', { phone: ['not-mobile'] }), 'Kod yalnız mobil nömrəyə göndərilir: 50, 51, 55, 70, 77, 99, 10 və ya 60 ilə başlayan.'],
      [problem(503, 'otp.unavailable'), 'SMS göndərmək indi alınmadı. Bir az sonra yenidən cəhd edin.'],
    ]
    for (const [error, text] of answers) {
      repo.requestOtp = vi.fn(async () => {
        throw error
      })
      expect(await requestCode('12 345 67 89', 'login')).toEqual({ ok: false, error: text })
    }
  })

  it('resets the password, then signs in with it (the API ends every session on a reset)', async () => {
    repo.resetPassword = vi.fn(async () => ({ ok: true }))
    repo.login = vi.fn(async () => ({ ok: true, user }))
    expect(await resetPasswordWithCode('c-3', 'yeni2026x', '+994 55 512 34 56')).toMatchObject({ ok: true, account: { id: '0193-u' } })
    expect(repo.login).toHaveBeenCalledWith({ login: '+994555123456', password: 'yeni2026x' })
    repo.resetPassword = vi.fn(async () => ({ ok: false }))
    expect(await resetPasswordWithCode('c-3', 'yeni2026x', '+994 55 512 34 56')).toEqual({ ok: false, error: 'Təsdiqin vaxtı keçib. Kodu yenidən istəyin.' })
  })
})

describe('account actions', () => {
  it('loads the session’s account with its «mağaza» and favourites', async () => {
    jar.set('gs_session', 't')
    const state = await loadSession()
    expect(state).toMatchObject({ account: { id: '0193-u', companyName: 'Yaşıl Həyət', sellerSlug: 'yasil-heyet' }, favorites: ['listing:0193-l'] })
    // An old or missing hint is written again (the API's session slides; the cookies follow).
    expect(jar.get('gs_hint')).toContain('"i":"NR"')
  })

  it('forgets the cookies of an ended session, and keeps the browser’s hint when the API is down', async () => {
    jar.set('gs_hint', '{"i":"NR","t":1}')
    repo.getMe = vi.fn(async () => undefined)
    expect(await loadSession()).toEqual({ account: null, favorites: [] })
    expect(jar.has('gs_hint')).toBe(false)

    jar.set('gs_hint', '{"i":"NR","t":1}')
    repo.getMe = vi.fn(async () => {
      throw new ApiError(503, undefined, 'me')
    })
    expect(await loadSession()).toEqual({ account: null, favorites: [], unavailable: true })
    expect(jar.has('gs_hint')).toBe(true)
  })

  it('saves the profile: the account, then the «mağaza» with its version; the public page is refreshed', async () => {
    repo.updateMe = vi.fn(async (patch: Partial<UserProfile>) => ({ ...user, ...patch }))
    repo.updateOwnSeller = vi.fn(async (patch: Partial<OwnSeller>) => ({ ...seller, ...patch, version: '813' }))
    const result = await saveProfile({ fullName: ' Nigar R. ', email: '', companyName: 'Yaşıl Həyət Bağ', businessType: 'Landşaft şirkəti', cityId: 'quba', address: ' Quba ', about: '' })
    expect(repo.updateMe).toHaveBeenCalledWith({ fullName: 'Nigar R.', email: '' })
    expect(repo.updateOwnSeller).toHaveBeenCalledWith({ name: 'Yaşıl Həyət Bağ', contactPerson: 'Nigar R.', address: 'Quba', about: '', businessKind: 'landscaping', cityId: 'quba', version: '812' })
    expect(result).toMatchObject({ ok: true, account: { fullName: 'Nigar R.', companyName: 'Yaşıl Həyət Bağ', cityId: 'quba', sellerVersion: '813' } })
    expect(updateTag).toHaveBeenCalledWith('sellers')
  })

  it('sends the «mağaza»’s version the form was loaded with, and saves nothing when another tab changed it since', async () => {
    repo.updateMe = vi.fn(async () => user)
    repo.updateOwnSeller = vi.fn(async () => ({ ...seller, version: '813' }))
    expect(await saveProfile({ fullName: 'Nigar', email: '', companyName: 'Yaşıl Həyət', sellerVersion: '812' })).toMatchObject({ ok: true })
    expect(repo.updateOwnSeller).toHaveBeenCalledWith(expect.objectContaining({ version: '812' }))

    repo.updateMe.mockClear()
    repo.updateOwnSeller.mockClear()
    expect(await saveProfile({ fullName: 'Nigar', email: '', companyName: 'Yaşıl Həyət', sellerVersion: '790' })).toEqual({
      ok: false,
      error: 'Profil başqa cihazda dəyişdirilib. Səhifəni yeniləyin və yenidən yoxlayın.',
    })
    expect(repo.updateMe).not.toHaveBeenCalled()
    expect(repo.updateOwnSeller).not.toHaveBeenCalled()
  })

  it('an individual account saves its name and e-mail only', async () => {
    const individual = { ...user, accountType: 'individual' as const, sellerId: undefined }
    repo.getMe = vi.fn(async () => individual)
    repo.updateMe = vi.fn(async () => individual)
    repo.updateOwnSeller = vi.fn()
    expect(await saveProfile({ fullName: 'Rəşad', email: 'r@bag.az', cityId: 'quba', address: 'x' })).toMatchObject({ ok: true })
    expect(repo.updateOwnSeller).not.toHaveBeenCalled()
  })

  it('checks every field against the API’s rules before anything is saved', async () => {
    repo.updateMe = vi.fn(async () => user)
    repo.updateOwnSeller = vi.fn(async () => seller)
    const cases: Array<[Parameters<typeof saveProfile>[0], string, string]> = [
      [{ fullName: 'Nigar', email: '', companyName: 'Y' }, 'company', 'Şirkətin adı ən azı 2 simvol olsun.'],
      [{ fullName: 'Nigar', email: '', companyName: ' ' }, 'company', 'Şirkətin adını yazın.'],
      [{ fullName: 'Nigar', email: '', companyName: 'Y'.repeat(81) }, 'company', 'Şirkətin adı ən çox 80 simvol olsun.'],
      [{ fullName: ' ', email: '', companyName: 'Yaşıl' }, 'contact', 'Adınızı yazın.'],
      [{ fullName: 'N'.repeat(61), email: '', companyName: 'Yaşıl' }, 'contact', 'Ad ən çox 60 simvol olsun.'],
      [{ fullName: 'Nigar', email: 'nigar@', companyName: 'Yaşıl' }, 'email', 'E-poçt ünvanını ad@poct.az kimi yazın.'],
      [{ fullName: 'Nigar', email: '', companyName: 'Yaşıl', address: 'a'.repeat(201) }, 'address', 'Ünvan ən çox 200 simvol olsun.'],
      [{ fullName: 'Nigar', email: '', companyName: 'Yaşıl', about: 'a'.repeat(2001) }, 'about', 'Mətn ən çox 2000 simvol olsun.'],
    ]
    for (const [input, field, error] of cases) expect(await saveProfile(input)).toEqual({ ok: false, field, error })
    expect(repo.updateMe).not.toHaveBeenCalled()
    expect(repo.updateOwnSeller).not.toHaveBeenCalled()
  })

  it('points at the field the API refused, and says when only the name and e-mail were saved', async () => {
    repo.updateMe = vi.fn(async () => {
      throw problem(409, 'account.email-taken')
    })
    expect(await saveProfile({ fullName: 'N', email: 'a@b.az', companyName: 'Yaşıl' })).toEqual({ ok: false, field: 'email', error: 'Bu e-poçt başqa hesabdadır. Başqa e-poçt yazın.' })
    // A change in the moment between the two requests: PATCH /me/seller refuses the version.
    repo.updateMe = vi.fn(async () => ({ ...user, fullName: 'Nigar R.' }))
    repo.updateOwnSeller = vi.fn(async () => {
      throw problem(409, 'concurrency-conflict')
    })
    expect(await saveProfile({ fullName: 'Nigar R.', email: 'nigar@bag.az', companyName: 'Yaşıl', sellerVersion: '812' })).toEqual({
      ok: false,
      error: 'Profil başqa cihazda dəyişdirilib. Səhifəni yeniləyin və yenidən yoxlayın.',
      saved: { fullName: 'Nigar R.', email: 'nigar@bag.az' },
    })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('says an ended session before saving anything', async () => {
    repo.getMe = vi.fn(async () => undefined)
    repo.updateMe = vi.fn()
    expect(await saveProfile({ fullName: 'Nigar', email: '' })).toEqual({ ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.' })
    expect(repo.updateMe).not.toHaveBeenCalled()
  })

  it('changes the password, and says a wrong current one under its field', async () => {
    repo.changePassword = vi.fn(async () => ({ ok: false }))
    expect(await changePassword('kohne', 'yeni2026x')).toEqual({ ok: false, field: 'current', error: 'Cari şifrə düzgün deyil.' })
    repo.changePassword = vi.fn(async () => {
      throw problem(423, 'auth.locked', undefined, 900)
    })
    expect(await changePassword('kohne', 'yeni2026x')).toEqual({ ok: false, field: 'current', error: 'Çox səhv cəhd oldu. 15 dəqiqə sonra yenidən yoxlayın.' })
    repo.changePassword = vi.fn(async () => ({ ok: true }))
    expect(await changePassword('kohne', 'yeni2026x')).toEqual({ ok: true })
    expect(await changePassword('', 'yeni2026x')).toMatchObject({ ok: false, field: 'current' })
  })

  it('checks favourite ids and tells an ended session apart', async () => {
    repo.setFavorite = vi.fn(async () => undefined)
    expect(await setFavorite('listing', '0193-l', true)).toEqual({ ok: true })
    expect(await setFavorite('listing', '../me', true)).toEqual({ ok: false })
    expect(await setFavorite('seller' as never, '0193-l', true)).toEqual({ ok: false })
    repo.setFavorite = vi.fn(async () => {
      throw new ApiError(401, 'unauthorized', 'x')
    })
    expect(await setFavorite('listing', '0193-l', false)).toEqual({ ok: false, signedOut: true })

    repo.mergeFavorites = vi.fn(async (keys: string[]) => keys)
    expect(await mergeFavorites(['listing:a', 7 as never])).toEqual({ ok: true, favorites: ['listing:a'] })
    // Nothing to merge: the account's list.
    expect(await mergeFavorites([])).toEqual({ ok: true, favorites: ['listing:0193-l'] })
  })

  it('lists «Elanlarım» without owner statistics until they come (phase 3)', async () => {
    repo.listOwnListings = vi.fn(async () => [{ id: 'l-1' } as Listing])
    repo.getListingStats = vi.fn(async () => {
      throw new NotImplementedError('getListingStats', 3)
    })
    expect(await loadOwnListings()).toEqual({ ok: true, listings: [{ id: 'l-1' }], stats: {} })
  })
})
