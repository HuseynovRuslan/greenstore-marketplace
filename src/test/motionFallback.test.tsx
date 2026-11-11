import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FooterNav } from '@/components/layout/FooterNav'
import { footerGroups } from '@/components/layout/footerLinks'
import { Dialog } from '@/components/ui/Dialog'
import { ActiveFilterRow } from '@/features/search/SearchControls'
import { activeChips } from '@/features/search/searchState'
import { emptySearchState } from '@/features/search/searchUrl'

// The lazily loaded motion bundles never arrive (slow network, a chunk that failed).
vi.mock('@/components/motion/MotionFeatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/motion/MotionFeatures')>()
  const never = () => new Promise<never>(() => {})
  return { ...actual, loadDomMax: never, loadForDialog: never, loadDomAnimation: never }
})

const hidden = (el: HTMLElement) => el.style.opacity === '0' || /translateY\(100%\)|scale\(0\.9/.test(el.style.transform)

describe('motion without its feature bundle', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('still shows a bottom sheet the moment it opens (no hidden first frame waiting on the bundle)', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }))
    render(
      <Dialog open title="Filtrlər" onClose={() => {}}>
        <p>Qruplar</p>
      </Dialog>,
    )
    const panel = screen.getByRole('dialog', { name: 'Filtrlər' })
    expect(hidden(panel)).toBe(false)
    expect(hidden(panel.previousElementSibling as HTMLElement)).toBe(false)
  })

  it('shows chips that arrive later at once', () => {
    const noop = () => {}
    const { rerender } = render(<ActiveFilterRow chips={[]} filterCount={0} onRemove={noop} onReset={noop} fallbackFocusId="h" />)
    const chips = activeChips({ ...emptySearchState, categoryId: 'agaclar', delivery: true })
    rerender(<ActiveFilterRow chips={chips} filterCount={2} onRemove={noop} onReset={noop} fallbackFocusId="h" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Ağaclar', 'Çatdırılma', 'Sıfırla'])
    for (const button of buttons) expect(hidden(button)).toBe(false)
  })

  it('still opens and closes the footer groups on a phone (classes stand in for the height animation)', async () => {
    const user = userEvent.setup()
    render(<FooterNav groups={footerGroups()} />)
    const button = screen.getByRole('button', { name: 'Şəhərlər' })
    const panel = () => document.getElementById(button.getAttribute('aria-controls')!)!
    expect(panel()).toHaveClass('max-md:hidden')
    await user.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(panel()).not.toHaveClass('max-md:hidden')
    expect(panel()).toHaveClass('max-md:visible!', 'max-md:h-auto!', 'max-md:opacity-100!')
    await user.click(button)
    expect(panel()).toHaveClass('max-md:hidden')
  })
})
