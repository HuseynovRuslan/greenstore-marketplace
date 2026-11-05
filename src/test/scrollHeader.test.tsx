import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Listbox } from '@/components/ui/Listbox'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { useScrollHeader } from '@/hooks/useScrollHeader'
import { AppStoreProvider } from '@/state/store'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))

async function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y })
  window.dispatchEvent(new Event('scroll'))
  await frame()
}

function Harness() {
  const ref = useRef<HTMLElement>(null)
  const { scrolled, hidden } = useScrollHeader(ref)
  return (
    <>
      <header ref={ref} data-testid="header" data-scrolled={scrolled || undefined} data-hidden={hidden || undefined}>
        <a href="#mehsullar">Məhsullar</a>
      </header>
      <Listbox
        label="Şəhər"
        value=""
        onChange={() => {}}
        options={[
          { value: '', label: 'Bütün şəhərlər' },
          { value: 'baki', label: 'Bakı' },
        ]}
      />
      <button type="button">Elsewhere</button>
    </>
  )
}

const header = () => screen.getByTestId('header')

beforeEach(async () => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

describe('useScrollHeader', () => {
  it('marks the header scrolled after 8 px and keeps it in view up to 320 px', async () => {
    render(<Harness />)
    await frame()
    expect(header()).not.toHaveAttribute('data-scrolled')
    await scrollTo(10)
    expect(header()).toHaveAttribute('data-scrolled')
    await scrollTo(300)
    expect(header()).not.toHaveAttribute('data-hidden')
  })

  it('hides on a downward scroll past 320 px and shows again on any upward scroll', async () => {
    render(<Harness />)
    await scrollTo(300)
    await scrollTo(400)
    expect(header()).toHaveAttribute('data-hidden')
    await scrollTo(398)
    expect(header()).not.toHaveAttribute('data-hidden')
    await scrollTo(402) // 4 px down: not enough
    expect(header()).not.toHaveAttribute('data-hidden')
    await scrollTo(410)
    expect(header()).toHaveAttribute('data-hidden')
    await scrollTo(100)
    expect(header()).not.toHaveAttribute('data-hidden')
  })

  it('never hides while the city Listbox is open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('combobox', { name: 'Şəhər' }))
    await scrollTo(400)
    await scrollTo(700)
    expect(header()).not.toHaveAttribute('data-hidden')
    await user.keyboard('{Escape}')
    await scrollTo(800)
    expect(header()).toHaveAttribute('data-hidden')
  })

  it('never hides while focus is inside the header, and comes back when focus enters it', async () => {
    render(<Harness />)
    act(() => screen.getByRole('link', { name: 'Məhsullar' }).focus())
    await scrollTo(400)
    await scrollTo(700)
    expect(header()).not.toHaveAttribute('data-hidden')

    act(() => screen.getByRole('button', { name: 'Elsewhere' }).focus())
    await scrollTo(800)
    expect(header()).toHaveAttribute('data-hidden')
    act(() => screen.getByRole('link', { name: 'Məhsullar' }).focus())
    expect(header()).not.toHaveAttribute('data-hidden')
  })
})

describe('home header search pill', () => {
  let observed: IntersectionObserverCallback | undefined
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    observed = undefined
    scrollIntoView.mockClear()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          observed = callback
        }
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  function renderHome() {
    render(
      <AppStoreProvider>
        <SiteHeader variant="home" />
        <div id="hero-search">
          <input id="hero-q" aria-label="Axtarış sözü" />
        </div>
      </AppStoreProvider>,
    )
  }
  const pillButtons = () => screen.getAllByRole('button', { name: 'Bitki, ağac və ya xidmət axtar' })
  const nav = () => screen.getByRole('navigation', { name: 'Əsas bölmələr' })

  it('replaces the nav with the pill once the hero search has scrolled away, and leads back to it', async () => {
    const user = userEvent.setup()
    renderHome()
    expect(pillButtons()).toHaveLength(3) // ≥ lg pill, 768–1023 px icon, phone icon
    for (const b of pillButtons()) expect(b.closest('[inert]')).not.toBeNull()
    expect(nav()).not.toHaveAttribute('inert')

    act(() => observed?.([{ isIntersecting: false, boundingClientRect: { top: -200 } } as IntersectionObserverEntry], {} as IntersectionObserver))
    for (const b of pillButtons()) expect(b.closest('[inert]')).toBeNull()
    expect(nav()).toHaveAttribute('inert')

    await user.click(pillButtons()[0])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(screen.getByRole('textbox', { name: 'Axtarış sözü' })).toHaveFocus()

    act(() => observed?.([{ isIntersecting: true, boundingClientRect: { top: 300 } } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(nav()).not.toHaveAttribute('inert')
  })

  it('sets the scrolled state on the home header', async () => {
    renderHome()
    await scrollTo(40)
    expect(screen.getByRole('banner')).toHaveAttribute('data-scrolled')
  })
})
