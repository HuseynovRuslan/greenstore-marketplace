import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkipLink } from '@/components/layout/SkipLink'
import { DemoBanner } from '@/components/layout/DemoBanner'

describe('SkipLink', () => {
  function renderPage() {
    render(
      <>
        <SkipLink />
        <header>
          <button type="button">Menyu</button>
        </header>
        <main id="main">
          <h1>Başlıq</h1>
          <button type="button">İlk düymə</button>
        </main>
      </>,
    )
  }

  it('is the first Tab stop and moves focus to <main id="main">', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.tab()
    const link = screen.getByRole('link', { name: 'Əsas məzmuna keç' })
    expect(link).toHaveFocus()
    expect(link).toHaveAttribute('href', '#main')
    // Off screen until focused, then shown above the sticky header (z-40) and the drawer (z-50)
    expect(link).toHaveClass('fixed', 'z-[60]', '-translate-y-[200%]', 'focus:translate-y-0')

    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'İlk düymə' })).toHaveFocus()
  })

  it('drops the temporary tabindex once <main> loses focus', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('link', { name: 'Əsas məzmuna keç' }))
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
    await user.tab()
    expect(screen.getByRole('main')).not.toHaveAttribute('tabindex')
  })
})

describe('DemoBanner', () => {
  it('is a named complementary landmark', () => {
    render(<DemoBanner />)
    const banner = screen.getByRole('complementary', { name: 'Demo versiya' })
    expect(banner).toContainElement(screen.getByRole('button', { name: 'Demo bildirişini bağla' }))
  })
})
