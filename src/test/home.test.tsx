import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStoreProvider } from '@/state/store'
import { mockRepository } from '@/services/mockRepository'
import HomePage from '@/views/HomePage'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

async function renderHome() {
  const content = await mockRepository.getHomeContent()
  render(
    <AppStoreProvider>
      <HomePage content={content} />
    </AppStoreProvider>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockClear()
  })

  it('renders the Figma sections and content', async () => {
    await renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Azərbaycanda bitki və bağ elanları' })).toBeInTheDocument()
    for (const title of ['Kateqoriyalar', 'Bağ vitrini', 'Son elanlar', 'Bağınıza peşəkar toxunuş', 'Etibar etdiyiniz satıcılar']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Zeytun ağacı — Olea europaea')).toBeInTheDocument()
    expect(screen.getByText('1240 elan')).toBeInTheDocument()
    expect(screen.getAllByText('Təsdiqlənmiş satıcı')).toHaveLength(3)
    expect(screen.getAllByText('Vitrin').length).toBeGreaterThan(0)
    expect(screen.queryByText('VIP')).not.toBeInTheDocument()
  })

  it('names each section link after where it leads', async () => {
    await renderHome()
    for (const [name, href] of [
      ['Bütün vitrin elanları', '/elanlar?vip=1'],
      ['Bütün elanlara bax', '/elanlar'],
      ['Bütün xidmətlər', '/xidmetler'],
      ['Biznes satıcıların elanları', '/elanlar?saticiNovu=biznes'],
    ]) {
      // Header link (≥ 768 px) and the full-width mobile button
      const links = screen.getAllByRole('link', { name })
      expect(links).toHaveLength(2)
      for (const link of links) expect(link).toHaveAttribute('href', href)
    }
    // The arrow is a decorative icon, not text read out by screen readers
    expect(screen.queryByText(/→/)).not.toBeInTheDocument()
  })

  it('links category cards to their category pages', async () => {
    await renderHome()
    expect(screen.getByRole('link', { name: /Ağaclar/ })).toHaveAttribute('href', '/kateqoriyalar/agaclar')
  })

  it('toggles a favorite from a listing card', async () => {
    await renderHome()
    const button = screen.getByRole('button', { name: /Zeytun ağacı — Olea europaea — seçilmişlərə əlavə et/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: /Zeytun ağacı — Olea europaea — seçilmişlərdən çıxar/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits the hero search to the catalogue (details in heroSearch.test.tsx)', async () => {
    await renderHome()
    const form = screen.getByRole('search', { name: 'Elan axtarışı' })
    expect(screen.getByText('Ağac, gül, tinglər və bağçılıq xidmətləri — satıcı ilə birbaşa əlaqə saxlayın.')).toBeInTheDocument()
    await userEvent.type(within(form).getByRole('searchbox', { name: 'Axtarış sözü' }), 'zeytun')
    await userEvent.click(within(form).getByRole('button', { name: 'Axtar' }))
    expect(push).toHaveBeenCalledWith('/elanlar?q=zeytun')
  })
})
