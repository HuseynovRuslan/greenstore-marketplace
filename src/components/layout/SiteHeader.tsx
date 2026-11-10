'use client'

import { useRef, useState, type FocusEvent as ReactFocusEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Heart, LogOut, Menu, Plus, Rocket, Search, UserRound, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/state/store'
import { preHydrationClass } from '@/state/bootstrap'
import { useHydrated } from './ClientGate'
import { cn } from '@/lib/format'
import { useOverHero, usePageScrolled, useScrolledPast } from '@/hooks/useHeaderState'
import { HERO_ID, HERO_QUERY_ID, HERO_SEARCH_ID } from '@/features/home/ids'

const sectionLinks = [
  { label: 'Kateqoriyalar', to: '/#kateqoriyalar' },
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Satıcılar', to: '/saticilar' },
]

const searchPlaceholder = 'Bitki, ağac və ya xidmət axtar'

/** Home header nav (Variant 2); "Önə çıxanlar" follows with its olive rocket. `section` marks the current page. */
const homeNav = [
  { label: 'Məhsullar', to: '/elanlar', section: (path: string) => path === '/elanlar' || path.startsWith('/kateqoriyalar/') },
  { label: 'Xidmətlər', to: '/xidmetler', section: (path: string) => path === '/xidmetler' },
  { label: 'Satıcılar', to: '/saticilar', section: (path: string) => path === '/saticilar' || path.startsWith('/saticilar/') },
]

/* `over-hero:` (index.css) styles the transparent state over the home hero photo: white text and icons. */
const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-option text-ink transition-[color,background-color,scale] duration-(--dur-fast) ease-out hover:bg-mint hover:text-forest active:scale-[0.95] motion-reduce:active:scale-100 over-hero:text-white over-hero:hover:bg-surface/15 over-hero:hover:text-white'

/**
 * Variant 2 header (docs/design/variant-2), on every public page since Nov 2026 (the first-Figma header with a
 * search bar is gone): one row, logo · nav (Məhsullar, Xidmətlər, Satıcılar, Önə çıxanlar; the current section is
 * marked) · favourites · account · «Elan yerləşdir». The nav needs 1024 px; 768–1023 px get the menu button,
 * < 768 px logo · ♡ · menu. The page's search card replaces a header search field.
 *
 * Solid white and sticky everywhere, and it never hides (since Nov 2026); a shadow once the page is scrolled. With
 * `hero` (the home page) it starts transparent over the hero photo, with white logo, nav and icons and a light
 * «Elan yerləşdir», and overlaps the hero by its own height, so no state change moves anything. Once the hero has
 * scrolled past the header's bottom edge (useOverHero), the solid header slides in from the top and stays; back over
 * the hero it fades to transparent (index.css, .gs-header). Once the page's search card has scrolled away, and on the
 * home page only in the solid state, a compact search pill takes the nav's place (an icon button below 1024 px) and
 * leads back to it. Keyboard users can still Tab to the nav links then: focusing one brings the nav back, Tab goes
 * on to the pill.
 */
export function SiteHeader({ hero = false }: { hero?: boolean }) {
  const { user, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  // The drawer and the mobile search remember the page they were opened on, so navigating closes them.
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname
  const closeMenu = () => setMenuPath(null)
  const handleSignOut = () => {
    signOut()
    closeMenu()
    router.push('/')
  }
  // The session is only known in the browser: until hydration render both variants (CSS picks one, see bootstrap.ts).
  const hydrated = useHydrated()
  const showUser = !hydrated || Boolean(user)
  const showGuest = !hydrated || !user
  const preClass = (variant: 'user' | 'guest') => (hydrated ? undefined : preHydrationClass(variant))

  const headerRef = useRef<HTMLElement>(null)
  const scrolled = usePageScrolled()
  const overHero = useOverHero(HERO_ID, headerRef, hero)
  // Re-watch on every route: each catalogue page renders its own search card.
  const heroSearchGone = useScrolledPast(HERO_SEARCH_ID, headerRef, true, pathname)
  // Over the hero its search card is still in view, so the pill waits for the solid header.
  const searchGone = heroSearchGone && !overHero
  // Whichever of nav / pill holds keyboard focus is the one shown. The nav links are always in the Tab order (a link
  // that gets focus cross-fades the nav back); the pill is reachable once the search card is gone, or while focused.
  const [focusIn, setFocusIn] = useState<'nav' | 'pill' | null>(null)
  const pill = focusIn ? focusIn === 'pill' : searchGone
  const pillReachable = searchGone || focusIn === 'pill'
  const trackFocus = (zone: 'nav' | 'pill') => ({
    onFocus: () => setFocusIn(zone),
    onBlur: (e: ReactFocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusIn(null)
    },
  })
  // Back to the hero search; the scroll follows the page's scroll-behavior (instant under reduced motion).
  const toHeroSearch = () => {
    document.getElementById(HERO_SEARCH_ID)?.scrollIntoView({ block: 'center' })
    document.getElementById(HERO_QUERY_ID)?.focus({ preventScroll: true })
  }
  // Nav ↔ pill cross-fade: the side that leaves fades and blurs out fast (--dur-fast); the side that arrives waits
  // 60 ms and comes in over --dur-base, so the two are hardly on screen together, and the 2 px blur makes what overlap
  // there is read as one change. Same curve both ways. Reduced motion: opacity only.
  const swap = (shown: boolean) =>
    cn(
      'transition-[opacity,translate,filter] ease-out motion-reduce:transition-opacity',
      shown ? 'opacity-100 delay-60 duration-(--dur-base)' : 'pointer-events-none opacity-0 blur-[2px] duration-(--dur-fast) motion-reduce:blur-none',
    )
  const pillState = cn(swap(pill), !pill && 'translate-y-1 motion-reduce:translate-y-0')
  // The cross-fade sits on a wrapper so its transition doesn't replace the button's own (colour, press).
  const pillIcon = (className?: string) => (
    <span className={cn('flex shrink-0', pillState, className)}>
      <button type="button" aria-label={searchPlaceholder} inert={!pillReachable} onClick={toHeroSearch} {...trackFocus('pill')} className={iconButton}>
        <Search aria-hidden size={21} strokeWidth={1.8} absoluteStrokeWidth />
      </button>
    </span>
  )

  // 768–1279 px: the Figma 768 header has no "Daxil ol" text, so account access is a compact icon.
  // Before hydration both session variants are rendered and CSS shows the one the browser knows (bootstrap.ts).
  const accountIcon = iconButton
  const account = (
    <>
      {showUser && (
        <Link href="/kabinet" aria-label="Şəxsi kabinet" className={cn(accountIcon, 'xl:hidden', preClass('user'))}>
          <UserRound aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
      )}
      {showGuest && (
        <Link href="/daxil-ol" aria-label="Daxil ol" className={cn(accountIcon, 'xl:hidden', preClass('guest'))}>
          <UserRound aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
      )}
      {showUser && (
        <span className={cn('hidden shrink-0 items-center gap-3 text-sm leading-[normal] whitespace-nowrap xl:inline-flex px-2', preClass('user'))}>
          <Link
            href="/kabinet"
            className={cn('text-forest hover:text-olive-text over-hero:text-white over-hero:hover:text-mint', !hydrated && 'auth-user-name')}
          >
            {hydrated ? user?.fullName : null}
          </Link>
          <button type="button" onClick={handleSignOut} className="text-muted hover:text-forest over-hero:text-mint over-hero:hover:text-white">
            Çıxış
          </button>
        </span>
      )}
      {showGuest && (
        <Link
          href="/daxil-ol"
          className={cn(
            'hidden h-11 shrink-0 items-center px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-ink transition-colors duration-(--dur-fast) hover:text-forest xl:flex over-hero:text-white over-hero:hover:text-mint',
            preClass('guest'),
          )}
        >
          Daxil ol
        </Link>
      )}
    </>
  )
  const postAd = (
    // Over the photo: white with forest text, the inverse of the solid header's forest button.
    <ButtonLink
      href="/elan-yerlesdir"
      icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
      className="over-hero:bg-surface over-hero:text-forest over-hero:hover:bg-mint"
    >
      Elan yerləşdir
    </ButtonLink>
  )
  const menuButton = (className: string) => (
    <button type="button" aria-label="Menyu" aria-expanded={menuOpen} onClick={() => setMenuPath(pathname)} className={className}>
      <Menu aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
    </button>
  )
  const favorites = (
    <Link href="/secilmisler" aria-label="Seçilmişlər" className={iconButton}>
      <Heart aria-hidden size={21} strokeWidth={1.8} absoluteStrokeWidth />
    </Link>
  )

  return (
    <>
      <header
        ref={headerRef}
        data-hero={hero || undefined}
        data-over-hero={overHero || undefined}
        data-scrolled={scrolled || undefined}
        // On the home page the hero starts under the header: −58 / −76 px, the header's own height.
        className={cn('gs-header sticky top-0 z-40 w-full', hero && '-mb-[58px] md:-mb-[76px]')}
      >
        {/* ≥ 768 px: one row (76 px) */}
            <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-2 py-[15px] md:flex">
              <Logo className="mr-auto lg:mr-6 xl:mr-10 over-hero:text-white" />
              {/* The nav and the search pill share one grid cell and cross-fade, so the row never changes size. */}
              <div className="hidden min-w-0 flex-1 lg:grid">
                <nav
                  aria-label="Əsas bölmələr"
                  {...trackFocus('nav')}
                  className={cn('flex items-center gap-1 [grid-area:1/1]', swap(!pill))}
                >
                  {homeNav.map((l) => (
                    <Link
                      key={l.to}
                      href={l.to}
                      aria-current={l.section(pathname) ? 'page' : undefined}
                      className="relative flex h-11 items-center rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-ink transition-colors duration-(--dur-fast) hover:text-forest aria-[current=page]:font-semibold aria-[current=page]:text-forest aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3.5 aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-forest aria-[current=page]:after:content-[''] over-hero:text-white over-hero:hover:text-mint over-hero:aria-[current=page]:text-white over-hero:aria-[current=page]:after:bg-white"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Link
                    href="/elanlar?vip=1"
                    className="flex h-11 items-center gap-2 rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-olive-text transition-colors duration-(--dur-fast) hover:text-forest over-hero:text-white over-hero:hover:text-mint"
                  >
                    <Rocket aria-hidden size={16} strokeWidth={2} className="shrink-0 text-olive over-hero:text-mint" />
                    Önə çıxanlar
                  </Link>
                </nav>
                <div inert={!pillReachable} {...trackFocus('pill')} className={cn('flex items-center justify-center [grid-area:1/1]', pillState)}>
                  <button
                    type="button"
                    onClick={toHeroSearch}
                    className="flex h-11 w-full max-w-[400px] items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 text-[15px] leading-[normal] text-muted transition-[border-color,scale] duration-(--dur-fast) ease-out hover:border-forest active:scale-[0.98] motion-reduce:active:scale-100"
                  >
                    <Search aria-hidden size={18} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{searchPlaceholder}</span>
                  </button>
                </div>
              </div>
              {pillIcon('lg:hidden')}
              {favorites}
              {account}
              {postAd}
              {menuButton(cn(iconButton, 'lg:hidden'))}
            </div>

            {/* < 768 px: logo · (search, once the hero search is gone) · favourites · menu (58 px) */}
            <div className="flex h-[58px] items-center justify-between pr-1 pl-5 md:hidden">
              <Logo className="over-hero:text-white" />
              <div className="flex">
                {pillIcon()}
                {favorites}
                {menuButton(iconButton)}
              </div>
            </div>
      </header>

      {/* Mobile drawer menu — outside <header>, whose backdrop-filter / transform would trap a fixed element */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" onClick={closeMenu}>
          <nav
            aria-label="Əsas menyu"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-[86%] max-w-[340px] flex-col gap-6 overflow-y-auto bg-surface p-6"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" aria-label="Menyunu bağla" onClick={closeMenu} className="text-forest">
                <X aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
              </button>
            </div>
            <ul className="flex flex-col gap-2 text-[15px] text-forest">
              {[...sectionLinks, { label: 'Önə çıxanlar', to: '/elanlar?vip=1' }, { label: 'Seçilmişlər', to: '/secilmisler' }].map((l) => (
                <li key={l.label}>
                  <Link href={l.to} onClick={closeMenu} className="block rounded-lg px-3 py-3 hover:bg-mint">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={user ? '/kabinet' : '/daxil-ol'} onClick={closeMenu} className="block rounded-lg px-3 py-3 hover:bg-mint">
                  {user ? 'Şəxsi kabinet' : 'Daxil ol'}
                </Link>
              </li>
              {user && (
                <li>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-muted hover:bg-mint hover:text-forest"
                  >
                    <LogOut aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />
                    Çıxış
                  </button>
                </li>
              )}
            </ul>
            <ButtonLink href="/elan-yerlesdir" fullWidth icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
              Elan yerləşdir
            </ButtonLink>
          </nav>
        </div>
      )}
    </>
  )
}
