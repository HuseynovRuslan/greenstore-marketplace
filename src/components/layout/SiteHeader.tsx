'use client'

import { Suspense, useRef, useState, type FocusEvent as ReactFocusEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Heart, LogOut, Menu, Plus, Rocket, Search, UserRound, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/state/store'
import { preHydrationClass } from '@/state/bootstrap'
import { useHydrated } from './ClientGate'
import { cn } from '@/lib/format'
import { useScrolledPast, useScrollHeader } from '@/hooks/useScrollHeader'
import { HERO_QUERY_ID, HERO_SEARCH_ID } from '@/features/home/ids'
import { QUERY_MAX } from '@/features/search/filterDefs'

const sectionLinks = [
  { label: 'Kateqoriyalar', to: '/#kateqoriyalar' },
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Satıcılar', to: '/#saticilar' },
]

const searchPlaceholder = 'Bitki, ağac və ya xidmət axtar'

function searchTarget(pathname: string) {
  return pathname.startsWith('/xidmetler') ? '/xidmetler' : '/elanlar'
}

type SearchFormProps = { variant: 'bar' | 'mobile'; onSubmitted?: () => void }

/**
 * Header search: follows `?q=` on the catalogue pages and searches services while you are in /xidmetler.
 * `useSearchParams` is isolated behind a Suspense boundary so statically rendered pages keep their server HTML;
 * the fallback is the same form with an empty field.
 */
function HeaderSearch(props: SearchFormProps) {
  return (
    <Suspense fallback={<HeaderSearchForm {...props} urlQuery="" />}>
      <HeaderSearchFromUrl {...props} />
    </Suspense>
  )
}

function HeaderSearchFromUrl(props: SearchFormProps) {
  const params = useSearchParams()
  const pathname = usePathname()
  const urlQuery = pathname === searchTarget(pathname) ? (params.get('q') ?? '') : ''
  return <HeaderSearchForm {...props} urlQuery={urlQuery} />
}

function HeaderSearchForm({ variant, urlQuery, onSubmitted }: SearchFormProps & { urlQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setQuery(urlQuery)
  }
  // Without JavaScript the form is a plain GET to the catalogue (`action` + `name="q"`); with it, `submit` navigates.
  const target = searchTarget(pathname)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target)
    onSubmitted?.()
  }
  const input = (
    <input
      autoFocus={variant === 'mobile'}
      type="search"
      name="q"
      maxLength={QUERY_MAX}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      className={cn(
        // 16 px on touch screens: iOS zooms into any field under 16 px and stays zoomed.
        'h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted pointer-coarse:text-base',
        variant === 'bar' && 'leading-[normal]',
      )}
    />
  )
  if (variant === 'bar') {
    return (
      <form role="search" action={target} method="get" onSubmit={submit} className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
        <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
        {input}
      </form>
    )
  }
  return (
    <form role="search" action={target} method="get" onSubmit={submit} className="flex items-center gap-2.5 border-t border-line px-5 py-3 md:hidden">
      <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
        <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
        {input}
      </div>
    </form>
  )
}

/** Home header nav (Variant 2); "Önə çıxanlar" follows with its olive rocket. `section` marks the current page. */
const homeNav = [
  { label: 'Məhsullar', to: '/elanlar', section: (path: string) => path === '/elanlar' || path.startsWith('/kateqoriyalar/') },
  { label: 'Xidmətlər', to: '/xidmetler', section: (path: string) => path === '/xidmetler' },
  { label: 'Satıcılar', to: '/#saticilar', section: () => false },
]

/**
 * Catalogue pages also get the home header: their own search card plays the hero search's part, so the header has
 * no search field of its own there (one search per page).
 */
export function usesHomeHeader(pathname: string) {
  return pathname === '/elanlar' || pathname === '/xidmetler' || pathname.startsWith('/kateqoriyalar/')
}

const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-option text-ink transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest'

/**
 * Figma "Başlıq naviqasiyası".
 *  - `default`: logo · search · favourites · account · «Elan yerləşdir»; < 768 px a compact bar (logo · search · menu).
 *  - `home` (docs/design/variant-2; also the catalogue pages, see usesHomeHeader): one row, logo · nav (Məhsullar,
 *    Xidmətlər, Satıcılar, Önə çıxanlar; the current section is marked) · favourites ·
 *    account · «Elan yerləşdir». The nav needs 1024 px; 768–1023 px get the menu button, < 768 px logo · ♡ · menu.
 *    The hero search replaces the header search there. On scroll (useScrollHeader) the header turns translucent with a
 *    shadow, hides while you scroll down past 320 px and comes back on any upward scroll; once the hero search has
 *    scrolled away, a compact search pill takes the nav's place (an icon button below 1024 px) and leads back to it.
 *    Keyboard users can still Tab to the nav links then: focusing one brings the nav back, Tab goes on to the pill.
 */
export function SiteHeader({ variant = 'default' }: { variant?: 'default' | 'home' }) {
  const { user, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const home = variant === 'home' || usesHomeHeader(pathname)
  // The drawer and the mobile search remember the page they were opened on, so navigating closes them.
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const [searchPath, setSearchPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname
  const mobileSearch = searchPath === pathname
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
  const { scrolled, hidden } = useScrollHeader(headerRef, { enabled: home, paused: menuOpen })
  // Re-watch on every route: each catalogue page renders its own search card.
  const heroSearchGone = useScrolledPast(HERO_SEARCH_ID, headerRef, home, pathname)
  // Whichever of nav / pill holds keyboard focus is the one shown. The nav links are always in the Tab order (a link
  // that gets focus cross-fades the nav back); the pill is reachable once the hero search is gone, or while focused.
  const [focusIn, setFocusIn] = useState<'nav' | 'pill' | null>(null)
  const pill = focusIn ? focusIn === 'pill' : heroSearchGone
  const pillReachable = heroSearchGone || focusIn === 'pill'
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
  const pillState = cn(
    'transition-[opacity,translate] duration-(--dur-base) ease-out motion-reduce:transition-opacity',
    pill ? 'opacity-100' : 'pointer-events-none translate-y-1 opacity-0 motion-reduce:translate-y-0',
  )
  const pillIcon = (className?: string) => (
    <button
      type="button"
      aria-label={searchPlaceholder}
      inert={!pillReachable}
      onClick={toHeroSearch}
      {...trackFocus('pill')}
      className={cn(iconButton, pillState, className)}
    >
      <Search aria-hidden size={21} strokeWidth={1.8} absoluteStrokeWidth />
    </button>
  )

  // 768–1279 px: the Figma 768 header has no "Daxil ol" text, so account access is a compact icon.
  // Before hydration both session variants are rendered and CSS shows the one the browser knows (bootstrap.ts).
  const accountIcon = home ? iconButton : 'shrink-0 text-forest hover:text-olive-text'
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
        <span className={cn('hidden shrink-0 items-center gap-3 text-sm leading-[normal] whitespace-nowrap xl:inline-flex', home && 'px-2', preClass('user'))}>
          <Link href="/kabinet" className={cn('text-forest hover:text-olive-text', !hydrated && 'auth-user-name')}>
            {hydrated ? user?.fullName : null}
          </Link>
          <button type="button" onClick={handleSignOut} className="text-muted hover:text-forest">
            Çıxış
          </button>
        </span>
      )}
      {showGuest && (
        <Link
          href="/daxil-ol"
          className={cn(
            'hidden shrink-0 leading-[normal] whitespace-nowrap',
            home
              ? 'h-11 items-center px-3.5 text-[15px] font-medium text-ink transition-colors duration-(--dur-fast) hover:text-forest xl:flex'
              : 'text-sm text-forest hover:text-olive-text xl:inline',
            preClass('guest'),
          )}
        >
          Daxil ol
        </Link>
      )}
    </>
  )
  const postAd = (
    <ButtonLink href="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
      Elan yerləşdir
    </ButtonLink>
  )
  const menuButton = (className: string) => (
    <button type="button" aria-label="Menyu" aria-expanded={menuOpen} onClick={() => setMenuPath(pathname)} className={className}>
      <Menu aria-hidden size={home ? 22 : 20} strokeWidth={1.8} absoluteStrokeWidth />
    </button>
  )
  const favorites = (
    <Link href="/secilmisler" aria-label="Seçilmişlər" className={home ? iconButton : 'shrink-0 text-forest hover:text-olive-text'}>
      <Heart aria-hidden size={home ? 21 : 20} strokeWidth={1.8} absoluteStrokeWidth />
    </Link>
  )

  return (
    <>
      <header
        ref={headerRef}
        data-scrolled={(home && scrolled) || undefined}
        data-hidden={(home && hidden) || undefined}
        className={cn('sticky top-0 z-40 w-full', home ? 'gs-header' : 'bg-surface shadow-[inset_0_-1px_0_var(--color-line)]')}
      >
        {home ? (
          <>
            {/* Home: one row (76 px) */}
            <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-2 py-[15px] md:flex">
              <Logo className="mr-auto lg:mr-6 xl:mr-10" />
              {/* The nav and the search pill share one grid cell and cross-fade, so the row never changes size. */}
              <div className="hidden min-w-0 flex-1 lg:grid">
                <nav
                  aria-label="Əsas bölmələr"
                  {...trackFocus('nav')}
                  className={cn('flex items-center gap-1 [grid-area:1/1] transition-opacity duration-(--dur-base)', pill && 'pointer-events-none opacity-0')}
                >
                  {homeNav.map((l) => (
                    <Link
                      key={l.to}
                      href={l.to}
                      aria-current={l.section(pathname) ? 'page' : undefined}
                      className="relative flex h-11 items-center rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-ink transition-colors duration-(--dur-fast) hover:text-forest aria-[current=page]:font-semibold aria-[current=page]:text-forest aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-3.5 aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-forest aria-[current=page]:after:content-['']"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <Link
                    href="/elanlar?vip=1"
                    className="flex h-11 items-center gap-2 rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-olive-text transition-colors duration-(--dur-fast) hover:text-forest"
                  >
                    <Rocket aria-hidden size={16} strokeWidth={2} className="shrink-0 text-olive" />
                    Önə çıxanlar
                  </Link>
                </nav>
                <div inert={!pillReachable} {...trackFocus('pill')} className={cn('flex items-center justify-center [grid-area:1/1]', pillState)}>
                  <button
                    type="button"
                    onClick={toHeroSearch}
                    className="flex h-11 w-full max-w-[400px] items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 text-[15px] leading-[normal] text-muted transition-colors duration-(--dur-fast) hover:border-forest"
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

            {/* Home, < 768 px: logo · (search, once the hero search is gone) · favourites · menu (58 px) */}
            <div className="flex h-[58px] items-center justify-between pr-1 pl-5 md:hidden">
              <Logo />
              <div className="flex">
                {pillIcon()}
                {favorites}
                {menuButton(iconButton)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Desktop / tablet main row */}
            <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-[18px] py-[18px] md:flex">
              <Logo />
              <HeaderSearch variant="bar" />
              {favorites}
              {account}
              {postAd}
            </div>

            {/* Mobile bar */}
            <div className="flex items-center gap-3 px-5 py-[18px] md:hidden">
              <Logo />
              <div className="flex flex-1 items-center justify-between">
                <button type="button" aria-label="Axtarış" aria-expanded={mobileSearch} onClick={() => setSearchPath(mobileSearch ? null : pathname)} className="text-forest">
                  <Search aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
                </button>
                {menuButton('text-forest')}
              </div>
            </div>
            {mobileSearch && <HeaderSearch variant="mobile" onSubmitted={() => setSearchPath(null)} />}
          </>
        )}
      </header>

      {/* Mobile drawer menu — outside <header>, whose backdrop-filter / transform would trap a fixed element */}
      {menuOpen && (
        <div className={cn('fixed inset-0 z-50 bg-ink/40', home ? 'lg:hidden' : 'md:hidden')} onClick={closeMenu}>
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
