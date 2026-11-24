import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminCategory, AdminOverview, OwnListing, ReportItem, ReportQueue, UserProfile } from '@/types'

/*
 * The staff pages with DATA_SOURCE=api (backend-contract.md 3.5, phase 4), rendered as the server renders them: the
 * repositories and the Server Actions are fakes. Who may open what, what the lists and panels show, and what the
 * decision forms send.
 */

vi.setConfig({ testTimeout: 20_000 })

const { repo, admin, actions, router } = vi.hoisted(() => ({
  repo: { getMe: vi.fn() },
  admin: {} as Record<string, ReturnType<typeof vi.fn>>,
  actions: {
    updateReportStatus: vi.fn(),
    setAccountBlocked: vi.fn(),
    setSellerVerified: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    decideModeration: vi.fn(),
  },
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() },
}))

vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/idareetme/sikayetler', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/services/repository', () => ({ getRepository: () => repo }))
vi.mock('@/services/adminRepository', () => ({ adminRepository: admin }))
vi.mock('@/features/admin/actions', () => actions)
vi.mock('@/features/account/useAccount', () => ({ useAccount: () => ({ account: undefined, signOut: vi.fn() }), firstName: (n: string) => n }))

const { default: ApiComplaintsPage } = await import('@/views/admin/ApiComplaintsPage')
const { default: ApiCategoriesPage } = await import('@/views/admin/ApiCategoriesPage')
const { default: ApiModerationPage } = await import('@/views/admin/ApiModerationPage')

const ID = '01937a52-6c4e-7a1b-9f00-2d5c1e4b8a10'
const OWNER = '01937a52-2222-7a1b-9f00-2d5c1e4b8a10'

const person = (role: UserProfile['role']): UserProfile => ({ id: 'u1', fullName: 'Aysel Həsənova', email: '', phone: '+994 50 555 12 34', accountType: 'individual', role, locale: 'az' })

const report: ReportItem = {
  id: '01937a52-1111-7a1b-9f00-2d5c1e4b8a10',
  target: 'listing',
  targetId: ID,
  reason: 'wrong-info',
  comment: 'Hündürlük düzgün deyil',
  status: 'open',
  createdAt: '2026-11-22T10:05:00Z',
  targetDeleted: false,
  openReportsOnTarget: 2,
  history: [],
  reporter: { userId: 'u9', name: 'Aygün Əliyeva' },
  owner: { userId: OWNER, name: 'Rauf Məmmədov', accountType: 'individual', status: 'active' },
  listing: {
    id: ID,
    slug: 'limon-agaci-10430',
    number: 10430,
    title: 'Limon ağacı',
    price: 45,
    priceType: 'fixed',
    attributes: ['80–100 sm'],
    cityId: 'lenkeran',
    status: 'active',
    kind: 'product',
    contactPhone: '+994 50 555 12 34',
    images: [],
    cover: '/images/x.webp',
    publishedAt: '2026-11-01T00:00:00Z',
    vip: false,
    categoryId: 'agaclar',
    version: '1',
    photoIds: [],
    contactPhoneVerified: true,
  } as OwnListing,
}

const queue = (items: ReportItem[] = [report]): ReportQueue => ({ items, total: items.length, page: 1, pageCount: 1, totals: { open: 1, investigating: 4, resolved: 9 } })

const params = (value: Record<string, string> = {}) => ({ searchParams: Promise.resolve(value) })

beforeEach(() => {
  for (const key of Object.keys(admin)) delete admin[key]
  for (const fn of [...Object.values(actions), ...Object.values(router), ...Object.values(repo)]) fn.mockReset()
})

describe('/idareetme/sikayetler (DATA_SOURCE=api)', () => {
  it('asks a visitor without a session to sign in, and tells a user it is for staff', async () => {
    repo.getMe.mockResolvedValue(undefined)
    render(await ApiComplaintsPage(params()))
    expect(screen.getByText('Şəxsi kabinetə daxil olun')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Daxil ol' })).toHaveAttribute('href', `/daxil-ol?next=${encodeURIComponent('/idareetme/sikayetler')}`)
  })

  it('tells a user without the role that it is for staff, without asking the API', async () => {
    repo.getMe.mockResolvedValue(person('user'))
    admin.reports = vi.fn()
    render(await ApiComplaintsPage(params()))
    expect(screen.getByText('Bu bölmə moderatorlar üçündür')).toBeInTheDocument()
    expect(admin.reports).not.toHaveBeenCalled()
  })

  it('shows a moderator the reports with their words, the target and the history', async () => {
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.reports = vi.fn(async () => queue())
    render(await ApiComplaintsPage(params({ status: 'open' })))
    expect(admin.reports).toHaveBeenCalledWith({ status: 'open', target: undefined, sort: 'newest', page: 1 })
    expect(screen.getByRole('heading', { level: 1, name: 'Şikayətlərin idarə olunması' })).toBeInTheDocument()
    expect(screen.getByText('1 açıq şikayət · 4 araşdırılır · 9 həll olunub')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Açıq · 1' })).toHaveAttribute('aria-current', 'page')
    const list = screen.getByRole('region', { name: 'Şikayət siyahısı' })
    expect(within(list).getByText('Məlumat düzgün deyil')).toBeInTheDocument()
    expect(within(list).getByText('2 açıq şikayət bu hədəf üzrə')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Məlumat düzgün deyil · Elan' })).toBeInTheDocument()
    expect(screen.getByText(/Şikayətçi: Aygün Əliyeva\. “Hündürlük düzgün deyil”/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Elanı aç' })).toHaveAttribute('href', '/elanlar/limon-agaci-10430')
    expect(screen.getByText('Əlaqə: +994 50 555 12 34')).toBeInTheDocument()
    expect(screen.getByText(/Şikayət daxil oldu\./)).toBeInTheDocument()
    // Blocking is for admins.
    expect(screen.queryByRole('button', { name: 'Hesabı blokla' })).not.toBeInTheDocument()
    expect(screen.getByText(/yalnız adminə açıqdır/)).toBeInTheDocument()
  })

  it('closes a report with a resolution and a note, then shows the notice', async () => {
    const user = userEvent.setup()
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.reports = vi.fn(async () => queue())
    actions.updateReportStatus.mockResolvedValue({ ok: true })
    render(await ApiComplaintsPage(params()))
    await user.click(screen.getByRole('button', { name: 'Şikayəti bağla' }))
    expect(screen.getByText('Şikayəti bağlamaq üçün nəticəni seçin.')).toBeInTheDocument()
    expect(actions.updateReportStatus).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Nəticə'), 'action-taken')
    await user.type(screen.getByLabelText(/Moderator qeydi/), 'Satıcı hündürlüyü düzəltdi')
    await user.click(screen.getByRole('button', { name: 'Şikayəti bağla' }))
    expect(actions.updateReportStatus).toHaveBeenCalledWith(report.id, { status: 'resolved', resolution: 'action-taken', note: 'Satıcı hündürlüyü düzəltdi' })
    expect(router.replace).toHaveBeenCalledWith(`/idareetme/sikayetler?item=${report.id}&done=report`, { scroll: false })
  })

  it('lets an admin block the account behind the target after a confirmation', async () => {
    const user = userEvent.setup()
    repo.getMe.mockResolvedValue(person('admin'))
    admin.reports = vi.fn(async () => queue())
    actions.setAccountBlocked.mockResolvedValue({ ok: true, result: { userId: OWNER, status: 'blocked', sessionsRevoked: 1, listingsHidden: 3, listingsRestored: 0 } })
    render(await ApiComplaintsPage(params()))
    await user.click(screen.getByRole('button', { name: 'Hesabı blokla' }))
    const dialog = screen.getByRole('dialog', { name: 'Hesabı bloklamaq istəyirsiniz?' })
    await user.type(within(dialog).getByLabelText(/Səbəb/), 'Dələduzluq')
    await user.click(within(dialog).getByRole('button', { name: 'Hesabı blokla' }))
    expect(actions.setAccountBlocked).toHaveBeenCalledWith(OWNER, true, 'Dələduzluq')
    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('done=blocked'), { scroll: false })
  })

  it('says what changed after a decision, and when nothing is reported', async () => {
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.reports = vi.fn(async () => queue([{ ...report, status: 'resolved', resolution: 'no-violation' }]))
    const { unmount } = render(await ApiComplaintsPage(params({ item: report.id, done: 'report' })))
    expect(screen.getByText('Şikayət yeniləndi')).toBeInTheDocument()
    expect(screen.getByText(/həll olunub \(pozuntu yoxdur\)/)).toBeInTheDocument()
    unmount()
    admin.reports = vi.fn(async () => queue([]))
    render(await ApiComplaintsPage(params({ status: 'resolved' })))
    expect(screen.getByText('Bu vəziyyətdə şikayət yoxdur.')).toBeInTheDocument()
    expect(screen.getByText('Şikayət seçilməyib')).toBeInTheDocument()
  })
})

const categories: AdminCategory[] = [
  {
    id: 'agaclar',
    kind: 'product',
    form: 'plant',
    names: { az: 'Ağaclar', ru: 'Деревья', en: 'Trees' },
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
        names: { az: 'Meyvə ağacları' },
        filters: [],
        sortOrder: 10,
        isActive: false,
        listingCount: 4,
        version: '5',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-21T00:00:00Z',
      },
    ],
  },
]

describe('/idareetme/kateqoriyalar (DATA_SOURCE=api)', () => {
  it('is for admins: a moderator is told so', async () => {
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.listCategories = vi.fn()
    render(await ApiCategoriesPage(params()))
    expect(screen.getByText('Bu bölmə adminlər üçündür')).toBeInTheDocument()
    expect(admin.listCategories).not.toHaveBeenCalled()
  })

  it('lists the categories with their sub-categories and edits the first', async () => {
    repo.getMe.mockResolvedValue(person('admin'))
    admin.listCategories = vi.fn(async () => categories)
    render(await ApiCategoriesPage(params()))
    expect(screen.getByText('1 əsas kateqoriya · 1 alt kateqoriya · Son yenilənmə: 21 noyabr 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Meyvə ağacları · 4' })).toHaveAttribute('href', '/idareetme/kateqoriyalar?item=agaclar-meyve')
    expect(screen.getByText('Filtrlər: Kök sistemi')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kateqoriyanı redaktə et' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^Rusca/, { selector: 'input' })).toHaveValue('Деревья')
    expect(screen.getByRole('checkbox', { name: 'Kök sistemi filtri' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Növ filtri' })).not.toBeChecked()
  })

  it('saves what changed with the version, then shows the notice', async () => {
    const user = userEvent.setup()
    repo.getMe.mockResolvedValue(person('admin'))
    admin.listCategories = vi.fn(async () => categories)
    actions.updateCategory.mockResolvedValue({ ok: true, category: categories[0] })
    render(await ApiCategoriesPage(params({ item: 'agaclar' })))
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))
    expect(screen.getByText('Dəyişiklik yoxdur.')).toBeInTheDocument()
    expect(actions.updateCategory).not.toHaveBeenCalled()
    const en = screen.getByLabelText(/^İngiliscə/, { selector: 'input' })
    await user.clear(en)
    await user.type(en, 'Trees and saplings')
    await user.click(screen.getByRole('checkbox', { name: 'Aktiv kateqoriya' }))
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))
    expect(actions.updateCategory).toHaveBeenCalledWith('agaclar', { names: { az: 'Ağaclar', ru: 'Деревья', en: 'Trees and saplings' }, isActive: false, version: '77' })
    expect(router.replace).toHaveBeenCalledWith('/idareetme/kateqoriyalar?item=agaclar&saved=updated', { scroll: false })
  })

  it('shows the API’s field errors at their fields', async () => {
    const user = userEvent.setup()
    repo.getMe.mockResolvedValue(person('admin'))
    admin.listCategories = vi.fn(async () => categories)
    actions.createCategory.mockResolvedValue({ ok: false, error: 'Sahələri yoxlayın.', fields: { 'names.az': 'Bu adda kateqoriya artıq var.' } })
    render(await ApiCategoriesPage(params({ item: 'new', parent: 'agaclar' })))
    expect(screen.getByRole('heading', { name: 'Alt kateqoriya əlavə et: Ağaclar' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Kateqoriya işarəsi seçin')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))
    expect(screen.getByText('Azərbaycanca adı yazın.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^Azərbaycanca/, { selector: 'input' }), 'Meyvə ağacları')
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))
    expect(actions.createCategory).toHaveBeenCalledWith({ parentId: 'agaclar', names: { az: 'Meyvə ağacları' }, isActive: true })
    expect(await screen.findByText('Bu adda kateqoriya artıq var.')).toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})

describe('/idareetme (DATA_SOURCE=api)', () => {
  const overview: AdminOverview = {
    moderation: { pending: 4, recheck: 1, approved: 140, rejected: 8 },
    reports: { open: 3, investigating: 1, resolved: 9 },
    listings: { active: 120, pending: 4, rejected: 8, expired: 6, inactive: 2 },
    users: { total: 1250, individual: 1200, business: 50, blocked: 2, staff: 3, newThisWeek: 40 },
    sellers: { total: 50, verified: 12 },
    support: { new: 5, answered: 20, closed: 11 },
    categories: { total: 6, active: 6, subcategories: 21 },
  }

  it('shows the numbers of every section above the queue', async () => {
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.overview = vi.fn(async () => overview)
    admin.moderationQueue = vi.fn(async () => ({ items: [], total: 0, page: 1, pageCount: 1, totals: { pending: 0, recheck: 0, approved: 0, rejected: 0 } }))
    render(await ApiModerationPage({ ...params(), withOverview: true }))
    const section = screen.getByRole('region', { name: 'İcmal' })
    expect(within(section).getByRole('link', { name: /Şikayətlər\s*3\s*açıq şikayət/ })).toHaveAttribute('href', '/idareetme/sikayetler')
    expect(within(section).getByText('1 250')).toBeInTheDocument()
    expect(within(section).queryByText(/Usta çağır/)).not.toBeInTheDocument()
  })

  it('the queue alone at /idareetme/moderasiya', async () => {
    repo.getMe.mockResolvedValue(person('moderator'))
    admin.overview = vi.fn()
    admin.moderationQueue = vi.fn(async () => ({ items: [], total: 0, page: 1, pageCount: 1, totals: { pending: 0, recheck: 0, approved: 0, rejected: 0 } }))
    render(await ApiModerationPage(params()))
    expect(screen.queryByRole('region', { name: 'İcmal' })).not.toBeInTheDocument()
    expect(admin.overview).not.toHaveBeenCalled()
  })
})
