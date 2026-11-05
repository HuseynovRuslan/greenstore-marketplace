'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Heart, LogOut, Menu, Plus, Search, UserRound, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/state/store'
import { preHydrationClass } from '@/state/bootstrap'
import { useHydrated } from './ClientGate'
import { cn } from '@/lib/format'

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
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      className={cn(
        'h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted',
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

/** Home header nav (Variant 2); "Bağ vitrini" follows with its olive dot. */
const homeNav = [
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Satıcılar', to: '/#saticilar' },
]

const iconButton =
  'flex size-11 shrink-0 items-center justify-center rounded-option text-ink transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest'

/**
 * Figma "Başlıq naviqasiyası".
 *  - `default`: logo · search · favourites · account · «Elan yerləşdir»; < 768 px a compact bar (logo · search · menu).
 *  - `home` (docs/design/variant-2): one row, logo · nav (Məhsullar, Xidmətlər, Satıcılar, Bağ vitrini) · favourites ·
 *    account · «Elan yerləşdir». The nav needs 1024 px; 768–1023 px get the menu button, < 768 px logo · ♡ · menu.
 *    The hero search replaces the header search there.
 */
export function SiteHeader({ variant = 'default' }: { variant?: 'default' | 'home' }) {
  const home = variant === 'home'
  const { user, signOut } = useSession()
  const router = useRouter()
  const pathname = usePathname()
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
    <header className="sticky top-0 z-40 w-full bg-surface shadow-[inset_0_-1px_0_var(--color-line)]">
      {home ? (
        <>
          {/* Home: one row (76 px) */}
          <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-2 py-[15px] md:flex">
            <Logo className="mr-auto lg:mr-6 xl:mr-10" />
            <nav aria-label="Əsas bölmələr" className="hidden flex-1 items-center gap-1 lg:flex">
              {homeNav.map((l) => (
                <Link
                  key={l.to}
                  href={l.to}
                  className="flex h-11 items-center rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-ink transition-colors duration-(--dur-fast) hover:text-forest"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/elanlar?vip=1"
                className="flex h-11 items-center gap-2 rounded-option px-3.5 text-[15px] leading-[normal] font-medium whitespace-nowrap text-olive-text transition-colors duration-(--dur-fast) hover:text-forest"
              >
                <span aria-hidden className="size-[7px] rounded-full bg-olive" />
                Bağ vitrini
              </Link>
            </nav>
            {favorites}
            {account}
            {postAd}
            {menuButton(cn(iconButton, 'lg:hidden'))}
          </div>

          {/* Home, < 768 px: logo · favourites · menu (58 px) */}
          <div className="flex h-[58px] items-center justify-between pr-1 pl-5 md:hidden">
            <Logo />
            <div className="flex">
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

      {/* Mobile drawer menu */}
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
              {[...sectionLinks, { label: 'Bağ vitrini', to: '/elanlar?vip=1' }, { label: 'Seçilmişlər', to: '/secilmisler' }].map((l) => (
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
    </header>
  )
}
