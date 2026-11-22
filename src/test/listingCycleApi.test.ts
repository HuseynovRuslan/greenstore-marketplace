import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminRepository, moderationParams } from '@/services/adminRepository'
import { ApiError, apiRepository, listingCacheTags } from '@/services/apiRepository'
import { readRevalidation, MAX_TAGS } from '@/services/revalidation'
import { apiPublicOrigin, contentSecurityPolicy, mediaBaseUrl, mediaRemotePatterns } from '@/seo/csp'
import { fieldMessage, stepOfField, submitFailure } from '@/features/posting/submitErrors'
import { rejectionReasonLabels, rejectionText } from '@/features/listing/rejection'
import type { ListingInput, ModerationItem, OwnListing } from '@/types'

/*
 * DATA_SOURCE=api, phase 3 (backend-contract.md 3.2–3.6): the listing cycle's repository methods against a fake API,
 * the staff repository, the revalidation notice, the CSP, and the wording of the API's refusals.
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
  init: RequestInit & { headers: Record<string, string> }
}

const calls: Call[] = []
let respond: (url: URL, init: Call['init']) => { status?: number; body?: unknown } = () => ({ body: {} })

const TOKEN = 'b'.repeat(43)
const ID = '01937a52-6c4e-7a1b-9f00-2d5c1e4b8a10'

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
const bodyOf = (call: Call) => JSON.parse(String(call.init.body))
const signedIn = () => jar.values.set('gs_session', TOKEN)
const route = (call: Call) => [call.init.method, call.url.pathname]

const input = { kind: 'product', categoryId: 'agaclar', title: 'Alma tingi — 150 sm', photoIds: [ID] } as ListingInput

describe('apiRepository: the listing cycle (backend-contract.md 3.2–3.4)', () => {
  it('asks for a photo upload address with the session', async () => {
    signedIn()
    respond = () => ({ status: 201, body: { photoId: ID, uploadUrl: 'http://api.test:5080/api/v1/photo-uploads/t', expiresAt: '2026-11-22T10:10:00Z' } })
    const upload = await apiRepository.createPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 1234 })
    expect(upload.uploadUrl).toBe('http://api.test:5080/api/v1/photo-uploads/t')
    expect(route(last())).toEqual(['POST', '/api/v1/photos'])
    expect(bodyOf(last())).toEqual({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 1234, purpose: 'listing' })
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('does not ask without a session (401, nothing sent)', async () => {
    await expect(apiRepository.createPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 1 })).rejects.toMatchObject({ status: 401 })
    await expect(apiRepository.submitListing(input)).rejects.toMatchObject({ status: 401 })
    expect(calls).toHaveLength(0)
  })

  it('sends a listing with its Idempotency-Key, and an edit with its version', async () => {
    signedIn()
    respond = () => ({ status: 201, body: { id: ID, slug: 'alma-tingi-150-sm-20324', number: 20324, status: 'pending' } })
    expect(await apiRepository.submitListing(input, 'elan-key-1')).toMatchObject({ number: 20324, status: 'pending' })
    expect(route(last())).toEqual(['POST', '/api/v1/listings'])
    expect(last().init.headers['Idempotency-Key']).toBe('elan-key-1')
    expect(bodyOf(last())).toEqual(input)

    await apiRepository.submitListing(input)
    expect(last().init.headers).not.toHaveProperty('Idempotency-Key')

    respond = () => ({ body: { id: ID, slug: 'alma-tingi-150-sm-20324', number: 20324, status: 'pending' } })
    await apiRepository.updateListing(ID, input, '812')
    expect(route(last())).toEqual(['PUT', `/api/v1/me/listings/${ID}`])
    expect(bodyOf(last())).toEqual({ ...input, version: '812' })
  })

  it('reads the owner’s listing and statistics; another account’s listing is undefined', async () => {
    signedIn()
    respond = (url) => (url.pathname.endsWith('/stats') ? { body: { views: 3, phoneReveals: 1, favourites: 0, viewsByDay: [] } } : { body: { id: ID, contactPhone: '+994505551234', version: '7', photoIds: [] } })
    expect(await apiRepository.getOwnListing(ID)).toMatchObject({ id: ID, contactPhone: '+994 50 555 12 34' })
    expect(route(last())).toEqual(['GET', `/api/v1/me/listings/${ID}`])
    expect(await apiRepository.getListingStats(ID)).toMatchObject({ views: 3, phoneReveals: 1 })
    expect(route(last())).toEqual(['GET', `/api/v1/me/listings/${ID}/stats`])

    respond = () => ({ status: 404, body: { status: 404, code: 'listing.not-found' } })
    expect(await apiRepository.getOwnListing(ID)).toBeUndefined()
    expect(await apiRepository.getListingStats(ID)).toBeUndefined()
  })

  it('renews, deactivates, activates and deletes on the owner’s routes', async () => {
    signedIn()
    respond = (url, init) => (init.method === 'DELETE' ? { status: 204 } : { body: { id: ID, status: url.pathname.endsWith('deactivate') ? 'inactive' : 'active', version: '9', photoIds: [] } })
    expect((await apiRepository.renewListing(ID)).status).toBe('active')
    expect(route(last())).toEqual(['POST', `/api/v1/me/listings/${ID}/renew`])
    expect((await apiRepository.deactivateListing(ID)).status).toBe('inactive')
    expect(route(last())).toEqual(['POST', `/api/v1/me/listings/${ID}/deactivate`])
    await apiRepository.activateListing(ID)
    expect(route(last())).toEqual(['POST', `/api/v1/me/listings/${ID}/activate`])
    await apiRepository.deleteListing(ID)
    expect(route(last())).toEqual(['DELETE', `/api/v1/me/listings/${ID}`])

    respond = () => ({ status: 409, body: { status: 409, code: 'listing.wrong-status', listingStatus: 'pending' } })
    await expect(apiRepository.renewListing(ID)).rejects.toMatchObject({ status: 409, code: 'listing.wrong-status' })
  })

  it('counts a view and reveals numbers per visitor, signed in or not, in the site’s spacing', async () => {
    respond = (url) => (url.pathname.endsWith('/views') ? { status: 204 } : { body: { phone: '+994505551234', whatsappUrl: 'https://wa.me/994505551234' } })
    await apiRepository.recordListingView(ID)
    expect(route(last())).toEqual(['POST', `/api/v1/listings/${ID}/views`])
    expect(last().init.headers['X-Client-IP']).toBe('203.0.113.9')
    expect(last().init.headers['User-Agent']).toBe('Mozilla/5.0 Test')
    expect(last().init.headers).not.toHaveProperty('Authorization')
    expect(last().init.cache).toBe('no-store')

    expect(await apiRepository.revealPhone(ID)).toEqual({ phone: '+994 50 555 12 34', whatsappUrl: 'https://wa.me/994505551234' })
    expect(route(last())).toEqual(['POST', `/api/v1/listings/${ID}/phone-reveals`])
    respond = () => ({ body: { whatsappUrl: 'https://wa.me/994505551234' } })
    expect(await apiRepository.revealSellerPhone('0193-s')).toEqual({ whatsappUrl: 'https://wa.me/994505551234' })
    expect(route(last())).toEqual(['POST', '/api/v1/sellers/0193-s/phone-reveals'])

    // The owner's own views are not counted: the session goes along.
    signedIn()
    respond = () => ({ status: 204 })
    await apiRepository.recordListingView(ID)
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('lists «Elanlarım» with the owner’s number in the site’s spacing', async () => {
    signedIn()
    respond = () => ({ body: [{ id: ID, contactPhone: '+994505551234', version: '1', photoIds: [] }] })
    expect((await apiRepository.listOwnListings())[0].contactPhone).toBe('+994 50 555 12 34')
  })
})

describe('listingCacheTags: the tags of the API’s change notices (backend-contract.md 3.6)', () => {
  it('names a product, its seller and the home page', () => {
    expect(listingCacheTags({ id: 'l1', slug: 'alma-1', sellerId: 's1' })).toEqual(['listing:l1', 'listing:alma-1', 'listings', 'sitemap:listing', 'home', 'seller:s1', 'sellers'])
    expect(listingCacheTags({ id: 'l1', slug: 'alma-1' })).toEqual(['listing:l1', 'listing:alma-1', 'listings', 'sitemap:listing', 'home'])
  })

  it('names a service as a service', () => {
    expect(listingCacheTags({ id: 'v1', slug: 'qazon-1', kind: 'service' })).toEqual(['service:v1', 'service:qazon-1', 'services', 'sitemap:service', 'home'])
  })
})

const item = (patch: Partial<ModerationItem> = {}): ModerationItem => ({
  id: ID,
  listingId: ID,
  number: 20324,
  title: 'Alma tingi — 150 sm',
  sellerName: 'Test Bağ',
  submittedAt: '2026-11-22T09:00:00Z',
  categoryId: 'agaclar',
  kind: 'new',
  status: 'pending',
  revision: 1,
  version: '812',
  contactPhoneVerified: true,
  photoCount: 1,
  seller: { userId: 'u1', name: 'Test Bağ', accountType: 'business', verified: false, activeListings: 0 },
  listing: { id: ID, slug: 'alma-20324', contactPhone: '+994505551234' } as OwnListing,
  changes: [],
  ...patch,
})

describe('adminRepository (backend-contract.md 3.5)', () => {
  it('reads the queue with its filters, the staff’s numbers in the site’s spacing', async () => {
    signedIn()
    respond = () => ({ body: { items: [item()], total: 1, page: 1, pageCount: 1, totals: { pending: 1, recheck: 0, approved: 5, rejected: 0 } } })
    const queue = await adminRepository.moderationQueue({ status: 'pending', kind: 'recheck', sort: 'oldest', q: ' 20324 ', page: 2 })
    expect(route(last())).toEqual(['GET', '/api/v1/admin/moderation'])
    expect(Object.fromEntries(last().url.searchParams)).toEqual({ status: 'pending', kind: 'recheck', sort: 'oldest', q: '20324', page: '2' })
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(queue.items[0].listing.contactPhone).toBe('+994 50 555 12 34')
    expect(queue.totals.approved).toBe(5)
  })

  it('builds the defaults’ query string and keeps pages in range', () => {
    expect(moderationParams({ page: 1 }).toString()).toBe('page=1')
    expect(moderationParams({ page: 0, q: '  ' }).toString()).toBe('page=1')
  })

  it('reads one item (404 is undefined) and sends a decision with the version', async () => {
    signedIn()
    respond = () => ({ status: 404, body: { status: 404, code: 'listing.not-found' } })
    expect(await adminRepository.moderationItem(ID)).toBeUndefined()
    respond = () => ({ body: { listingId: ID, decision: 'reject', status: 'rejected', version: '813' } })
    await adminRepository.decide(ID, { decision: 'reject', reasonCode: 'bad-photos', note: 'Başqa bitki', version: '812' })
    expect(route(last())).toEqual(['POST', `/api/v1/admin/moderation/${ID}/decision`])
    expect(bodyOf(last())).toEqual({ decision: 'reject', reasonCode: 'bad-photos', note: 'Başqa bitki', version: '812' })
    respond = () => ({ status: 403, body: { status: 403, code: 'forbidden' } })
    await expect(adminRepository.moderationQueue({ page: 1 })).rejects.toMatchObject({ status: 403 })
  })
})

describe('the revalidation notice (src/app/api/revalidate)', () => {
  it('needs the shared secret; without one configured every notice is refused', () => {
    expect(readRevalidation('Bearer s3cret', { tags: ['listings'] }, 's3cret')).toEqual({ ok: true, tags: ['listings'] })
    expect(readRevalidation('Bearer wrong', { tags: ['listings'] }, 's3cret')).toMatchObject({ ok: false, status: 401 })
    expect(readRevalidation(null, { tags: ['listings'] }, 's3cret')).toMatchObject({ ok: false, status: 401 })
    expect(readRevalidation('Bearer s3cret', { tags: ['listings'] }, undefined)).toMatchObject({ ok: false, status: 401 })
    expect(readRevalidation('Bearer ', { tags: ['listings'] }, '')).toMatchObject({ ok: false, status: 401 })
  })

  it('takes as many tags per notice as the API sends at most (Revalidation.MaxTagsPerNotice)', () => {
    const outbox = readFileSync(join(__dirname, '..', '..', 'backend', 'src', 'GreenStore.Api', 'Modules', 'Platform', 'Outbox.cs'), 'utf8')
    expect(Number(/const int MaxTagsPerNotice = (\d+);/.exec(outbox)?.[1])).toBe(MAX_TAGS)
  })

  it('takes printable tags of up to 256 characters, each once', () => {
    expect(readRevalidation('Bearer k', { tags: ['listing:1', 'listings', 'listing:1'] }, 'k')).toEqual({ ok: true, tags: ['listing:1', 'listings'] })
    for (const body of [undefined, {}, { tags: [] }, { tags: 'listings' }, { tags: [1] }, { tags: ['a b'] }, { tags: ['x'.repeat(257)] }, { tags: Array.from({ length: MAX_TAGS + 1 }, (_, i) => `t${i}`) }]) {
      expect(readRevalidation('Bearer k', body, 'k')).toMatchObject({ ok: false, status: 400 })
    }
  })
})

describe('the CSP and next/image with DATA_SOURCE=api (src/seo/csp.ts)', () => {
  it('stays the site’s own with the mock', () => {
    const env = { DATA_SOURCE: 'mock', API_BASE_URL: 'http://localhost:5080' }
    expect(contentSecurityPolicy(env)).toContain("img-src 'self' data: blob:;")
    expect(contentSecurityPolicy(env)).toContain("connect-src 'self';")
    expect(mediaRemotePatterns(env)).toEqual([])
  })

  it('lets the browser upload to the API and show its photos', () => {
    const env = { DATA_SOURCE: 'api', API_BASE_URL: 'http://localhost:5080' }
    expect(apiPublicOrigin(env)).toBe('http://localhost:5080')
    expect(mediaBaseUrl(env)?.href).toBe('http://localhost:5080/media')
    expect(contentSecurityPolicy(env)).toContain("connect-src 'self' http://localhost:5080;")
    expect(contentSecurityPolicy(env)).toContain("img-src 'self' data: blob: http://localhost:5080;")
    expect(mediaRemotePatterns(env)).toEqual([{ protocol: 'http', hostname: 'localhost', port: '5080', pathname: '/media/**' }])
  })

  it('takes the public API address and a CDN when they are set', () => {
    const env = { DATA_SOURCE: 'api', API_BASE_URL: 'http://api.internal:8080', API_PUBLIC_URL: 'https://api.greenstore.az/', MEDIA_BASE_URL: 'https://cdn.greenstore.az/media/' }
    expect(contentSecurityPolicy(env)).toContain("connect-src 'self' https://api.greenstore.az;")
    expect(contentSecurityPolicy(env)).toContain("img-src 'self' data: blob: https://cdn.greenstore.az;")
    expect(mediaRemotePatterns(env)).toEqual([{ protocol: 'https', hostname: 'cdn.greenstore.az', port: '', pathname: '/media/**' }])
    // Not a URL: ignored.
    expect(apiPublicOrigin({ DATA_SOURCE: 'api', API_PUBLIC_URL: 'javascript:alert(1)' })).toBeUndefined()
  })
})

describe('what a refused «Elanı göndər» says', () => {
  const problem = (status: number, code: string, errors?: Record<string, string[]>) => new ApiError(status, code, 'listings', { code, ...(errors ? { errors } : {}) })

  it('names the field’s step', () => {
    expect(['kind', 'categoryId', 'subcategory'].map(stepOfField)).toEqual([1, 1, 1])
    expect(['title', 'description', 'attributes.availability', 'plant.heightCm.min'].map(stepOfField)).toEqual([2, 2, 2, 2])
    expect(stepOfField('photoIds')).toBe(3)
    expect(['price', 'wholesale.price', 'cityId', 'deliveryAreas'].map(stepOfField)).toEqual([4, 4, 4, 4])
    expect(['contactName', 'contactPhone', 'whatsapp'].map(stepOfField)).toEqual([5, 5, 5])
    expect(stepOfField('promotion')).toBe(6)
  })

  it('words the API’s codes', () => {
    expect(submitFailure(problem(400, 'validation', { description: ['contains-phone'] }))).toEqual({ ok: false, step: 2, error: fieldMessage('description', 'contains-phone') })
    expect(fieldMessage('description', 'contains-phone')).toMatch(/telefon nömrəsi olmasın/)
    expect(fieldMessage('title', 'too-short')).toBe('«Başlıq» xanasını yoxlayın və yenidən göndərin.')
    expect(submitFailure(problem(400, 'validation', { photoIds: ['not-found'] }))).toMatchObject({ step: 3, uploadAgain: true })
    expect(submitFailure(problem(400, 'validation', { photoIds: ['too-many'] }))).not.toHaveProperty('uploadAgain')
    expect(submitFailure(problem(429, 'listing.daily-limit')).error).toMatch(/24 saatda 30/)
    expect(submitFailure(problem(401, 'unauthorized'))).toMatchObject({ signedOut: true })
    expect(submitFailure(problem(422, 'idempotency.key-reused')).error).toMatch(/artıq göndərilib/)
    expect(submitFailure(problem(409, 'concurrency-conflict')).error).toMatch(/dəyişdirilib/)
    expect(submitFailure(new Error('network')).error).toMatch(/qaralama saxlanılıb/)
  })
})

describe('the moderator’s reason for its owner', () => {
  it('words the code, with the note; «Digər» shows the note alone; the demo keeps its text', () => {
    expect(rejectionText({ rejectionReasonCode: 'bad-photos', rejectionNote: 'Şəkillərdə başqa bitki görünür' })).toBe('Şəkillər tələblərə uyğun deyil. Şəkillərdə başqa bitki görünür.')
    expect(rejectionText({ rejectionReasonCode: 'duplicate' })).toBe('Təkrar elan.')
    expect(rejectionText({ rejectionReasonCode: 'other', rejectionNote: 'Qiymət bir ağac üçün deyil?' })).toBe('Qiymət bir ağac üçün deyil?')
    expect(rejectionText({ rejectionReasonCode: 'other' })).toBeUndefined()
    expect(rejectionText({ rejectionReason: 'Demo səbəbi.' })).toBe('Demo səbəbi.')
    expect(Object.keys(rejectionReasonLabels)).toEqual(['wrong-category', 'wrong-price', 'unverified-contact', 'bad-photos', 'duplicate', 'other'])
  })
})
