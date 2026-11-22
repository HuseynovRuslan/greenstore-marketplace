import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiRepository'
import { createDraft, withCategory, type PostingDraft } from '@/features/posting/draft'
import type { ModerationItem, OwnListing } from '@/types'

/*
 * The listing cycle's Server Actions with DATA_SOURCE=api (backend-contract.md 3.2–3.6): «Elanı göndər» and the photo
 * upload address, «Elanlarım»'s actions, the view beacon, the moderator's decision, and the revalidation route. The
 * repositories are fakes; `updateTag` / `revalidateTag` are spies.
 */

const { repo, admin, updateTag, revalidateTag } = vi.hoisted(() => ({
  repo: {} as Record<string, ReturnType<typeof vi.fn>>,
  admin: {} as Record<string, ReturnType<typeof vi.fn>>,
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag, revalidateTag }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, has: () => false, set: () => {}, delete: () => {} }) }))
vi.mock('@/services/repository', async (original) => ({ ...(await original<typeof import('@/services/repository')>()), getRepository: () => repo }))
vi.mock('@/services/adminRepository', () => ({ adminRepository: admin }))

const { submitPosting, startPhotoUpload, previewSeller } = await import('@/features/posting/actions')
const { changeOwnListing, loadOwnListings } = await import('@/features/cabinet/actions')
const { recordView } = await import('@/features/listing/actions')
const { decideModeration } = await import('@/features/admin/actions')
const { POST: revalidate } = await import('@/app/api/revalidate/route')

const PHOTO = '01937a52-6c4e-7a1b-9f00-2d5c1e4b8a10'
const ID = '01937a52-0000-7a1b-9f00-2d5c1e4b8a10'
const problem = (status: number, code: string, errors?: Record<string, string[]>) => new ApiError(status, code, 'x', { code, ...(errors ? { errors } : {}) })

/** A draft that passes every step, its photo uploaded. */
function completeDraft(patch: Partial<PostingDraft> = {}): PostingDraft {
  const d = withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'product', 'agaclar')
  return {
    ...d,
    subcategory: 'İynəyarpaqlı ağaclar',
    title: 'Tuya Smaragd — 140 sm',
    description: 'Sağlam, sıx formalı tinglər, dibçəkdə yetişdirilib.',
    attrs: { heightMin: '140', rootSystem: 'container', availability: 'satisda' },
    photos: [{ id: 'ph_1', name: 'a.jpg', width: 1200, height: 900, remoteId: PHOTO, url: 'http://localhost:5080/media/p/1280.webp' }],
    price: '55',
    cityId: 'abseron',
    rulesAccepted: true,
    ...patch,
  }
}

const own = (patch: Partial<OwnListing> = {}) => ({ id: ID, slug: 'tuya-20324', sellerId: 's1', kind: 'product', status: 'active', version: '9', photoIds: [PHOTO], ...patch }) as OwnListing

beforeEach(() => {
  for (const key of Object.keys(repo)) delete repo[key]
  for (const key of Object.keys(admin)) delete admin[key]
  updateTag.mockClear()
  revalidateTag.mockClear()
  vi.stubEnv('DATA_SOURCE', 'api')
})

describe('«Elanı göndər» (submitPosting)', () => {
  it('sends the uploaded photos’ ids with the draft’s Idempotency-Key', async () => {
    repo.submitListing = vi.fn(async () => ({ id: ID, slug: 'tuya-20324', number: 20324, status: 'pending' }))
    const result = await submitPosting(completeDraft(), 'elan-key-1')
    expect(result).toEqual({ ok: true, result: { id: ID, slug: 'tuya-20324', number: 20324, status: 'pending' } })
    expect(repo.submitListing).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tuya Smaragd — 140 sm', photoIds: [PHOTO], contactPhone: '+994505551234' }), 'elan-key-1')
    // Nothing public changed yet (the listing waits for the moderator).
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('drops a key that is not one', async () => {
    repo.submitListing = vi.fn(async () => ({ id: ID, slug: 's', number: 1, status: 'pending' }))
    await submitPosting(completeDraft(), 'with space')
    expect(repo.submitListing).toHaveBeenCalledWith(expect.anything(), undefined)
  })

  it('refuses photos that are not uploaded yet, without asking the API', async () => {
    repo.submitListing = vi.fn()
    const result = await submitPosting(completeDraft({ photos: [{ id: 'ph_1', name: 'a.jpg', width: 1200, height: 900 }] }), 'k')
    expect(result).toMatchObject({ ok: false, step: 3, uploadAgain: true })
    expect(repo.submitListing).not.toHaveBeenCalled()
  })

  it('sends an edit with the version it opened, and refreshes the listing’s pages', async () => {
    repo.updateListing = vi.fn(async () => ({ id: ID, slug: 'tuya-20324', number: 20324, status: 'pending' }))
    await submitPosting(completeDraft({ editing: { id: ID, number: 20324, slug: 'tuya-20324', version: '9' } }), 'k')
    expect(repo.updateListing).toHaveBeenCalledWith(ID, expect.objectContaining({ photoIds: [PHOTO] }), '9')
    expect(updateTag).toHaveBeenCalledWith(`listing:${ID}`)
    expect(updateTag).toHaveBeenCalledWith('listings')
  })

  it('words the API’s refusal and names the step', async () => {
    repo.submitListing = vi.fn(async () => {
      throw problem(400, 'validation', { description: ['contains-phone'] })
    })
    expect(await submitPosting(completeDraft(), 'k')).toMatchObject({ ok: false, step: 2, error: expect.stringMatching(/telefon nömrəsi/) })
  })

  it('checks the draft with the wizard’s rules first', async () => {
    repo.submitListing = vi.fn()
    expect(await submitPosting(completeDraft({ title: 'abc' }), 'k')).toMatchObject({ ok: false, step: 2 })
    expect(repo.submitListing).not.toHaveBeenCalled()
  })
})

describe('the photo upload address (startPhotoUpload)', () => {
  it('asks the API for an address for a photo it would take', async () => {
    repo.createPhotoUpload = vi.fn(async () => ({ photoId: PHOTO, uploadUrl: 'http://localhost:5080/api/v1/photo-uploads/t', expiresAt: '2026-11-22T10:10:00Z' }))
    expect(await startPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 2048 })).toMatchObject({ ok: true, upload: { photoId: PHOTO } })
    expect(repo.createPhotoUpload).toHaveBeenCalledWith({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 2048 })
  })

  it('refuses what the API would refuse, and words its answers', async () => {
    repo.createPhotoUpload = vi.fn()
    expect(await startPhotoUpload({ fileName: 'a.gif', contentType: 'image/gif', bytes: 10 })).toMatchObject({ ok: false, error: expect.stringMatching(/JPG, PNG/) })
    expect(await startPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 11 * 1024 * 1024 })).toMatchObject({ ok: false, error: expect.stringMatching(/10 MB/) })
    expect(repo.createPhotoUpload).not.toHaveBeenCalled()

    repo.createPhotoUpload = vi.fn(async () => {
      throw problem(401, 'unauthorized')
    })
    expect(await startPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 10 })).toMatchObject({ ok: false, signedOut: true })
    repo.createPhotoUpload = vi.fn(async () => {
      throw problem(429, 'photo.too-many')
    })
    expect(await startPhotoUpload({ fileName: 'a.jpg', contentType: 'image/jpeg', bytes: 10 })).toMatchObject({ ok: false, error: expect.stringMatching(/çox şəkil/) })
  })
})

describe('the seller of the posting preview (previewSeller)', () => {
  it('is the business’s «mağaza» as the API has it; none when it cannot say, or with the mock', async () => {
    const seller = { id: 's1', slug: 'yasil-heyet', name: 'Yaşıl Həyət', type: 'business', cityId: 'baki', activeListings: 3, verified: false, image: '', version: '4' }
    repo.getOwnSeller = vi.fn(async () => seller)
    expect(await previewSeller()).toEqual(seller)

    repo.getOwnSeller = vi.fn(async () => {
      throw problem(401, 'unauthenticated')
    })
    expect(await previewSeller()).toBeUndefined()

    vi.stubEnv('DATA_SOURCE', 'mock')
    repo.getOwnSeller = vi.fn()
    expect(await previewSeller()).toBeUndefined()
    expect(repo.getOwnSeller).not.toHaveBeenCalled()
  })
})

describe('«Elanlarım»’s actions (changeOwnListing)', () => {
  it('deactivates on the API, refreshes the listing’s pages and answers the listing as it is now', async () => {
    repo.deactivateListing = vi.fn(async () => own({ status: 'inactive' }))
    expect(await changeOwnListing(ID, 'deactivate')).toEqual({ ok: true, listing: own({ status: 'inactive' }) })
    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual([`listing:${ID}`, 'listing:tuya-20324', 'listings', 'sitemap:listing', 'home', 'seller:s1', 'sellers'])
  })

  it('renews and activates; deletes after reading what to refresh', async () => {
    repo.renewListing = vi.fn(async () => own())
    repo.activateListing = vi.fn(async () => own())
    repo.getOwnListing = vi.fn(async () => own())
    repo.deleteListing = vi.fn(async () => undefined)
    expect(await changeOwnListing(ID, 'renew')).toMatchObject({ ok: true })
    expect(await changeOwnListing(ID, 'activate')).toMatchObject({ ok: true })
    expect(await changeOwnListing(ID, 'delete')).toEqual({ ok: true })
    expect(repo.deleteListing).toHaveBeenCalledWith(ID)
    repo.getOwnListing = vi.fn(async () => undefined)
    expect(await changeOwnListing(ID, 'delete')).toMatchObject({ ok: false, error: expect.stringMatching(/tapılmadı/) })
  })

  it('says why not', async () => {
    repo.renewListing = vi.fn(async () => {
      throw problem(409, 'listing.wrong-status')
    })
    expect(await changeOwnListing(ID, 'renew')).toMatchObject({ ok: false, error: expect.stringMatching(/vəziyyəti/) })
    repo.renewListing = vi.fn(async () => {
      throw problem(401, 'unauthorized')
    })
    expect(await changeOwnListing(ID, 'renew')).toMatchObject({ ok: false, signedOut: true })
    expect(await changeOwnListing('../x', 'renew')).toMatchObject({ ok: false })
    expect(await changeOwnListing(ID, 'promote' as never)).toMatchObject({ ok: false })
  })

  it('loads the listings with their statistics, a few at a time', async () => {
    repo.listOwnListings = vi.fn(async () => Array.from({ length: 8 }, (_, i) => own({ id: `l-${i}` })))
    let open = 0
    let most = 0
    repo.getListingStats = vi.fn(async (id: string) => {
      most = Math.max(most, ++open)
      await new Promise((r) => setTimeout(r, 1))
      open--
      return { views: Number(id.slice(2)), phoneReveals: 0, favourites: 0, viewsByDay: [] }
    })
    const result = await loadOwnListings()
    expect(result.ok && Object.keys(result.stats)).toHaveLength(8)
    expect(result.ok && result.stats['l-7'].views).toBe(7)
    expect(most).toBeLessThanOrEqual(6)
  })
})

describe('the view beacon’s action (recordView)', () => {
  it('counts the view, quietly', async () => {
    repo.recordListingView = vi.fn(async () => {
      throw new Error('API down')
    })
    await expect(recordView(ID)).resolves.toBeUndefined()
    expect(repo.recordListingView).toHaveBeenCalledWith(ID)
    await recordView('not an id!')
    expect(repo.recordListingView).toHaveBeenCalledTimes(1)
  })
})

describe('the moderator’s decision (decideModeration)', () => {
  const item = { id: ID, listing: own({ status: 'pending' }) } as ModerationItem

  it('approves with the version shown and refreshes the listing’s pages', async () => {
    admin.moderationItem = vi.fn(async () => item)
    admin.decide = vi.fn(async () => ({ listingId: ID, decision: 'approve', status: 'active', version: '10' }))
    expect(await decideModeration(ID, { decision: 'approve', version: '9' })).toEqual({ ok: true })
    expect(admin.decide).toHaveBeenCalledWith(ID, { decision: 'approve', version: '9' })
    expect(updateTag).toHaveBeenCalledWith('listing:tuya-20324')
    expect(updateTag).toHaveBeenCalledWith('seller:s1')
  })

  it('rejects with a reason and a note; both are required', async () => {
    admin.moderationItem = vi.fn(async () => item)
    admin.decide = vi.fn(async () => ({ listingId: ID, decision: 'reject', status: 'rejected', version: '10' }))
    expect(await decideModeration(ID, { decision: 'reject', version: '9', note: 'x' })).toMatchObject({ ok: false, error: 'Rədd səbəbini seçin.' })
    expect(await decideModeration(ID, { decision: 'reject', reasonCode: 'bad-photos', version: '9', note: ' ' })).toMatchObject({ ok: false, error: expect.stringMatching(/izah/) })
    expect(await decideModeration(ID, { decision: 'reject', reasonCode: 'nope' as never, version: '9', note: 'x' })).toMatchObject({ ok: false })
    expect(admin.decide).not.toHaveBeenCalled()
    expect(await decideModeration(ID, { decision: 'reject', reasonCode: 'bad-photos', version: '9', note: ' Başqa bitki ' })).toEqual({ ok: true })
    expect(admin.decide).toHaveBeenCalledWith(ID, { decision: 'reject', reasonCode: 'bad-photos', note: 'Başqa bitki', version: '9' })
  })

  it('says when the listing changed meanwhile, so the page shows it again', async () => {
    admin.moderationItem = vi.fn(async () => item)
    admin.decide = vi.fn(async () => {
      throw problem(409, 'concurrency-conflict')
    })
    expect(await decideModeration(ID, { decision: 'approve', version: '8' })).toMatchObject({ ok: false, stale: true })
    admin.decide = vi.fn(async () => {
      throw problem(403, 'forbidden')
    })
    expect(await decideModeration(ID, { decision: 'approve', version: '9' })).toMatchObject({ ok: false, error: expect.stringMatching(/moderatorlar/) })
    expect(updateTag).not.toHaveBeenCalled()
  })

  it('does nothing in the demo (its page decides in the browser)', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    admin.moderationItem = vi.fn()
    expect(await decideModeration(ID, { decision: 'approve', version: '9' })).toMatchObject({ ok: false })
    expect(admin.moderationItem).not.toHaveBeenCalled()
  })
})

describe('POST /api/revalidate', () => {
  const post = (body: unknown, authorization?: string) =>
    revalidate(new Request('http://localhost:3000/api/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body) }))

  it('expires each tag at once (a webhook; `max` would undo the Server Actions’ updateTag)', async () => {
    vi.stubEnv('REVALIDATE_SECRET', 'dev-revalidate-secret')
    const response = await post({ tags: ['listing:1', 'listings', 'home'] }, 'Bearer dev-revalidate-secret')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: 3 })
    expect(revalidateTag.mock.calls).toEqual([
      ['listing:1', { expire: 0 }],
      ['listings', { expire: 0 }],
      ['home', { expire: 0 }],
    ])
  })

  it('refuses a wrong secret, a missing one, and a broken body', async () => {
    vi.stubEnv('REVALIDATE_SECRET', 'dev-revalidate-secret')
    expect((await post({ tags: ['listings'] }, 'Bearer guess')).status).toBe(401)
    expect((await post({ tags: ['listings'] })).status).toBe(401)
    expect((await post({ tag: 'listings' }, 'Bearer dev-revalidate-secret')).status).toBe(400)
    vi.stubEnv('REVALIDATE_SECRET', '')
    expect((await post({ tags: ['listings'] }, 'Bearer ')).status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
