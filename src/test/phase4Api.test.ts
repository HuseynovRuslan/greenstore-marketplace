import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminRepository, reportParams } from '@/services/adminRepository'
import { apiRepository } from '@/services/apiRepository'
import { mockRepository } from '@/services/mockRepository'
import { complaintReasonLabel, complaintReasonsFor, isReasonFor, OTHER_REASON } from '@/features/seller/complaintReasons'
import { readReportParams, reportHistory, reportHref, reportMeta, reportTargetHref, reportTargetLine, reportTitle } from '@/features/admin/reportsApi'
import {
  categoryFieldMessages,
  categoryHref,
  checkCategoryInput,
  checkCategoryPatch,
  draftOf,
  findAdminCategory,
  matchesAdminCategory,
  readCategoryParams,
  toCategoryInput,
  toCategoryPatch,
  validateCategoryDraft,
} from '@/features/admin/categoriesApi'
import { overviewTiles } from '@/features/admin/AdminOverviewPanel'
import { isStaff, mayOpen } from '@/features/admin/StaffGate'
import { createDraft, restoreDraft, serviceTypeIdsOfDraft, subcategoryIdOfDraft, toListingInput, withCategory, withTypes, type PostingDraft } from '@/features/posting/draft'
import { validateStep } from '@/features/posting/validation'
import type { AdminCategory, AdminOverview, OwnListing, ReportItem, ReportTarget } from '@/types'

/*
 * Phase 4 (backend-contract.md 3.5, 4.1, 4.2) with DATA_SOURCE=api: the public forms' repository methods and the staff
 * repository against a fake API, and the pure helpers that word the API's codes for the reports and categories pages.
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

const TOKEN = 'c'.repeat(43)
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
const route = (call: Call) => [call.init.method, call.url.pathname]
const signedIn = () => jar.values.set('gs_session', TOKEN)

describe('report reasons are codes (backend-contract.md 4.1)', () => {
  // The table of 4.1, as the API's ReportRules.ReasonsFor has it.
  const table: Record<ReportTarget, string[]> = {
    listing: ['sold', 'wrong-price', 'wrong-photos', 'wrong-info', 'unreachable', 'duplicate', 'fraud', 'other'],
    seller: ['unreachable', 'wrong-info', 'misconduct', 'fraud', 'other'],
    service: ['not-provided', 'wrong-price', 'stolen-photos', 'unreachable', 'fraud', 'other'],
  }

  it('offers each target exactly the codes of the contract, in the dialog’s order, «Digər səbəb» last', () => {
    for (const target of Object.keys(table) as ReportTarget[]) {
      expect(complaintReasonsFor[target].map((r) => r.code)).toEqual(table[target])
      expect(complaintReasonsFor[target].at(-1)).toEqual({ code: OTHER_REASON, label: 'Digər səbəb' })
      const labels = complaintReasonsFor[target].map((r) => r.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })

  it('uses every code of the ReportReason union (the contract file the API is tested with)', () => {
    const contract = JSON.parse(readFileSync(join(__dirname, '..', '..', 'backend', 'contracts', 'frontend-types.json'), 'utf8')) as { unions: Record<string, string[]> }
    const used = new Set(Object.values(complaintReasonsFor).flatMap((list) => list.map((r) => r.code)))
    expect([...used].sort()).toEqual([...contract.unions.ReportReason].sort())
  })

  it('knows which codes a target takes, and words a code for its target', () => {
    expect(isReasonFor('listing', 'sold')).toBe(true)
    expect(isReasonFor('seller', 'sold')).toBe(false)
    expect(isReasonFor('listing', 'Satılıb və ya aktual deyil')).toBe(false)
    expect(complaintReasonLabel('listing', 'unreachable')).toBe('Satıcı ilə əlaqə saxlamaq olmur')
    expect(complaintReasonLabel('service', 'unreachable')).toBe('Əlaqə saxlamaq olmur')
    // A code another target has (an old report after a change of the lists) still gets words.
    expect(complaintReasonLabel('seller', 'sold')).toBe('Satılıb və ya aktual deyil')
  })

  it('the mock refuses what the API refuses', async () => {
    await expect(mockRepository.submitReport({ target: 'seller', targetId: 'x', reason: 'sold' })).rejects.toThrow('not-for-target')
    await expect(mockRepository.submitReport({ target: 'listing', targetId: 'x', reason: 'other' })).rejects.toThrow('comment')
    expect((await mockRepository.submitReport({ target: 'listing', targetId: 'x', reason: 'other', comment: 'Bitki başqadır' })).id).toMatch(/^rep-/)
  })
})

describe('apiRepository: reports and support (backend-contract.md 4.1, 4.2)', () => {
  it('sends a guest’s report with the visitor’s IP and no session', async () => {
    respond = () => ({ status: 201, body: { id: ID } })
    expect(await apiRepository.submitReport({ target: 'listing', targetId: ID, reason: 'wrong-price' })).toEqual({ id: ID })
    expect(route(last())).toEqual(['POST', '/api/v1/reports'])
    expect(bodyOf(last())).toEqual({ target: 'listing', targetId: ID, reason: 'wrong-price' })
    expect(last().init.headers.Authorization).toBeUndefined()
    expect(last().init.headers['X-Client-IP']).toBe('203.0.113.9')
  })

  it('sends a signed-in visitor’s report with the session', async () => {
    signedIn()
    respond = () => ({ body: { id: ID } })
    await apiRepository.submitReport({ target: 'seller', targetId: ID, reason: 'other', comment: 'Zəngə cavab vermir' })
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(bodyOf(last())).toMatchObject({ reason: 'other', comment: 'Zəngə cavab vermir' })
  })

  it('sends a support message and answers its ticket', async () => {
    respond = () => ({ status: 201, body: { ticket: 1001 } })
    expect(await apiRepository.submitSupportMessage({ topic: 'listing', name: 'Aynur', contact: 'aynur@poct.az', message: 'Elanım görünmür, niyə?', listingNumber: 10482 })).toEqual({ ticket: 1001 })
    expect(route(last())).toEqual(['POST', '/api/v1/support'])
    expect(bodyOf(last())).toMatchObject({ topic: 'listing', listingNumber: 10482 })
  })

})

const listing = (patch: Partial<OwnListing> = {}) =>
  ({ id: ID, slug: 'limon-agaci-10430', number: 10430, title: 'Limon ağacı', price: 45, priceType: 'fixed', attributes: ['80–100 sm'], cityId: 'lenkeran', status: 'active', kind: 'product', contactPhone: '+994505551234', images: [], cover: '', publishedAt: '', vip: false, categoryId: 'agaclar', version: '1', photoIds: [], contactPhoneVerified: true, ...patch }) as OwnListing

const report = (patch: Partial<ReportItem> = {}): ReportItem => ({
  id: '01937a52-1111-7a1b-9f00-2d5c1e4b8a10',
  target: 'listing',
  targetId: ID,
  reason: 'wrong-info',
  status: 'open',
  createdAt: '2026-11-22T10:05:00Z',
  targetDeleted: false,
  openReportsOnTarget: 1,
  history: [],
  listing: listing(),
  owner: { userId: '01937a52-2222-7a1b-9f00-2d5c1e4b8a10', name: 'Rauf Məmmədov', accountType: 'individual', status: 'active' },
  ...patch,
})

describe('adminRepository: overview, reports, categories, verifying and blocking (backend-contract.md 3.5)', () => {
  beforeEach(signedIn)

  it('reads the overview', async () => {
    respond = () => ({ body: { moderation: { pending: 2 } } })
    expect(await adminRepository.overview()).toEqual({ moderation: { pending: 2 } })
    expect(route(last())).toEqual(['GET', '/api/v1/admin/overview'])
    expect(last().init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('reads a page of reports with the filters, the staff seeing the number in the site’s spacing', async () => {
    respond = () => ({ body: { items: [report()], total: 1, page: 1, pageCount: 1, totals: { open: 1, investigating: 0, resolved: 0 } } })
    const queue = await adminRepository.reports({ status: 'open', target: 'listing', sort: 'oldest', page: 2 })
    expect(last().url.search).toBe('?status=open&target=listing&sort=oldest&page=2')
    expect(queue.items[0].listing?.contactPhone).toBe('+994 50 555 12 34')
    expect(reportParams({ page: 1 }).toString()).toBe('page=1')
  })

  it('reads one report; none when the API has none', async () => {
    respond = () => ({ body: report() })
    expect((await adminRepository.report('r1'))?.id).toBe(report().id)
    respond = () => ({ status: 404, body: { code: 'report.not-found' } })
    expect(await adminRepository.report('r1')).toBeUndefined()
  })

  it('changes a report', async () => {
    respond = () => ({ body: report({ status: 'resolved', resolution: 'no-violation' }) })
    const item = await adminRepository.updateReport('r1', { status: 'resolved', resolution: 'no-violation', note: 'Yoxlandı' })
    expect(item.status).toBe('resolved')
    expect(route(last())).toEqual(['PATCH', '/api/v1/admin/reports/r1'])
    expect(bodyOf(last())).toEqual({ status: 'resolved', resolution: 'no-violation', note: 'Yoxlandı' })
  })

  it('reads, creates and changes categories', async () => {
    respond = () => ({ body: [] })
    await adminRepository.listCategories('service')
    expect(last().url.pathname + last().url.search).toBe('/api/v1/admin/categories?kind=service')
    respond = () => ({ status: 201, body: { id: 'bag-dekoru' } })
    await adminRepository.createCategory({ kind: 'product', form: 'goods', icon: 'shovel', names: { az: 'Bağ dekoru' } })
    expect(route(last())).toEqual(['POST', '/api/v1/admin/categories'])
    respond = () => ({ body: { id: 'agaclar' } })
    await adminRepository.updateCategory('agaclar', { isActive: false, version: '7' })
    expect(route(last())).toEqual(['PATCH', '/api/v1/admin/categories/agaclar'])
    expect(bodyOf(last())).toEqual({ isActive: false, version: '7' })
    respond = () => ({ status: 404, body: { code: 'category.not-found' } })
    expect(await adminRepository.category('yoxdur')).toBeUndefined()
  })

  it('verifies a seller and blocks an account', async () => {
    respond = () => ({ body: { sellerId: ID, verified: true, verifiedAt: '2026-11-22T10:00:00Z' } })
    await adminRepository.verifySeller(ID, true)
    expect(route(last())).toEqual(['POST', `/api/v1/admin/sellers/${ID}/verify`])
    expect(bodyOf(last())).toEqual({ verified: true })
    respond = () => ({ body: { userId: ID, status: 'blocked', sessionsRevoked: 2, listingsHidden: 3, listingsRestored: 0 } })
    expect((await adminRepository.blockUser(ID, true, 'Dələduzluq')).listingsHidden).toBe(3)
    expect(bodyOf(last())).toEqual({ blocked: true, reason: 'Dələduzluq' })
    await adminRepository.blockUser(ID, false)
    expect(bodyOf(last())).toEqual({ blocked: false })
  })
})

describe('the reports page’s words and address', () => {
  it('reads its state from the address, unknown values falling back', () => {
    expect(readReportParams({ status: 'resolved', target: 'seller', sort: 'oldest', sehife: '3', item: ID, done: 'blocked' })).toEqual({
      status: 'resolved',
      target: 'seller',
      sort: 'oldest',
      page: 3,
      item: ID,
      done: 'blocked',
    })
    expect(readReportParams({ status: 'x', target: 'y', sort: 'z', sehife: '-1', item: '<script>', done: 'z' })).toEqual({ sort: 'newest', page: 1 })
  })

  it('a changed filter starts again at page 1 with nothing open; the notice is not carried along', () => {
    const state = { status: 'open' as const, sort: 'newest' as const, page: 3, item: ID, done: 'report' as const }
    expect(reportHref(state, { status: 'resolved' })).toBe('/idareetme/sikayetler?status=resolved')
    expect(reportHref(state, { item: 'r2' })).toBe('/idareetme/sikayetler?status=open&sehife=3&item=r2')
    expect(reportHref({ sort: 'newest', page: 1 })).toBe('/idareetme/sikayetler')
  })

  it('words the reason, the target and the reporter', () => {
    expect(reportTitle({ target: 'service', reason: 'stolen-photos' })).toBe('Şəkillər başqasının işidir')
    expect(reportTargetLine(report())).toBe('Elan № 10430 · Limon ağacı')
    expect(reportTargetLine(report({ target: 'seller', listing: undefined, seller: { id: ID, slug: 'yasil-bag', name: 'Yaşıl Bağ', verified: false } }))).toBe('Satıcı · Yaşıl Bağ')
    expect(reportMeta(report())).toMatch(/^Elan № 10430 · Limon ağacı · Qonaq · 22 noy\. · \d\d:05$/)
    expect(reportMeta(report({ reporter: { userId: 'u', name: 'Aygün Əliyeva' } }))).toContain('Aygün Əliyeva')
  })

  it('links the target only while visitors can see it', () => {
    expect(reportTargetHref(report())).toBe('/elanlar/limon-agaci-10430')
    expect(reportTargetHref(report({ target: 'service', listing: listing({ kind: 'service', slug: 'landsaft-20316' }) }))).toBe('/xidmetler/landsaft-20316')
    expect(reportTargetHref(report({ listing: listing({ status: 'inactive' }) }))).toBeUndefined()
    expect(reportTargetHref(report({ targetDeleted: true }))).toBeUndefined()
    expect(reportTargetHref(report({ owner: { ...report().owner!, status: 'blocked' } }))).toBeUndefined()
    expect(reportTargetHref(report({ target: 'seller', listing: undefined, seller: { id: ID, slug: 'yasil-bag', name: 'Yaşıl Bağ', verified: true } }))).toBe('/saticilar/yasil-bag')
  })

  it('tells the history: arrival, each change, a note without a change', () => {
    const lines = reportHistory(
      report({
        history: [
          { status: 'investigating', at: '2026-11-22T11:00:00Z', by: { userId: 'm', name: 'Aysel' } },
          { status: 'investigating', note: 'Satıcıya yazıldı', at: '2026-11-22T11:30:00Z' },
          { status: 'resolved', resolution: 'action-taken', note: 'Elan düzəldildi', at: '2026-11-22T12:00:00Z' },
          { status: 'open', at: '2026-11-22T13:00:00Z' },
        ],
      }),
    ).map((l) => l.text)
    expect(lines).toEqual([
      'Şikayət daxil oldu.',
      'Şikayət araşdırmaya götürüldü. (Aysel)',
      'Moderator qeydi əlavə olundu. Qeyd: Satıcıya yazıldı',
      'Şikayət bağlandı: tədbir görüldü. Qeyd: Elan düzəldildi',
      'Şikayət yenidən açıldı.',
    ])
  })
})

const category = (patch: Partial<AdminCategory> = {}): AdminCategory => ({
  id: 'agaclar',
  kind: 'product',
  form: 'plant',
  names: { az: 'Ağaclar', ru: 'Деревья', en: 'Trees' },
  descriptions: { az: 'Dekorativ və meyvə ağacları' },
  icon: 'trees',
  filters: [{ id: 'rootSystem', enabled: true }],
  sortOrder: 10,
  isActive: true,
  listingCount: 12,
  version: '77',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-20T00:00:00Z',
  subcategories: [
    {
      id: 'agaclar-meyve',
      parentId: 'agaclar',
      kind: 'product',
      names: { az: 'Meyvə ağacları', ru: 'Плодовые деревья' },
      filters: [],
      sortOrder: 10,
      isActive: true,
      listingCount: 4,
      version: '5',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-21T00:00:00Z',
    },
  ],
  ...patch,
})

describe('the categories page’s words, forms and address', () => {
  it('reads and writes its state', () => {
    expect(readCategoryParams({ q: '  ağac ', item: 'new', parent: 'agaclar', saved: 'created' })).toEqual({ q: 'ağac', item: 'new', parent: 'agaclar', saved: 'created' })
    expect(readCategoryParams({ item: 'Ağaclar!', parent: 'agaclar', saved: 'x' })).toEqual({ q: '' })
    expect(categoryHref({ q: 'gül' }, { item: 'guller' }, 'updated')).toBe('/idareetme/kateqoriyalar?q=g%C3%BCl&item=guller&saved=updated')
    expect(categoryHref({ q: '', item: 'new', parent: 'agaclar' }, { item: 'agaclar' })).toBe('/idareetme/kateqoriyalar?item=agaclar')
  })

  it('finds rows by any language’s name, sub-categories’ too', () => {
    expect(matchesAdminCategory(category(), 'дерев')).toBe(true)
    expect(matchesAdminCategory(category(), 'meyve')).toBe(true)
    expect(matchesAdminCategory(category(), 'gül')).toBe(false)
    expect(findAdminCategory([category()], 'agaclar-meyve')?.names.az).toBe('Meyvə ağacları')
  })

  it('opens a row in the form, with its form’s filters', () => {
    const draft = draftOf(category())
    expect(draft.names).toEqual({ az: 'Ağaclar', ru: 'Деревья', en: 'Trees' })
    expect(draft.filters).toEqual({ species: false, height: false, age: false, rootSystem: true })
    expect(draftOf(undefined, category()).form).toBe('')
    expect(draftOf(undefined).form).toBe('plant')
  })

  it('sends only what changed, with the version; names in all three languages', () => {
    const row = category()
    expect(toCategoryPatch(draftOf(row), row)).toBeUndefined()
    const draft = draftOf(row)
    draft.names.az = 'Ağaclar və tinglər'
    draft.filters.height = true
    expect(toCategoryPatch(draft, row)).toEqual({
      names: { az: 'Ağaclar və tinglər', ru: 'Деревья', en: 'Trees' },
      filters: [
        { id: 'species', enabled: false },
        { id: 'height', enabled: true },
        { id: 'age', enabled: false },
        { id: 'rootSystem', enabled: true },
      ],
      version: '77',
    })
    const cleared = draftOf(row)
    cleared.descriptions.az = ' '
    cleared.isActive = false
    expect(toCategoryPatch(cleared, row)).toEqual({ descriptions: null, isActive: false, version: '77' })
  })

  it('builds a new category or sub-category', () => {
    const draft = { ...draftOf(undefined), names: { az: 'Bağ dekoru', ru: '', en: '' }, kind: 'product' as const, form: 'goods' as const, icon: 'shovel' as const }
    expect(toCategoryInput(draft)).toEqual({ kind: 'product', form: 'goods', icon: 'shovel', filters: [], names: { az: 'Bağ dekoru' }, isActive: true })
    const sub = { ...draftOf(undefined, category()), names: { az: 'Sərv ağacları', ru: '', en: 'Cypresses' }, sortOrder: '40' }
    expect(toCategoryInput(sub, category())).toEqual({ parentId: 'agaclar', names: { az: 'Sərv ağacları', en: 'Cypresses' }, sortOrder: 40, isActive: true })
  })

  it('checks the form before sending, in the words of the API’s refusals', () => {
    const draft = { ...draftOf(category()), names: { az: '', ru: 'Деревья', en: '' }, sortOrder: 'x' }
    expect(validateCategoryDraft(draft, { sub: false, isNew: false })).toEqual({ 'names.az': 'Azərbaycanca adı yazın.', sortOrder: expect.stringMatching(/Görünmə sırası/) })
    expect(validateCategoryDraft({ ...draftOf(undefined), names: { az: 'Yeni', ru: '', en: '' }, form: '' }, { sub: false, isNew: true })).toEqual({ form: 'Elan formasını seçin.' })
    expect(validateCategoryDraft({ ...draftOf(undefined, category()), names: { az: 'Yeni', ru: '', en: '' } }, { sub: true, isNew: true })).toEqual({})
    expect(categoryFieldMessages({ 'names.az': ['taken'], icon: ['invalid'], unknown: ['x'] })).toEqual({ 'names.az': 'Bu adda kateqoriya artıq var.', icon: 'Kateqoriya işarəsini seçin.' })
  })

  it('the Server Action’s checks keep exactly the contract’s fields', () => {
    const extra = { kind: 'product', form: 'plant', icon: 'trees', names: { az: ' Kaktuslar ', hack: 'x' }, sortOrder: 5, isActive: true, evil: true } as never
    expect(checkCategoryInput(extra)).toEqual({ ok: true, value: { kind: 'product', form: 'plant', icon: 'trees', names: { az: 'Kaktuslar' }, sortOrder: 5, isActive: true } })
    expect(checkCategoryInput({ kind: 'service', form: 'plant', icon: 'trees', names: { az: 'X' } })).toMatchObject({ ok: false, fields: { form: expect.any(String) } })
    expect(checkCategoryInput({ kind: 'product', form: 'plant', icon: 'rocket' as never, names: { az: 'X' } })).toMatchObject({ ok: false, fields: { icon: expect.any(String) } })
    expect(checkCategoryInput({ parentId: 'agaclar', icon: 'trees', names: { az: 'Alt' } })).toEqual({ ok: true, value: { parentId: 'agaclar', names: { az: 'Alt' }, isActive: true } })
    expect(checkCategoryPatch({ isActive: false, version: '9', evil: 1 } as never)).toEqual({ ok: true, value: { isActive: false, version: '9' } })
    expect(checkCategoryPatch({ filters: [{ id: 'nope', enabled: true }] })).toMatchObject({ ok: false, fields: { filters: expect.any(String) } })
    expect(checkCategoryPatch({ names: { az: 'x'.repeat(61) } })).toMatchObject({ ok: false, fields: { 'names.az': expect.stringMatching(/60/) } })
  })
})

describe('the admin home and the staff gate', () => {
  const overview: AdminOverview = {
    moderation: { pending: 4, recheck: 1, approved: 140, rejected: 8 },
    reports: { open: 3, investigating: 1, resolved: 9 },
    listings: { active: 120, pending: 4, rejected: 8, expired: 6, inactive: 2 },
    users: { total: 1250, individual: 1200, business: 50, blocked: 2, staff: 3, newThisWeek: 40 },
    sellers: { total: 50, verified: 12 },
    support: { new: 5, answered: 20, closed: 11 },
    categories: { total: 6, active: 6, subcategories: 21 },
  }

  it('words every section’s numbers', () => {
    const tiles = overviewTiles(overview, false)
    expect(tiles.map((t) => t.title)).toEqual(['Moderasiya', 'Şikayətlər', 'Elanlar', 'İstifadəçilər', 'Satıcılar', 'Dəstək', 'Kateqoriyalar'])
    expect(tiles.find((t) => t.title === 'İstifadəçilər')?.value).toBe(1250)
    // Categories are for admins: a moderator's tile does not link there.
    expect(tiles.find((t) => t.title === 'Kateqoriyalar')?.href).toBeUndefined()
    expect(overviewTiles(overview, true).find((t) => t.title === 'Kateqoriyalar')?.href).toBe('/idareetme/kateqoriyalar')
  })

  it('lets moderators into staff pages and admins alone into the categories', () => {
    expect(isStaff({ role: 'user' })).toBe(false)
    expect(mayOpen({ role: 'moderator' }, 'staff')).toBe(true)
    expect(mayOpen({ role: 'moderator' }, 'admin')).toBe(false)
    expect(mayOpen({ role: 'admin' }, 'admin')).toBe(true)
  })
})

describe('«Elan yerləşdir» sends the sub-category’s id (backend-contract.md 1.3)', () => {
  it('by the name the wizard keeps, for products and services', () => {
    const product = { ...withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'product', 'agaclar'), subcategory: 'Meyvə ağacları' }
    expect(subcategoryIdOfDraft(product)).toBe('agaclar-meyve')
    expect(toListingInput(product)).toMatchObject({ subcategory: 'Meyvə ağacları', subcategoryId: 'agaclar-meyve' })
    const service = { ...withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'service', 'landsaft-xidmetleri'), subcategory: 'Qazon salınması' }
    expect(subcategoryIdOfDraft(service)).toBe('cim-salinmasi')
    expect(subcategoryIdOfDraft({ kind: 'product', categoryId: 'agaclar', subcategory: 'Naməlum' })).toBeUndefined()
    expect(subcategoryIdOfDraft({ kind: 'product', categoryId: 'agaclar', subcategory: '' })).toBeUndefined()
  })

  it('sends every type of a service, the first chosen as the main one (Nov 2026)', () => {
    const base = withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'service', 'landsaft-xidmetleri')
    const service = withTypes(base, ['Bağ baxımı', 'Qazon salınması'])
    expect(service.subcategory).toBe('Bağ baxımı')
    const input = toListingInput(service)
    expect(input.subcategory).toBe('Bağ baxımı')
    expect(input.subcategoryId).toBe(serviceTypeIdsOfDraft(service)![0])
    expect(input.subcategoryIds).toEqual(serviceTypeIdsOfDraft(service))
    expect(input.subcategoryIds).toHaveLength(2)
    expect(input.subcategoryIds).toContain('cim-salinmasi')
    // None ticked: step 1 asks for one.
    expect(validateStep(1, withTypes(base, []))).toMatchObject({ subcategory: 'Ən azı bir xidmət növü seçin.' })
    expect(validateStep(1, service)).toEqual({})
    // A product sends no list (one sub-category, as before).
    const product = { ...withCategory(createDraft({ name: 'Elvin', phone: '+994505551234' }), 'product', 'agaclar'), subcategory: 'Meyvə ağacları' }
    expect(toListingInput(product)).not.toHaveProperty('subcategoryIds')
  })

  it('reads a draft saved before Nov 2026 (one service type) as a list, and drops a type no longer offered', () => {
    const old = { ...withCategory(createDraft(), 'service', 'landsaft-xidmetleri'), subcategory: 'Bağ baxımı' } as Partial<PostingDraft>
    delete old.types
    expect(restoreDraft(old).types).toEqual(['Bağ baxımı'])
    const gone = restoreDraft({ ...withTypes(withCategory(createDraft(), 'service', 'landsaft-xidmetleri'), ['Bağ baxımı', 'Köhnə növ']) })
    expect(gone.types).toEqual(['Bağ baxımı'])
    expect(gone.subcategory).toBe('Bağ baxımı')
  })
})
