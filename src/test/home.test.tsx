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
    expect(screen.getByText('Satıcıların önə çıxardığı elanlar')).toBeInTheDocument()
    expect(screen.getAllByText('Təsdiqlənmiş satıcı')).toHaveLength(3)
    expect(screen.getAllByText('Vitrin').length).toBeGreaterThan(0)
    expect(screen.queryByText('VIP')).not.toBeInTheDocument()
  })

  it('names each section link after where it leads', async () => {
    await renderHome()
    // «Bağ vitrini»: one link, «Hamısına bax» (≥ 768 px) / «Hamısı» (phones). No aria-label: the name is the visible
    // text of the width plus a hidden « — Bağ vitrini» (jsdom has no CSS, so it sees both texts).
    const vitrinAll = screen.getByRole('link', { name: 'Hamısı Hamısına bax — Bağ vitrini' })
    expect(vitrinAll).toHaveAttribute('href', '/elanlar?vip=1')
    expect(vitrinAll).not.toHaveAttribute('aria-label')
    expect(within(vitrinAll).getByText('Hamısı')).toHaveClass('md:hidden')
    expect(within(vitrinAll).getByText('Hamısına bax')).toHaveClass('max-md:hidden')
    expect(within(vitrinAll).getByText('— Bağ vitrini')).toHaveClass('sr-only')
    expect(screen.queryByRole('link', { name: 'Bütün vitrin elanları' })).not.toBeInTheDocument()
    for (const [name, href] of [
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

  it('shows the ten categories in the hero, linked to their pages', async () => {
    await renderHome()
    const list = screen.getByRole('heading', { level: 2, name: 'Kateqoriyalar' }).nextElementSibling as HTMLElement
    expect(within(list).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/kateqoriyalar/agaclar',
      '/kateqoriyalar/kollar',
      '/kateqoriyalar/guller',
      '/kateqoriyalar/otaq-bitkileri',
      '/kateqoriyalar/tingler-fidanlar',
      '/kateqoriyalar/cim-toxumlar',
      '/kateqoriyalar/torpaq-gubreler',
      '/kateqoriyalar/bag-avadanliqlari',
      '/kateqoriyalar/suvarma-sistemleri',
      '/xidmetler',
    ])
    expect(screen.getByRole('link', { name: 'Ağaclar 1 240 elan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bağ xidmətləri 95 elan' })).toHaveAttribute('href', '/xidmetler')
  })

  it('marks the category chosen in the Kateqoriya filter', async () => {
    await renderHome()
    const circle = () => screen.getByRole('link', { name: 'Kollar 860 elan' }).querySelector('span')!
    expect(circle()).not.toHaveClass('bg-forest')
    const form = screen.getByRole('search', { name: 'Elan axtarışı' })
    await userEvent.click(within(form).getByRole('button', { name: 'Kateqoriya' }))
    await userEvent.click(within(form).getByRole('button', { name: 'Kollar' }))
    expect(circle()).toHaveClass('bg-forest')
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
