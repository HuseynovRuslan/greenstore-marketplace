import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listingById } from '@/data/listings'
import { actionsFor, countByStatus, daysLeft, expiryLabel, mergeOwnListings, renewal, tabFromParam } from '@/features/cabinet/model'
import { listingToDraft } from '@/features/posting/fromListing'
import { filterQuery, searchSummary, suggestedName } from '@/features/saved-searches/useSavedSearches'
import { firstInvalidStep } from '@/features/posting/validation'
import { AppStoreProvider } from '@/state/store'
import SavedSearchesPage from '@/views/account/SavedSearchesPage'
import type { Listing } from '@/types'

// Long user-event flows: give them room when the whole suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/kabinet/axtarislar',
  useSearchParams: () => new URLSearchParams(),
}))

const own = (id: string, patch: Partial<Listing> = {}) => ({ ...listingById(id)!, ...patch })

describe('cabinet model', () => {
  const now = Date.parse('2026-11-07T10:00:00Z')

  it('merges server listings with local versions and changes, newest first', () => {
    const server = [own('tuya-smaragd'), own('lavanda-fidani'), own('defne-agaci')]
    const edited = { ...own('tuya-smaragd'), title: 'Tuya — yeni', status: 'pending' as const, updatedAt: '2026-11-07T12:00:00Z' }
    const merged = mergeOwnListings(server, [edited], { 'lavanda-fidani': renewal(now), 'defne-agaci': { removed: true } })
    expect(merged.map((l) => l.id)).toEqual(['tuya-smaragd', 'lavanda-fidani'])
    expect(merged[0]).toMatchObject({ title: 'Tuya — yeni', status: 'pending' })
    expect(merged[1].status).toBe('active')
    expect(daysLeft(merged[1], now)).toBe(30)
  })

  it('turns a promotion on with the «Önə çıxan» flag, but not for a bump', () => {
    const [promoted] = mergeOwnListings([own('defne-agaci')], [], { 'defne-agaci': { promotion: { packageId: 'one-cixar', until: '2026-11-14T00:00:00Z' } } })
    expect(promoted.vip).toBe(true)
    const [bumped] = mergeOwnListings([own('defne-agaci')], [], { 'defne-agaci': { promotion: { packageId: 'ireli-cek', until: '2026-11-12T00:00:00Z' } } })
    expect(bumped.vip).toBe(false)
  })

  it('counts statuses, reads the tab from the URL and offers the right actions', () => {
    const counts = countByStatus([own('tuya-smaragd'), own('lavanda-fidani'), own('sarv-tingleri-topdan')], 1)
    expect(counts).toMatchObject({ all: 4, active: 1, expired: 1, rejected: 1, draft: 1 })
    expect(tabFromParam('redd')).toBe('rejected')
    expect(tabFromParam('nonsense')).toBe('all')
    expect(actionsFor('expired')[0]).toBe('renew')
    expect(actionsFor('rejected')[0]).toBe('fix')
    expect(actionsFor('active')).toContain('promote')
  })

  it('words the time left', () => {
    expect(expiryLabel(20)).toEqual({ text: '20 gün qalıb', soon: false })
    expect(expiryLabel(3)).toEqual({ text: '3 gün qalıb', soon: true })
    expect(expiryLabel(1)?.text).toBe('Sabah bitir')
    expect(expiryLabel(0)?.text).toBe('Bu gün bitir')
  })

  it('opens a published listing for editing with its category locked and its facts filled', () => {
    const draft = listingToDraft(own('zeytun-agaci'), { name: 'Elvin', phone: '+994505551234' })
    expect(draft).toMatchObject({ kind: 'product', categoryId: 'agaclar', priceType: 'negotiable', price: '145', wholesale: true, wholesaleMin: '10', editing: { id: 'zeytun-agaci', number: 10482 } })
    expect(draft.attrs).toMatchObject({ heightMin: '180', heightMax: '200', rootSystem: 'container', frost: '-10', plantingMonths: '3,4,5,9,10' })
    // Only the photos and the rules checkbox are left to do.
    expect(firstInvalidStep({ ...draft, photos: [{ id: 'p', name: 'p', width: 1, height: 1 }], rulesAccepted: true })).toBeUndefined()
  })
})

describe('saved searches', () => {
  it('keeps only the filters and suggests a name from them', () => {
    expect(filterQuery('seher=baki&kateqoriya=agaclar&sehife=3&siralama=price-asc')).toBe('kateqoriya=agaclar&seher=baki')
    expect(suggestedName('kateqoriya=agaclar&seher=baki')).toMatch(/Ağaclar/)
    expect(searchSummary('kateqoriya=agaclar&max=50')).toEqual(expect.arrayContaining(['Ağaclar', '50 ₼-a qədər']))
  })

  beforeEach(() => localStorage.clear())

  it('lists, renames, mutes and deletes saved searches in the cabinet', async () => {
    const user = userEvent.setup()
    localStorage.setItem('greenstore:session', JSON.stringify({ id: 'u-elvin', fullName: 'Elvin Əliyev', email: 'e@x.az', phone: '+994 50 555 12 34', accountType: 'business', sellerId: 'abseron-tingcilik' }))
    render(
      <AppStoreProvider>
        <SavedSearchesPage />
      </AppStoreProvider>,
    )
    const first = (await screen.findByRole('link', { name: 'Bakıda ağaclar' })).closest('li')!
    expect(within(first).getByText('3 yeni')).toBeInTheDocument()
    const alert = within(first).getByRole('switch', { name: /Yeni elan çıxanda xəbər ver/ })
    expect(alert).toHaveAttribute('aria-checked', 'true')
    await user.click(alert)
    expect(alert).toHaveAttribute('aria-checked', 'false')

    await user.click(within(first).getByRole('button', { name: 'Adını dəyiş' }))
    const field = screen.getByRole('textbox', { name: /Ad/ })
    await user.clear(field)
    await user.type(field, 'Bakı, ağac')
    await user.click(screen.getByRole('button', { name: 'Yadda saxla' }))
    expect(await screen.findByRole('link', { name: 'Bakı, ağac' })).toBeInTheDocument()

    const second = screen.getByRole('link', { name: 'Tuya, 50 ₼-a qədər' }).closest('li')!
    await user.click(within(second).getByRole('button', { name: 'Sil' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Axtarışı silək?' })).getByRole('button', { name: 'Sil' }))
    expect(screen.queryByRole('link', { name: 'Tuya, 50 ₼-a qədər' })).not.toBeInTheDocument()
  })
})
