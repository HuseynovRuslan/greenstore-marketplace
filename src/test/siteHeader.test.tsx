import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteHeader } from '@/components/layout/SiteHeader'
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

/** IntersectionObserver callbacks by the id of the element they watch: #hero (home) and #hero-search (search card). */
let watchers: Map<string, IntersectionObserverCallback>
const scrollIntoView = vi.fn()

beforeEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  watchers = new Map()
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe(el: Element) {
        watchers.set(el.id, this.callback)
      }
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

/** Reports the element as still below the header (in view) or scrolled up past it. */
const report = (id: string, past: boolean) =>
  act(() =>
    watchers.get(id)?.(
      [{ isIntersecting: !past, boundingClientRect: { top: past ? -600 : 300 } } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )

function renderPage({ hero }: { hero: boolean }) {
  render(
    <AppStoreProvider>
      <SiteHeader hero={hero} />
      {/* The page's search card; on the home page it sits inside the hero. */}
      {hero ? (
        <section id="hero">
          <div id="hero-search">
            <input id="hero-q" aria-label="Axtarış sözü" />
          </div>
        </section>
      ) : (
        <div id="hero-search">
          <input id="hero-q" aria-label="Axtarış sözü" />
        </div>
      )}
    </AppStoreProvider>,
  )
}
const header = () => screen.getByRole('banner')
const pillButtons = () => screen.getAllByRole('button', { name: 'Bitki, ağac və ya xidmət axtar' })
const nav = () => screen.getByRole('navigation', { name: 'Əsas bölmələr' })
/** The ≥ lg pill's wrapper, which shares the nav's grid cell and fades with it. */
const pillCell = () => pillButtons()[0].parentElement!

describe('header over the home hero', () => {
  it('starts transparent over the hero photo, overlapping it by its own height', () => {
    renderPage({ hero: true })
    expect(header()).toHaveAttribute('data-hero')
    expect(header()).toHaveAttribute('data-over-hero')
    expect(header()).toHaveClass('sticky', 'top-0', '-mb-[58px]', 'md:-mb-[76px]')
    // White logo, nav and icons, and the light «Elan yerləşdir», from the over-hero: variant (index.css).
    expect(screen.getAllByRole('link', { name: 'GreenStore — ana səhifə' })[0]).toHaveClass('over-hero:text-white')
    expect(within(nav()).getByRole('link', { name: 'Məhsullar' })).toHaveClass('over-hero:text-white')
    expect(screen.getAllByRole('link', { name: 'Seçilmişlər' })[0]).toHaveClass('over-hero:text-white')
    expect(screen.getAllByRole('link', { name: 'Elan yerləşdir' })[0]).toHaveClass('over-hero:bg-surface', 'over-hero:text-forest')
  })

  it('turns solid once the hero has scrolled past its bottom edge, and stays solid while scrolling on', async () => {
    renderPage({ hero: true })
    report('hero', true)
    expect(header()).not.toHaveAttribute('data-over-hero')
    // data-hero without data-over-hero is what slides the solid header in (index.css, .gs-header).
    expect(header()).toHaveAttribute('data-hero')
    for (const y of [900, 1600, 1500, 3000]) {
      await scrollTo(y)
      expect(header()).not.toHaveAttribute('data-over-hero')
      expect(header()).not.toHaveAttribute('data-hidden')
    }
    expect(header()).toHaveAttribute('data-scrolled')
  })

  it('goes back to transparent when the hero comes back under it', () => {
    renderPage({ hero: true })
    report('hero', true)
    report('hero', false)
    expect(header()).toHaveAttribute('data-over-hero')
  })

  it('shows the search pill only in the solid state', () => {
    renderPage({ hero: true })
    // The hero search card has scrolled under the header, but the header is still over the hero.
    report('hero-search', true)
    expect(pillCell()).toHaveClass('opacity-0')
    for (const b of pillButtons()) expect(b.closest('[inert]')).not.toBeNull()
    expect(nav()).not.toHaveClass('opacity-0')

    report('hero', true)
    expect(pillCell()).not.toHaveClass('opacity-0')
    for (const b of pillButtons()) expect(b.closest('[inert]')).toBeNull()
    expect(nav()).toHaveClass('opacity-0')

    report('hero', false)
    expect(pillCell()).toHaveClass('opacity-0')
    expect(nav()).not.toHaveClass('opacity-0')
  })
})

describe('header on pages without a hero', () => {
  it('is solid from the start and never hides, whichever way the page scrolls', async () => {
    renderPage({ hero: false })
    expect(header()).not.toHaveAttribute('data-hero')
    expect(header()).not.toHaveAttribute('data-over-hero')
    expect(header()).toHaveClass('sticky', 'top-0')
    expect(header()).not.toHaveClass('-mb-[58px]')
    for (const y of [400, 700, 1400, 1390, 2600, 100]) {
      await scrollTo(y)
      expect(header()).not.toHaveAttribute('data-hidden')
      expect(header()).not.toHaveAttribute('data-over-hero')
    }
  })

  it('gets its shadow once the page is scrolled', async () => {
    renderPage({ hero: false })
    await frame()
    expect(header()).not.toHaveAttribute('data-scrolled')
    await scrollTo(40)
    expect(header()).toHaveAttribute('data-scrolled')
    await scrollTo(0)
    expect(header()).not.toHaveAttribute('data-scrolled')
  })

  it('replaces the nav with the pill once the search card has scrolled away, and leads back to it', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    expect(pillButtons()).toHaveLength(3) // ≥ lg pill, 768–1023 px icon, phone icon
    for (const b of pillButtons()) expect(b.closest('[inert]')).not.toBeNull()
    expect(pillCell()).toHaveClass('opacity-0')
    expect(nav()).not.toHaveClass('opacity-0')

    report('hero-search', true)
    for (const b of pillButtons()) expect(b.closest('[inert]')).toBeNull()
    expect(pillCell()).not.toHaveClass('opacity-0')
    expect(nav()).toHaveClass('opacity-0')

    await user.click(pillButtons()[0])
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
    expect(screen.getByRole('textbox', { name: 'Axtarış sözü' })).toHaveFocus()

    report('hero-search', false)
    expect(nav()).not.toHaveClass('opacity-0')
    for (const b of pillButtons()) expect(b.closest('[inert]')).not.toBeNull()
  })

  it('keeps a focused nav link shown when the search card scrolls away', () => {
    renderPage({ hero: false })
    const link = screen.getByRole('link', { name: 'Məhsullar' })
    act(() => link.focus())
    report('hero-search', true)
    expect(nav()).not.toHaveClass('opacity-0')
    expect(link).toHaveFocus()
    // Once focus leaves the nav, the pill takes its place.
    act(() => link.blur())
    expect(nav()).toHaveClass('opacity-0')
    expect(pillCell()).not.toHaveClass('opacity-0')
  })

  it('keeps the four nav links in the Tab order while the pill shows; focusing one brings the nav back', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    report('hero-search', true)
    const links = within(nav()).getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Məhsullar', 'Xidmətlər', 'Satıcılar', 'Önə çıxanlar'])
    // user-event ignores `inert`, so the attribute itself is what keeps the links reachable in a browser.
    expect(nav().closest('[inert]')).toBeNull()
    expect(nav()).toHaveClass('opacity-0')

    act(() => screen.getAllByRole('link', { name: 'GreenStore — ana səhifə' })[0].focus())
    for (const link of links) {
      await user.tab()
      expect(link).toHaveFocus()
      expect(nav()).not.toHaveClass('opacity-0')
      expect(nav()).not.toHaveClass('pointer-events-none')
      expect(pillCell()).toHaveClass('opacity-0')
      // The pill stays reachable while it is faded out
      expect(pillCell().closest('[inert]')).toBeNull()
    }

    // Tab goes on to the pill, which fades back in; Shift+Tab returns to the nav.
    await user.tab()
    expect(pillButtons()[0]).toHaveFocus()
    expect(pillCell()).not.toHaveClass('opacity-0')
    expect(nav()).toHaveClass('opacity-0')
    await user.tab({ shift: true })
    expect(links[3]).toHaveFocus()
    expect(nav()).not.toHaveClass('opacity-0')
  })
})
