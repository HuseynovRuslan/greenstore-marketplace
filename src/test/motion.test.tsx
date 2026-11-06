import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Reveal } from '@/components/ui/Reveal'
import { FavoriteButton } from '@/components/cards/FavoriteButton'
import { MotionProvider } from '@/components/motion/MotionProvider'
import { AppStoreProvider } from '@/state/store'
import { mockRepository } from '@/services/mockRepository'
import HomePage from '@/views/HomePage'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// The heart's spring is started through animation controls; record the calls.
const heartStart = vi.hoisted(() => vi.fn())
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useAnimationControls: () => ({ start: heartStart, stop: vi.fn(), set: vi.fn(), mount: () => () => {} }),
}))

describe('Reveal (scroll reveal once)', () => {
  let callback: IntersectionObserverCallback | undefined
  const disconnect = vi.fn()

  beforeEach(() => {
    callback = undefined
    disconnect.mockClear()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe() {}
        disconnect = disconnect
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const grid = () => screen.getByTestId('grid')
  function renderGrid() {
    render(
      <div data-testid="grid-host">
        <Reveal className="grid">
          <article>A</article>
          <article>B</article>
          <article>C</article>
        </Reveal>
      </div>,
    )
    const el = screen.getByTestId('grid-host').firstElementChild as HTMLElement
    el.dataset.testid = 'grid'
    return el
  }

  it('hides a grid below the fold and reveals it once, 60 ms apart', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 2000 } as DOMRect)
    renderGrid()
    expect(grid()).toHaveAttribute('data-reveal', 'pending')
    const items = [...grid().children] as HTMLElement[]
    expect(items.map((i) => i.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])

    act(() => callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(grid()).toHaveAttribute('data-reveal', 'done')
    expect(disconnect).toHaveBeenCalled()
  })

  it('leaves a grid that is already on screen alone', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect)
    renderGrid()
    expect(grid()).not.toHaveAttribute('data-reveal')
  })

  it('does nothing under prefers-reduced-motion', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 2000 } as DOMRect)
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }))
    renderGrid()
    expect(grid()).not.toHaveAttribute('data-reveal')
  })
})

describe('hero entrance', () => {
  it('rises the heading without fading it and fades up the card and the categories in turn', async () => {
    render(
      <AppStoreProvider>
        <HomePage content={await mockRepository.getHomeContent()} />
      </AppStoreProvider>,
    )
    const heading = screen.getByRole('heading', { level: 1 }).parentElement!
    expect(heading).toHaveClass('animate-rise', 'motion-reduce:animate-none')
    expect(heading.className).not.toMatch(/fade/)
    expect(document.getElementById('hero-search')).toHaveClass('animate-fade-up', 'motion-reduce:animate-none')
    const items = [...document.querySelectorAll<HTMLElement>('#kateqoriyalar li')]
    expect(items.map((li) => li.style.animationDelay)).toEqual(['120ms', '150ms', '180ms', '210ms', '240ms', '270ms', '300ms', '330ms', '360ms', '390ms'])
  })

  it('plays once per page load: marks the hero seen once the entrance is over', async () => {
    vi.useFakeTimers()
    document.documentElement.removeAttribute('data-hero-seen')
    const content = await mockRepository.getHomeContent()
    render(
      <AppStoreProvider>
        <HomePage content={content} />
      </AppStoreProvider>,
    )
    act(() => vi.advanceTimersByTime(900))
    expect(document.documentElement).not.toHaveAttribute('data-hero-seen')
    act(() => vi.advanceTimersByTime(100))
    expect(document.documentElement).toHaveAttribute('data-hero-seen')
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-hero-seen')
  })
})

describe('favourite heart', () => {
  beforeEach(() => {
    window.localStorage.clear()
    heartStart.mockClear()
  })

  it('pops with a spring when switched on, not when switched off or already on', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AppStoreProvider>
        <FavoriteButton key="a" kind="listing" id="zeytun-agaci" title="Zeytun ağacı" />
      </AppStoreProvider>,
    )
    expect(heartStart).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /seçilmişlərə əlavə et/ }))
    expect(heartStart).toHaveBeenCalledTimes(1)
    // A velocity kick from rest: the spring itself makes the pop, and can be retargeted mid-way.
    expect(heartStart).toHaveBeenCalledWith({ scale: 1, transition: { type: 'spring', stiffness: 520, damping: 18, velocity: 9 } })
    await user.click(screen.getByRole('button', { name: /seçilmişlərdən çıxar/ }))
    expect(heartStart).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /seçilmişlərə əlavə et/ }))
    expect(heartStart).toHaveBeenCalledTimes(2)
    // A fresh button for a listing that is already a favourite stays still.
    heartStart.mockClear()
    rerender(
      <AppStoreProvider>
        <FavoriteButton key="b" kind="listing" id="zeytun-agaci" title="Zeytun ağacı" />
      </AppStoreProvider>,
    )
    expect(screen.getByRole('button', { name: /seçilmişlərdən çıxar/ })).toHaveAttribute('aria-pressed', 'true')
    expect(heartStart).not.toHaveBeenCalled()
  })
})

describe('MotionProvider', () => {
  it('passes its children through unchanged (the features load later, in their own chunk)', () => {
    render(
      <MotionProvider>
        <main>
          <h1>Bağ elanları</h1>
        </main>
      </MotionProvider>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Bağ elanları' })).toBeInTheDocument()
  })
})
