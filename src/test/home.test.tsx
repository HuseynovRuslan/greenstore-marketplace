import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppStoreProvider } from '@/state/store'
import { loadHeroCounts } from '@/features/home/heroCounts'
import { mockRepository } from '@/services/mockRepository'
import HomePage from '@/views/HomePage'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

async function renderHome() {
  const [content, hero] = await Promise.all([mockRepository.getHomeContent(), loadHeroCounts(mockRepository)])
  render(
    <AppStoreProvider>
      <HomePage content={content} hero={hero} />
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
    for (const title of ['Kateqoriyalar', 'Önə çıxan elanlar', 'Son elanlar', 'Bağınıza peşəkar toxunuş', 'Etibar etdiyiniz satıcılar']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Zeytun ağacı — Olea europaea')).toBeInTheDocument()
    expect(screen.getByText('Satıcıların ödənişlə irəli çəkdiyi elanlar')).toBeInTheDocument()
    expect(screen.getAllByText('Təsdiqlənmiş satıcı')).toHaveLength(3)
    expect(screen.getAllByText('Önə çıxan').length).toBeGreaterThan(0)
    // The mockup name («Bağ vitrini» / badge «Vitrin») was replaced; it must not come back in text or link names.
    expect(screen.queryByText(/vitrin/i)).not.toBeInTheDocument()
    expect(screen.queryByText('VIP')).not.toBeInTheDocument()
  })

  it('names each section link after where it leads', async () => {
    await renderHome()
    // «Önə çıxan elanlar»: one link, «Hamısına bax» (≥ 768 px) / «Hamısı» (phones). No aria-label: the name is the visible
    // text of the width plus a hidden « — Önə çıxan elanlar» (jsdom has no CSS, so it sees both texts).
    const promotedAll = screen.getByRole('link', { name: 'Hamısı Hamısına bax — Önə çıxan elanlar' })
    expect(promotedAll).toHaveAttribute('href', '/elanlar?vip=1')
    expect(promotedAll).not.toHaveAttribute('aria-label')
    expect(within(promotedAll).getByText('Hamısı')).toHaveClass('md:hidden')
    expect(within(promotedAll).getByText('Hamısına bax')).toHaveClass('max-md:hidden')
    expect(within(promotedAll).getByText('— Önə çıxan elanlar')).toHaveClass('sr-only')
    expect(screen.queryByRole('link', { name: /vitrin/i })).not.toBeInTheDocument()
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

  it('explains how buying works: three steps in order, then the warning before buying', async () => {
    await renderHome()
    const heading = screen.getByRole('heading', { level: 2, name: 'GreenStore-da alış necə baş verir?' })
    const section = heading.closest('section')!
    expect(section).toHaveAccessibleName('GreenStore-da alış necə baş verir?')
    expect(within(section).getByText('Səbət və onlayn ödəniş yoxdur. Alış şərtlərini satıcı ilə özünüz razılaşdırırsınız.')).toBeInTheDocument()

    const [steps, tips] = within(section).getAllByRole('list')
    expect(steps.tagName).toBe('OL')
    const items = within(steps).getAllByRole('listitem')
    expect(items.map((li) => within(li).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Uyğun elanı tapın',
      'Satıcı ilə əlaqə saxlayın',
      'Yerində baxın və razılaşın',
    ])
    // Sentence case in the DOM (screen readers read the word); the capitals come from CSS with lang="az".
    expect(items.map((li) => li.querySelector('p')!.textContent)).toEqual(['01 · Tapın', '02 · Dəqiqləşdirin', '03 · Yoxlayın'])
    expect(items[0].querySelector('p')).toHaveClass('uppercase')

    expect(within(section).getByRole('heading', { level: 3, name: 'Bitkini almadan əvvəl' })).toBeInTheDocument()
    expect(within(tips).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Yarpaqları, kökləri və zərərvericiləri yoxlayın',
      'Ölçünü və dibçəyi dəqiqləşdirin',
      'Tanımadığınız satıcıya öncədən pul göndərməyin',
    ])
    // A static tip, not a live region; no «Bütün məsləhətlər» link in this section.
    expect(within(section).queryByRole('status')).not.toBeInTheDocument()
    expect(within(section).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText('Daha rahat və təhlükəsiz seçim')).not.toBeInTheDocument()
  })

  it('shows the five plant categories in the hero with counts from the listings, linked to their pages', async () => {
    await renderHome()
    const list = screen.getByRole('heading', { level: 2, name: 'Kateqoriyalar' }).nextElementSibling as HTMLElement
    expect(within(list).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      '/kateqoriyalar/agaclar',
      '/kateqoriyalar/kollar',
      '/kateqoriyalar/guller',
      '/kateqoriyalar/sarmasiqlar',
      '/kateqoriyalar/yer-ortucu-bitkiler',
    ])
    expect(screen.getByRole('link', { name: 'Ağaclar 16 elan' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Yer örtücü bitkilər 12 elan' })).toBeInTheDocument()
    // A centred group of equal items, not a stretched grid
    expect(list).toHaveClass('justify-center-safe')
    expect(list.className).not.toMatch(/grid-cols/)
  })

  it('marks the category chosen in the Kateqoriya filter', async () => {
    await renderHome()
    const circle = () => screen.getByRole('link', { name: 'Kollar 7 elan' }).querySelector('span')!
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
