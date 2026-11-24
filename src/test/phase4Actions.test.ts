import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/services/apiRepository'

/*
 * Phase 4's Server Actions (backend-contract.md 3.5, 4.1, 4.2): «Şikayət et», «Bizimlə əlaqə» and the staff's changes
 * of reports, accounts and categories. The repositories are fakes; `updateTag` is a spy.
 */

const { repo, admin, updateTag } = vi.hoisted(() => ({
  repo: {} as Record<string, ReturnType<typeof vi.fn>>,
  admin: {} as Record<string, ReturnType<typeof vi.fn>>,
  updateTag: vi.fn(),
}))

vi.mock('next/cache', () => ({ updateTag, revalidateTag: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, has: () => false, set: () => {}, delete: () => {} }) }))
vi.mock('@/services/repository', async (original) => ({ ...(await original<typeof import('@/services/repository')>()), getRepository: () => repo }))
vi.mock('@/services/adminRepository', () => ({ adminRepository: admin }))

const { sendReport } = await import('@/features/listing/actions')
const { sendSupportMessage } = await import('@/features/support/actions')
const { createCategory, setAccountBlocked, setSellerVerified, updateCategory, updateReportStatus } = await import('@/features/admin/actions')

const ID = '01937a52-6c4e-7a1b-9f00-2d5c1e4b8a10'
const problem = (status: number, code: string, errors?: Record<string, string[]>) => new ApiError(status, code, 'x', { code, ...(errors ? { errors } : {}) })

beforeEach(() => {
  for (const key of Object.keys(repo)) delete repo[key]
  for (const key of Object.keys(admin)) delete admin[key]
  updateTag.mockClear()
  vi.stubEnv('DATA_SOURCE', 'api')
})

describe('«Şikayət et» (sendReport)', () => {
  it('sends the reason’s code and the trimmed comment', async () => {
    repo.submitReport = vi.fn(async () => ({ id: 'r1' }))
    expect(await sendReport({ target: 'listing', targetId: ID, reason: 'wrong-price', comment: '  ' })).toEqual({ ok: true, id: 'r1' })
    expect(repo.submitReport).toHaveBeenCalledWith({ target: 'listing', targetId: ID, reason: 'wrong-price', comment: undefined })
  })

  it('refuses a text, another target’s code, and «Digər səbəb» without words', async () => {
    repo.submitReport = vi.fn()
    expect(await sendReport({ target: 'listing', targetId: ID, reason: 'Qiymət düzgün deyil' as never })).toEqual({ ok: false, error: 'Səbəbi seçin.' })
    expect(await sendReport({ target: 'seller', targetId: ID, reason: 'sold' })).toEqual({ ok: false, error: 'Səbəbi seçin.' })
    expect(await sendReport({ target: 'service', targetId: ID, reason: 'other', comment: ' ' })).toEqual({ ok: false, error: 'Nə baş verdiyini qısaca yazın.' })
    expect(await sendReport({ target: 'nope' as never, targetId: ID, reason: 'other' })).toMatchObject({ ok: false })
    expect(repo.submitReport).not.toHaveBeenCalled()
  })

  it('words the API’s refusals', async () => {
    repo.submitReport = vi.fn(async () => {
      throw problem(404, 'listing.not-found')
    })
    expect(await sendReport({ target: 'listing', targetId: ID, reason: 'sold' })).toEqual({ ok: false, error: 'Bu elan artıq saytda deyil.' })
    repo.submitReport = vi.fn(async () => {
      throw problem(429, 'rate-limited')
    })
    expect(await sendReport({ target: 'seller', targetId: ID, reason: 'fraud' })).toMatchObject({ ok: false, error: expect.stringMatching(/ard-arda/) })
    repo.submitReport = vi.fn(async () => {
      throw problem(400, 'validation', { comment: ['too-long'] })
    })
    expect(await sendReport({ target: 'listing', targetId: ID, reason: 'fraud', comment: 'x' })).toEqual({ ok: false, error: 'İzah 500 simvoldan uzun ola bilməz.' })
  })
})

describe('«Bizimlə əlaqə» (sendSupportMessage)', () => {
  it('sends the trimmed message and answers the ticket', async () => {
    repo.submitSupportMessage = vi.fn(async () => ({ ticket: 1001 }))
    expect(await sendSupportMessage({ topic: 'account', name: ' Aynur ', contact: ' aynur@poct.az ', message: ' Şifrəmi unutmuşam, kömək edin ' })).toEqual({ ok: true, ticket: 1001 })
    expect(repo.submitSupportMessage).toHaveBeenCalledWith({ topic: 'account', name: 'Aynur', contact: 'aynur@poct.az', message: 'Şifrəmi unutmuşam, kömək edin' })
  })

  it('refuses a listing number that is not one, and words the API’s refusals', async () => {
    repo.submitSupportMessage = vi.fn(async () => Promise.reject(problem(400, 'validation', { contact: ['invalid'] })))
    expect(await sendSupportMessage({ topic: 'listing', name: 'A', contact: '12345', message: 'Elanım görünmür, niyə?', listingNumber: -4 })).toEqual({ ok: false, error: 'Elan nömrəsini rəqəmlə yazın.' })
    expect(await sendSupportMessage({ topic: 'listing', name: 'A', contact: '12345', message: 'Elanım görünmür, niyə?' })).toEqual({ ok: false, error: 'Telefon nömrəsini və ya e-poçtu düzgün yazın.' })
  })
})

describe('the staff’s changes', () => {
  it('a report: closing needs a resolution; the note goes along', async () => {
    admin.updateReport = vi.fn(async () => ({}))
    expect(await updateReportStatus(ID, { status: 'resolved' })).toEqual({ ok: false, error: 'Şikayəti bağlamaq üçün nəticəni seçin.' })
    expect(await updateReportStatus(ID, {})).toMatchObject({ ok: false })
    expect(admin.updateReport).not.toHaveBeenCalled()
    expect(await updateReportStatus(ID, { status: 'resolved', resolution: 'no-violation', note: ' Yoxlandı ' })).toEqual({ ok: true })
    expect(admin.updateReport).toHaveBeenCalledWith(ID, { status: 'resolved', resolution: 'no-violation', note: 'Yoxlandı' })
    expect(await updateReportStatus(ID, { status: 'investigating', resolution: 'no-violation' })).toEqual({ ok: true })
    expect(admin.updateReport).toHaveBeenLastCalledWith(ID, { status: 'investigating' })
    expect(await updateReportStatus(ID, { note: 'Satıcıya yazıldı' })).toEqual({ ok: true })
    expect(admin.updateReport).toHaveBeenLastCalledWith(ID, { note: 'Satıcıya yazıldı' })
  })

  it('a report: a moderator’s missing session and a missing report in words', async () => {
    admin.updateReport = vi.fn(async () => Promise.reject(problem(401, 'unauthorized')))
    expect(await updateReportStatus(ID, { status: 'investigating' })).toEqual({ ok: false, error: 'Sessiyanın vaxtı bitib. Yenidən daxil olun.' })
    admin.updateReport = vi.fn(async () => Promise.reject(problem(404, 'report.not-found')))
    expect(await updateReportStatus(ID, { status: 'investigating' })).toEqual({ ok: false, error: 'Şikayət tapılmadı.' })
  })

  it('blocking refreshes the site’s pages at once; an admin cannot block themselves', async () => {
    admin.blockUser = vi.fn(async () => ({ userId: ID, status: 'blocked', sessionsRevoked: 1, listingsHidden: 2, listingsRestored: 0 }))
    expect(await setAccountBlocked(ID, true, ' Dələduzluq ')).toMatchObject({ ok: true, result: { listingsHidden: 2 } })
    expect(admin.blockUser).toHaveBeenCalledWith(ID, true, 'Dələduzluq')
    expect(updateTag).toHaveBeenCalledWith('listings')
    expect(updateTag).toHaveBeenCalledWith('sellers')
    admin.blockUser = vi.fn(async () => Promise.reject(problem(409, 'account.cannot-block-self')))
    expect(await setAccountBlocked(ID, true)).toEqual({ ok: false, error: 'Öz hesabınızı bloklaya bilməzsiniz.' })
    admin.blockUser = vi.fn(async () => Promise.reject(problem(403, 'forbidden')))
    expect(await setAccountBlocked(ID, true)).toEqual({ ok: false, error: 'Bu əməliyyat sizin rolunuz üçün açıq deyil.' })
  })

  it('verifying refreshes the seller’s page', async () => {
    admin.verifySeller = vi.fn(async () => ({ sellerId: ID, verified: true }))
    expect(await setSellerVerified(ID, true)).toEqual({ ok: true })
    expect(updateTag).toHaveBeenCalledWith(`seller:${ID}`)
  })

  it('a category: checked here, the API’s field errors worded, a stale version told', async () => {
    admin.createCategory = vi.fn(async () => ({ id: 'bag-dekoru' }))
    expect(await createCategory({ kind: 'product', form: 'goods', icon: 'shovel', names: { az: '' } })).toMatchObject({ ok: false, fields: { 'names.az': 'Azərbaycanca adı yazın.' } })
    expect(admin.createCategory).not.toHaveBeenCalled()
    expect(await createCategory({ kind: 'product', form: 'goods', icon: 'shovel', names: { az: 'Bağ dekoru' } })).toEqual({ ok: true, category: { id: 'bag-dekoru' } })
    expect(updateTag).toHaveBeenCalledWith('taxonomy')
    admin.createCategory = vi.fn(async () => Promise.reject(problem(400, 'validation', { 'names.az': ['taken'] })))
    expect(await createCategory({ kind: 'product', form: 'goods', icon: 'shovel', names: { az: 'Ağaclar' } })).toMatchObject({ ok: false, fields: { 'names.az': 'Bu adda kateqoriya artıq var.' } })
    admin.updateCategory = vi.fn(async () => Promise.reject(problem(409, 'concurrency-conflict')))
    expect(await updateCategory('agaclar', { isActive: false, version: '7' })).toMatchObject({ ok: false, stale: true })
    expect(await updateCategory('Ağaclar!', { isActive: false })).toMatchObject({ ok: false })
  })

  it('the demo keeps its changes in the browser', async () => {
    vi.stubEnv('DATA_SOURCE', 'mock')
    admin.updateReport = vi.fn()
    expect(await updateReportStatus(ID, { status: 'investigating' })).toMatchObject({ ok: false })
    expect(await setAccountBlocked(ID, true)).toMatchObject({ ok: false })
    expect(await createCategory({ kind: 'product', form: 'goods', icon: 'shovel', names: { az: 'X' } })).toMatchObject({ ok: false })
    expect(admin.updateReport).not.toHaveBeenCalled()
  })
})
