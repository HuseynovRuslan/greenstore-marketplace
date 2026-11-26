import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRepository, ApiError } from '@/services/apiRepository'
import { refreshSession, SESSION_MAX_AGE_SEC, sessionCookieOptions, untilBrowserCloses } from '@/services/session'
import { decodeSessionHint, encodeSessionHint } from '@/state/bootstrap'
import type { UserProfile } from '@/types'

/*
 * DATA_SOURCE=api, phase 2 (backend-contract.md 2.1–2.3): the account methods of apiRepository against a fake API,
 * with the request's cookies in a fake jar (the session cookie the sign-ins write and every account call sends).
 */

const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  sets: [] as Array<{ name: string; value: string; options: Record<string, unknown> }>,
  deletes: [] as string[],
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36' }),
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    has: (name: string) => jar.values.has(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      jar.values.set(name, value)
      jar.sets.push({ name, value, options })
    },
    delete: (name: string) => {
      jar.values.delete(name)
      jar.deletes.push(name)
    },
  }),
}))

interface Call {
  url: URL
  init: RequestInit & { headers: Record<string, string> }
}

const calls: Call[] = []
let respond: (url: URL, init: Call['init']) => { status?: number; body?: unknown; headers?: Record<string, string> } = () => ({ body: {} })

const TOKEN = 'a'.repeat(43)
const user: UserProfile = { id: '0193-u', fullName: 'Nigar Rzayeva', email: 'nigar@bag.az', phone: '+994555123456', accountType: 'business', sellerId: '0193-s', role: 'user', locale: 'az' }
const session = { id: '0193-x', token: TOKEN, expiresAt: '2026-12-22T10:00:00Z' }

beforeEach(() => {
  calls.length = 0
  jar.values.clear()
  jar.sets.length = 0
  jar.deletes.length = 0
  respond = () => ({ body: {} })
  vi.stubEnv('API_BASE_URL', 'http://api.test:5080')
  vi.stubEnv('API_INTERNAL_KEY', 'test-key')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: Call['init']) => {
      const url = new URL(input)
      calls.push({ url, init })
      const { status = 200, body, headers = {} } = respond(url, init)
      return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const last = () => calls[calls.length - 1]
const bodyOf = (call: Call) => JSON.parse(String(call.init.body))
const signedIn = () => jar.values.set('gs_session', TOKEN)
const problem = (status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) => ({ status, body: { status, code, ...extra }, headers })

describe('apiRepository: signing in (backend-contract.md 2.1)', () => {
  it('signs in with a password, keeps the token in an httpOnly cookie and the initials in the hint', async () => {
    respond = () => ({ body: { ok: true, user, session } })
    const result = await apiRepository.login({ login: '050 555 12 34', password: 'bag2026xx' })

    expect(result).toEqual({ ok: true, user: { ...user, phone: '+994 55 512 34 56' } })
    expect(last().url.pathname).toBe('/api/v1/auth/login')
    expect(bodyOf(last())).toEqual({ login: '050 555 12 34', password: 'bag2026xx', client: 'web' })
    expect(last().init).toMatchObject({ method: 'POST', cache: 'no-store' })
    // The visitor's IP and browser go along: the API's limits and «Aktiv cihazlar» count the visitor, not Next.js.
    expect(last().init.headers).toMatchObject({ 'X-Internal-Key': 'test-key', 'X-Client-IP': '203.0.113.9', 'User-Agent': expect.stringContaining('Chrome/130') })

    const cookie = jar.sets.find((c) => c.name === 'gs_session')!
    expect(cookie.value).toBe(TOKEN)
    expect(cookie.options).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 })
    const hint = jar.sets.find((c) => c.name === 'gs_hint')!
    expect(hint.options).toMatchObject({ httpOnly: false, sameSite: 'lax', maxAge: SESSION_MAX_AGE_SEC })
    expect(decodeSessionHint(hint.value)).toMatchObject({ initials: 'NR' })
    // Neither the token nor the name is in the hint.
    expect(hint.value).not.toContain(TOKEN)
    expect(hint.value).not.toContain('Nigar')
  })

  it('«Məni xatırla» unticked: both cookies end with the browser, and a refresh keeps them that way', async () => {
    respond = () => ({ body: { ok: true, user, session } })
    await untilBrowserCloses(() => apiRepository.login({ login: '050 555 12 34', password: 'bag2026xx' }))
    const cookie = jar.sets.find((c) => c.name === 'gs_session')!
    const hint = jar.sets.find((c) => c.name === 'gs_hint')!
    expect(cookie.value).toBe(TOKEN)
    // No Max-Age: a browser-session cookie, still httpOnly.
    expect(cookie.options).toEqual({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' })
    expect(hint.options).not.toHaveProperty('maxAge')
    expect(decodeSessionHint(hint.value)).toMatchObject({ initials: 'NR', browserOnly: true })

    // A day later the visit writes the cookies again: still without Max-Age.
    jar.sets.length = 0
    jar.values.set('gs_hint', encodeSessionHint({ initials: 'NR', issuedAt: 1, browserOnly: true }))
    await refreshSession('Nigar Rzayeva')
    expect(jar.sets.map((c) => [c.name, 'maxAge' in c.options])).toEqual([
      ['gs_session', false],
      ['gs_hint', false],
    ])
  })

  it('reads the hints written before «Məni xatırla» as the 30-day kind', () => {
    expect(decodeSessionHint(JSON.stringify({ i: 'NR', t: 5 }))).toEqual({ initials: 'NR', issuedAt: 5 })
    expect(decodeSessionHint(encodeSessionHint({ initials: 'NR', issuedAt: 5, browserOnly: true }))).toEqual({ initials: 'NR', issuedAt: 5, browserOnly: true })
  })

  it('marks the cookies Secure in production', () => {
    expect(sessionCookieOptions(true, { NODE_ENV: 'production' })).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' })
    expect(sessionCookieOptions(false, { NODE_ENV: 'development' })).toMatchObject({ httpOnly: false, secure: false })
  })

  it('answers the refusals of the contract and throws the rest', async () => {
    respond = () => problem(401, 'auth.wrong-credentials')
    expect(await apiRepository.login({ login: 'x@y.az', password: 'p' })).toEqual({ ok: false, error: 'wrong-credentials' })
    respond = () => problem(423, 'auth.locked', {}, { 'Retry-After': '900' })
    expect(await apiRepository.login({ login: 'x@y.az', password: 'p' })).toEqual({ ok: false, error: 'locked', retryAfterSec: 900 })
    respond = () => problem(429, 'auth.too-many-attempts', {}, { 'Retry-After': '60' })
    expect(await apiRepository.login({ login: 'x@y.az', password: 'p' })).toEqual({ ok: false, error: 'locked', retryAfterSec: 60 })
    respond = () => problem(403, 'auth.blocked')
    expect(await apiRepository.loginWithOtp({ otpChallengeId: 'c' })).toEqual({ ok: false, error: 'blocked' })
    respond = () => problem(400, 'validation', { errors: { login: ['required'] } })
    const error = await apiRepository.login({ login: '', password: 'p' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).fieldError('login')).toBe('required')
    expect(jar.sets).toHaveLength(0)
  })

  it('signs in with a verified SMS code and registers with the session at once', async () => {
    respond = () => ({ status: 201, body: { ok: true, user, session } })
    const result = await apiRepository.register({ accountType: 'business', businessKinds: ['nursery', 'garden-centre'], companyName: 'Yaşıl Həyət', fullName: 'Nigar Rzayeva', phone: '+994555123456', password: 'bag2026xx', otpChallengeId: 'c-1' })
    expect(result.ok).toBe(true)
    expect(last().url.pathname).toBe('/api/v1/accounts')
    expect(bodyOf(last())).toMatchObject({ accountType: 'business', businessKinds: ['nursery', 'garden-centre'], companyName: 'Yaşıl Həyət', otpChallengeId: 'c-1', client: 'web' })
    expect(jar.values.get('gs_session')).toBe(TOKEN)

    respond = () => ({ body: { ok: true, user, session } })
    expect(await apiRepository.loginWithOtp({ otpChallengeId: 'c-2' })).toMatchObject({ ok: true })
    expect(last().url.pathname).toBe('/api/v1/auth/login/otp')
    expect(bodyOf(last())).toEqual({ otpChallengeId: 'c-2', client: 'web' })
  })

  it('words a wrong SMS code like the mock: attempts left, too many, expired', async () => {
    respond = () => problem(400, 'otp.wrong-code', { attemptsLeft: 3 })
    expect(await apiRepository.verifyOtp({ challengeId: 'c', code: '0000' })).toEqual({ ok: false, error: 'wrong-code', attemptsLeft: 3 })
    respond = () => problem(400, 'otp.too-many-attempts', { attemptsLeft: 0 })
    expect(await apiRepository.verifyOtp({ challengeId: 'c', code: '0000' })).toEqual({ ok: false, error: 'too-many-attempts', attemptsLeft: 0 })
    respond = () => problem(400, 'otp.expired')
    expect(await apiRepository.verifyOtp({ challengeId: 'c', code: '0000' })).toEqual({ ok: false, error: 'expired' })
    respond = () => ({ body: { ok: true } })
    expect(await apiRepository.verifyOtp({ challengeId: 'c', code: '1234' })).toEqual({ ok: true })
    respond = () => ({ body: { challengeId: 'c', phoneMasked: '+994 55 *** ** 56', expiresInSec: 300, resendInSec: 60, demoCode: '4821' } })
    expect(await apiRepository.requestOtp({ phone: '+994555123456', purpose: 'login' })).toMatchObject({ challengeId: 'c', demoCode: '4821' })
    expect(bodyOf(last())).toEqual({ phone: '+994555123456', purpose: 'login' })
  })

  it('resets the password and says when the code was not verified', async () => {
    respond = () => ({ body: { ok: true } })
    expect(await apiRepository.resetPassword({ otpChallengeId: 'c', password: 'yeni2026x' })).toEqual({ ok: true })
    expect(last().url.pathname).toBe('/api/v1/accounts/password-reset')
    respond = () => problem(400, 'otp.not-verified')
    expect(await apiRepository.resetPassword({ otpChallengeId: 'c', password: 'yeni2026x' })).toEqual({ ok: false })
  })
})

describe('apiRepository: the signed-in account', () => {
  it('asks nothing without a session', async () => {
    expect(await apiRepository.getMe()).toBeUndefined()
    expect(await apiRepository.listFavorites()).toEqual([])
    expect(await apiRepository.listSavedSearches()).toEqual([])
    await expect(apiRepository.updateMe({ fullName: 'X' })).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(calls).toHaveLength(0)
  })

  it('sends the token as a bearer and shows the phone in the site’s spacing', async () => {
    signedIn()
    respond = () => ({ body: user })
    expect(await apiRepository.getMe()).toEqual({ ...user, phone: '+994 55 512 34 56' })
    expect(last().url.pathname).toBe('/api/v1/me')
    expect(last().init).toMatchObject({ method: 'GET', cache: 'no-store' })
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(last().init.body).toBeUndefined()
  })

  it('forgets an ended session: a 401 removes both cookies', async () => {
    signedIn()
    jar.values.set('gs_hint', '{"i":"NR","t":1}')
    respond = () => problem(401, 'unauthorized')
    expect(await apiRepository.getMe()).toBeUndefined()
    expect(jar.deletes.sort()).toEqual(['gs_hint', 'gs_session'])
  })

  it('signs out on the API and removes the cookies even when the API cannot be reached', async () => {
    signedIn()
    respond = () => ({ status: 204 })
    await apiRepository.logout()
    expect(last().url.pathname).toBe('/api/v1/auth/logout')
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(jar.values.has('gs_session')).toBe(false)

    signedIn()
    respond = () => ({ status: 503 })
    await expect(apiRepository.logout()).resolves.toBeUndefined()
    expect(jar.values.has('gs_session')).toBe(false)
  })

  it('changes the profile, the password and the phone', async () => {
    signedIn()
    respond = () => ({ body: { ...user, fullName: 'Nigar R.' } })
    expect((await apiRepository.updateMe({ fullName: 'Nigar R.', email: '' })).fullName).toBe('Nigar R.')
    expect(last().init.method).toBe('PATCH')
    expect(bodyOf(last())).toEqual({ fullName: 'Nigar R.', email: '' })

    respond = () => problem(400, 'auth.wrong-password')
    expect(await apiRepository.changePassword({ current: 'kohne', next: 'yeni2026x' })).toEqual({ ok: false })
    respond = () => ({ body: { ok: true } })
    expect(await apiRepository.changePassword({ current: 'kohne', next: 'yeni2026x' })).toEqual({ ok: true })
    expect(last().url.pathname).toBe('/api/v1/me/password')

    respond = () => ({ body: { ...user, phone: '+994707654321' } })
    expect((await apiRepository.changePhone({ otpChallengeId: 'c' })).phone).toBe('+994 70 765 43 21')
    expect(last().url.pathname).toBe('/api/v1/me/phone')
  })

  it('reads and edits the business profile («mağaza»); an individual account has none', async () => {
    signedIn()
    const own = { id: '0193-s', slug: 'yasil-heyet', name: 'Yaşıl Həyət', type: 'business', cityId: 'baki', activeListings: 0, verified: false, image: '', phone: '+994555123456', version: '812' }
    respond = () => ({ body: own })
    expect(await apiRepository.getOwnSeller()).toMatchObject({ slug: 'yasil-heyet', phone: '+994 55 512 34 56', version: '812' })
    expect(last().url.pathname).toBe('/api/v1/me/seller')

    await apiRepository.updateOwnSeller({ name: 'Yaşıl Həyət Bağ', about: '', version: '812' })
    expect(last().init.method).toBe('PATCH')
    expect(bodyOf(last())).toEqual({ name: 'Yaşıl Həyət Bağ', about: '', version: '812' })

    respond = () => problem(404, 'seller.not-found')
    expect(await apiRepository.getOwnSeller()).toBeUndefined()
    respond = () => problem(409, 'concurrency-conflict')
    await expect(apiRepository.updateOwnSeller({ name: 'X', version: '1' })).rejects.toMatchObject({ status: 409, code: 'concurrency-conflict' })
  })

  it('keeps «Seçilmişlər» on the account (backend-contract.md 2.3)', async () => {
    signedIn()
    respond = () => ({ status: 204 })
    await apiRepository.setFavorite('listing', '0193-l', true)
    expect([last().init.method, last().url.pathname]).toEqual(['PUT', '/api/v1/me/favorites/listing/0193-l'])
    await apiRepository.setFavorite('service', '0193-v', false)
    expect([last().init.method, last().url.pathname]).toEqual(['DELETE', '/api/v1/me/favorites/service/0193-v'])

    respond = () => ({ body: ['listing:a', 'service:b'] })
    const keys = Array.from({ length: 600 }, (_, i) => `listing:${i}`)
    expect(await apiRepository.mergeFavorites(keys)).toEqual(['listing:a', 'service:b'])
    expect(bodyOf(last()).keys).toHaveLength(500)
    expect(await apiRepository.listFavorites()).toEqual(['listing:a', 'service:b'])

    respond = () => ({ body: { listings: [], services: [] } })
    expect(await apiRepository.listFavoriteItems()).toEqual({ listings: [], services: [] })
    expect(last().url.pathname).toBe('/api/v1/me/favorites/items')
  })

  it('keeps the saved searches on the account', async () => {
    signedIn()
    const search = { id: '0193-q', name: 'Bakıda ağaclar', query: 'kateqoriya=agaclar&seher=baki', alerts: true, createdAt: '2026-11-22T10:00:00Z', newCount: 2 }
    respond = () => ({ status: 201, body: search })
    expect(await apiRepository.saveSearch({ name: 'Bakıda ağaclar', query: 'seher=baki&kateqoriya=agaclar', alerts: true })).toEqual(search)
    expect([last().init.method, last().url.pathname]).toEqual(['POST', '/api/v1/me/saved-searches'])
    respond = () => ({ body: { ...search, alerts: false } })
    await apiRepository.updateSavedSearch('0193-q', { alerts: false })
    expect([last().init.method, last().url.pathname]).toEqual(['PATCH', '/api/v1/me/saved-searches/0193-q'])
    respond = () => ({ body: { ...search, newCount: 0 } })
    expect((await apiRepository.markSavedSearchOpened('0193-q')).newCount).toBe(0)
    expect(last().url.pathname).toBe('/api/v1/me/saved-searches/0193-q/opened')
    respond = () => ({ status: 204 })
    await apiRepository.deleteSavedSearch('0193-q')
    expect([last().init.method, last().url.pathname]).toEqual(['DELETE', '/api/v1/me/saved-searches/0193-q'])
  })

  it('lists «Elanlarım» from GET /me/listings (phase 3), the owner’s number in the site’s spacing; nobody signed in has none', async () => {
    signedIn()
    respond = () => ({ body: [{ id: 'l-1', contactPhone: '+994505551234' }, { id: 'l-2' }] })
    expect(await apiRepository.listOwnListings()).toEqual([{ id: 'l-1', contactPhone: '+994 50 555 12 34' }, { id: 'l-2' }])
    expect([last().init.method, last().url.pathname, last().init.headers.Authorization]).toEqual(['GET', '/api/v1/me/listings', `Bearer ${TOKEN}`])

    jar.values.clear()
    calls.length = 0
    expect(await apiRepository.listOwnListings()).toEqual([])
    expect(calls).toHaveLength(0)
  })
})
