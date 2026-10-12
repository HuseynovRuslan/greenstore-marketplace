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
    expect(screen.getByRole('heading', { level: 1, name: 'Bağınız üçün doğru seçim.' })).toBeInTheDocument()
    for (const title of ['Kateqoriyalar', 'VIP elanlar', 'Son elanlar', 'Bağınıza peşəkar toxunuş', 'Etibar etdiyiniz satıcılar']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Zeytun ağacı — Olea europaea')).toBeInTheDocument()
    expect(screen.getByText('428 elan')).toBeInTheDocument()
    expect(screen.getAllByText('Təsdiqlənmiş satıcı')).toHaveLength(3)
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

  it('validates the price range and submits the hero search to the catalog', async () => {
    await renderHome()
    const form = screen.getByRole('button', { name: 'Elanları tap' }).closest('form')!
    await userEvent.type(within(form).getByLabelText('Min. qiymət, ₼'), '200')
    await userEvent.type(within(form).getByLabelText('Maks. qiymət, ₼'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Elanları tap' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum qiymət maksimumdan böyük ola bilməz.')
    expect(push).not.toHaveBeenCalled()

    await userEvent.clear(within(form).getByLabelText('Maks. qiymət, ₼'))
    await userEvent.type(within(form).getByLabelText('Nə axtarırsınız?'), 'zeytun')
    await userEvent.click(screen.getByRole('button', { name: 'Elanları tap' }))
    expect(push).toHaveBeenCalledWith('/elanlar?q=zeytun&min=200')
  })
})
