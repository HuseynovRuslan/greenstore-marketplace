import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomeHeader } from '@/components/layout/HomeHeader'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AppStoreProvider } from '@/state/store'
import { SESSION_KEY } from '@/state/bootstrap'

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
      [{ isIntersecting: !past, boundingClientRect: { top: past ? -600 : 300 }, rootBounds: { top: 0 } } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  )

function renderPage({ hero }: { hero: boolean }) {
  return render(
    <AppStoreProvider>
      {/* The page's search card; on the home page it sits inside the hero, with the sentinel at the hero's bottom. */}
      {hero ? (
        <div className="relative">
          <HomeHeader />
          <section id="hero">
            <div id="hero-search">
              <input id="hero-q" aria-label="Axtarış sözü" />
            </div>
            <div id="hero-end" />
          </section>
        </div>
      ) : (
        <>
          <SiteHeader />
          <div id="hero-search">
            <input id="hero-q" aria-label="Axtarış sözü" />
          </div>
        </>
      )}
    </AppStoreProvider>,
  )
}
/** The header in use: the other home header is aria-hidden, so it is not a banner landmark. */
const header = () => screen.getByRole('banner')
const homeHeaders = (container: HTMLElement) => ({
  transparent: container.querySelector<HTMLElement>('header[data-placement="hero"]')!,
  solid: container.querySelector<HTMLElement>('header[data-placement="fixed"]')!,
})
const pillButtons = () => screen.getAllByRole('button', { name: 'Bitki, ağac və ya xidmət axtar' })
const nav = () => screen.getByRole('navigation', { name: 'Əsas bölmələr' })
/** The ≥ lg pill's wrapper, which shares the nav's grid cell and fades with it. */
const pillCell = () => pillButtons()[0].parentElement!

describe('home headers', () => {
  it('starts with the transparent header, absolutely positioned at the top of the hero, and the solid one hidden', () => {
    const { container } = renderPage({ hero: true })
    const { transparent, solid } = homeHeaders(container)
    expect(header()).toBe(transparent)
    expect(transparent).toHaveAttribute('data-over-hero')
    expect(transparent).toHaveClass('absolute', 'inset-x-0', 'top-0')
    // It scrolls away with the hero: nothing on it or its wrapper keeps it on screen.
    for (let el: HTMLElement | null = transparent; el && el !== container; el = el.parentElement) {
      expect(el.className).not.toMatch(/(fixed|sticky)/)
    }
    expect(transparent).not.toHaveAttribute('inert')
    // White logo, nav and icons, and the light «Elan yerləşdir», from the over-hero: variant (index.css).
    expect(within(transparent).getByRole('link', { name: 'Məhsullar' })).toHaveClass('over-hero:text-white')
    expect(within(transparent).getAllByRole('link', { name: 'Elan yerləşdir' })[0]).toHaveClass('over-hero:bg-surface', 'over-hero:text-forest')

    expect(solid).toHaveClass('fixed', 'inset-x-0', 'top-0')
    expect(solid).not.toHaveAttribute('data-shown')
    expect(solid).toHaveAttribute('inert')
    expect(solid).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the solid header once the hero has scrolled past, and hides it again back in the hero', () => {
    const { container } = renderPage({ hero: true })
    const { transparent, solid } = homeHeaders(container)
    report('hero-end', true)
    expect(header()).toBe(solid)
    expect(solid).toHaveAttribute('data-shown')
    expect(solid).not.toHaveAttribute('inert')
    expect(solid).toHaveAttribute('data-scrolled')
    expect(transparent).toHaveAttribute('inert')
    expect(transparent).toHaveAttribute('aria-hidden', 'true')

    report('hero-end', false)
    expect(header()).toBe(transparent)
    expect(solid).not.toHaveAttribute('data-shown')
    expect(solid).toHaveAttribute('inert')
  })

  it('never has both headers in use', () => {
    const { container } = renderPage({ hero: true })
    const inUse = () => Object.values(homeHeaders(container)).filter((h) => !h.hasAttribute('inert'))
    for (const past of [false, true, true, false, true, false]) {
      report('hero-end', past)
      expect(inUse()).toHaveLength(1)
      expect(screen.getAllByRole('banner')).toHaveLength(1)
    }
  })

  it('has the search pill only on the solid header', () => {
    const { container } = renderPage({ hero: true })
    const { transparent, solid } = homeHeaders(container)
    report('hero-search', true)
    for (const b of within(transparent).getAllByRole('button', { name: 'Bitki, ağac və ya xidmət axtar', hidden: true })) {
      expect(b.closest('[inert]')).not.toBeNull()
    }
    report('hero-end', true)
    const solidPills = within(solid).getAllByRole('button', { name: 'Bitki, ağac və ya xidmət axtar' })
    for (const b of solidPills) expect(b.closest('[inert]')).toBeNull()
    expect(solidPills[0].parentElement).not.toHaveClass('opacity-0')
  })
})

describe('header on pages without a hero', () => {
  it('is solid from the start and never hides, whichever way the page scrolls', async () => {
    renderPage({ hero: false })
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(header()).toHaveAttribute('data-placement', 'sticky')
    expect(header()).not.toHaveAttribute('data-over-hero')
    expect(header()).toHaveClass('sticky', 'top-0')
    for (const y of [400, 700, 1400, 1390, 2600, 100]) {
      await scrollTo(y)
      expect(header()).not.toHaveAttribute('inert')
      expect(header()).not.toHaveAttribute('aria-hidden')
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

describe('profile menu (signed in)', () => {
  beforeEach(() =>
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ id: 'u-elvin', fullName: 'Elvin Əliyev', email: 'e@x.az', phone: '+994 50 555 12 34', accountType: 'business' }),
    ),
  )
  afterEach(() => localStorage.clear())

  const avatarLink = () => screen.getByRole('link', { name: 'Şəxsi kabinet' })
  const chevron = () => screen.getByRole('button', { name: 'Hesab menyusu' })
  const panel = () => screen.getByRole('group', { name: 'Elvin Əliyev' })
  const capsuleArea = () => chevron().closest<HTMLElement>('.relative.shrink-0')!

  it("shows the initials avatar in place of the name and «Çıxış», linking to the cabinet", () => {
    renderPage({ hero: false })
    expect(avatarLink()).toHaveAttribute('href', '/kabinet')
    expect(avatarLink()).toHaveTextContent('EƏ')
    expect(screen.queryByText('Elvin Əliyev')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Çıxış' })).toBeNull()
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    // Two separate controls: the link holds no button and the button sits in no link.
    expect(avatarLink().querySelector('button')).toBeNull()
    expect(chevron().closest('a')).toBeNull()
  })

  it('opens from the chevron with the full name and «Çıxış», and closes on a second click or a press outside', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    expect(chevron()).toHaveAttribute('aria-controls', panel().id)
    expect(within(panel()).getByText('Elvin Əliyev')).toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'Çıxış' })).toBeInTheDocument()

    await user.click(chevron())
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    await user.click(chevron())
    await user.click(document.body)
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it('works from the keyboard: Enter opens, Tab reaches the profile row and «Çıxış», Esc closes and returns focus to the chevron', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    act(() => avatarLink().focus())
    await user.tab()
    expect(chevron()).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    await user.tab()
    expect(within(panel()).getByRole('link', { name: 'Elvin Əliyev' })).toHaveFocus()
    await user.tab()
    expect(within(panel()).getByRole('button', { name: 'Çıxış' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
    expect(chevron()).toHaveFocus()
  })

  it('closes when focus tabs out of it', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.click(chevron())
    await user.tab() // the profile row
    await user.tab() // «Çıxış»
    await user.tab() // «Elan yerləşdir»
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on mouse hover, stays open over the panel, and closes once the pointer has left both', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.hover(avatarLink())
    await waitFor(() => expect(chevron()).toHaveAttribute('aria-expanded', 'true'))
    await user.hover(within(panel()).getByRole('button', { name: 'Çıxış' }))
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
    await user.unhover(capsuleArea())
    await waitFor(() => expect(chevron()).toHaveAttribute('aria-expanded', 'false'))
  })

  it('keeps a hover-opened menu open once the chevron is clicked', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.hover(chevron())
    await waitFor(() => expect(chevron()).toHaveAttribute('aria-expanded', 'true'))
    await user.click(chevron())
    await user.unhover(capsuleArea())
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(chevron()).toHaveAttribute('aria-expanded', 'true')
  })

  it('leads to the cabinet from the whole profile row (avatar and full name), closing the menu', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.click(chevron())
    const row = within(panel()).getByRole('link', { name: 'Elvin Əliyev' })
    expect(row).toHaveAttribute('href', '/kabinet')
    expect(row).toHaveTextContent('EƏElvin Əliyev') // the small avatar is inside the link
    expect(row).toHaveClass('cursor-pointer', 'hover:bg-mint')
    await user.click(row)
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not open on a touch pointer passing over (a tap on the avatar just opens the cabinet)', async () => {
    renderPage({ hero: false })
    fireEvent.pointerOver(avatarLink(), { pointerType: 'touch' })
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(chevron()).toHaveAttribute('aria-expanded', 'false')
  })

  it('signs out with «Çıxış»: the guest header comes back', async () => {
    const user = userEvent.setup()
    renderPage({ hero: false })
    await user.click(chevron())
    await user.click(within(panel()).getByRole('button', { name: 'Çıxış' }))
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Şəxsi kabinet' })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Daxil ol' }).length).toBeGreaterThan(0)
  })

  it('turns glassy over the home hero with the same forest avatar; the panel stays plain', async () => {
    const user = userEvent.setup()
    const { container } = renderPage({ hero: true })
    const { transparent } = homeHeaders(container)
    const avatar = within(transparent).getByRole('link', { name: 'Şəxsi kabinet' }).firstElementChild!
    expect(avatar).toHaveClass('bg-forest', 'text-white', 'inline-flex', 'items-center', 'justify-center', 'rounded-full', 'size-9')
    expect(avatar.getAttribute('class')).not.toMatch(/over-hero:/)
    expect(within(transparent).getByRole('button', { name: 'Hesab menyusu' })).toHaveClass('over-hero:text-white')
    await user.click(within(transparent).getByRole('button', { name: 'Hesab menyusu' }))
    for (const el of within(transparent).getByRole('group', { name: 'Elvin Əliyev' }).querySelectorAll('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/over-hero:/)
    }
  })

  it('offers «İdarəetmə» to moderators and admins only, in the menu and the phone drawer (Nov 2026)', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage({ hero: false })
    await user.click(chevron())
    expect(within(panel()).queryByRole('link', { name: 'İdarəetmə' })).toBeNull()
    unmount()

    const stored = JSON.parse(localStorage.getItem(SESSION_KEY)!)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...stored, role: 'admin' }))
    renderPage({ hero: false })
    await user.click(chevron())
    expect(within(panel()).getByRole('link', { name: 'İdarəetmə' })).toHaveAttribute('href', '/idareetme')
    await user.click(screen.getAllByRole('button', { name: 'Menyu' })[0])
    expect(within(screen.getByRole('navigation', { name: 'Əsas menyu' })).getByRole('link', { name: 'İdarəetmə' })).toHaveAttribute('href', '/idareetme')
  })
})
