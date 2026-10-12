import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppStoreProvider } from '@/app/store'
import HomePage from '@/pages/HomePage'

function renderHome() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomePage /> },
      { path: '/elanlar', element: <p>catalog</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <AppStoreProvider>
      <RouterProvider router={router} />
    </AppStoreProvider>,
  )
  return router
}

describe('HomePage', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the Figma sections and content', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'Bağınız üçün doğru seçim.' })).toBeInTheDocument()
    for (const title of ['Kateqoriyalar', 'VIP elanlar', 'Son elanlar', 'Bağınıza peşəkar toxunuş', 'Etibar etdiyiniz satıcılar']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getByText('Zeytun ağacı — Olea europaea')).toBeInTheDocument()
    expect(screen.getByText('428 elan')).toBeInTheDocument()
    expect(screen.getAllByText('Təsdiqlənmiş satıcı')).toHaveLength(3)
  })

  it('toggles a favorite from a listing card', async () => {
    renderHome()
    const button = screen.getByRole('button', { name: /Zeytun ağacı — Olea europaea — seçilmişlərə əlavə et/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: /Zeytun ağacı — Olea europaea — seçilmişlərdən çıxar/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('validates the price range and submits the hero search to the catalog', async () => {
    const router = renderHome()
    const form = screen.getByRole('button', { name: 'Elanları tap' }).closest('form')!
    await userEvent.type(within(form).getByLabelText('Min. qiymət, ₼'), '200')
    await userEvent.type(within(form).getByLabelText('Maks. qiymət, ₼'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Elanları tap' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum qiymət maksimumdan böyük ola bilməz.')

    await userEvent.clear(within(form).getByLabelText('Maks. qiymət, ₼'))
    await userEvent.type(within(form).getByLabelText('Nə axtarırsınız?'), 'zeytun')
    await userEvent.click(screen.getByRole('button', { name: 'Elanları tap' }))
    expect(router.state.location.pathname).toBe('/elanlar')
    expect(router.state.location.search).toBe('?q=zeytun&min=200')
  })
})
