'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Heart, LogOut, Menu, Plus, Search, UserRound, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/state/store'
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
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const target = searchTarget(pathname)
    const q = query.trim()
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target)
    onSubmitted?.()
  }
  const input = (
    <input
      autoFocus={variant === 'mobile'}
      type="search"
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
      <form role="search" onSubmit={submit} className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
        <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
        {input}
      </form>
    )
  }
  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-2.5 border-t border-line px-5 py-3 md:hidden">
      <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
        <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
        {input}
      </div>
    </form>
  )
}

/**
 * Figma "Başlıq naviqasiyası".
 *  - `withSections` adds the second row ("Bölmələr") used on the home page (1440/768).
 *  - < 768 px: compact bar (logo · search · menu) from "Ana səhifə · 390".
 */
export function SiteHeader({ withSections = false }: { withSections?: boolean }) {
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

  return (
    <header className="sticky top-0 z-40 w-full bg-surface shadow-[inset_0_-1px_0_var(--color-line)]">
      {/* Desktop / tablet main row */}
      <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-[18px] py-[18px] md:flex">
        <Logo />
        <HeaderSearch variant="bar" />
        <Link href="/secilmisler" aria-label="Seçilmişlər" className="shrink-0 text-forest hover:text-olive">
          <Heart aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
        {/* 768–1279 px: the Figma 768 header has no "Daxil ol" text, so account access is a compact icon. */}
        <Link
          href={user ? '/kabinet' : '/daxil-ol'}
          aria-label={user ? 'Şəxsi kabinet' : 'Daxil ol'}
          className="shrink-0 text-forest hover:text-olive xl:hidden"
        >
          <UserRound aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
        {user ? (
          <span className="hidden shrink-0 items-center gap-3 text-sm leading-[normal] whitespace-nowrap xl:inline-flex">
            <Link href="/kabinet" className="text-forest hover:text-olive">
              {user.fullName}
            </Link>
            <button type="button" onClick={handleSignOut} className="text-muted hover:text-forest">
              Çıxış
            </button>
          </span>
        ) : (
          <Link href="/daxil-ol" className="hidden shrink-0 text-sm leading-[normal] whitespace-nowrap text-forest hover:text-olive xl:inline">
            Daxil ol
          </Link>
        )}
        <ButtonLink href="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
          Elan yerləşdir
        </ButtonLink>
      </div>

      {/* Second row ("Bölmələr") — home page only */}
      {withSections && (
        <nav aria-label="Bölmələr" className="page-x mx-auto hidden w-full max-w-[1440px] items-start py-3 text-[13px] leading-[normal] text-forest md:flex">
          <ul className="flex items-start gap-[18px] whitespace-nowrap">
            {sectionLinks.map((l, i) => (
              <li key={l.label}>
                <Link href={l.to} className={cn('hover:text-olive', i === 0 && 'font-semibold')}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/elanlar?vip=1" className="text-olive hover:text-forest">
                VIP elanlar
              </Link>
            </li>
          </ul>
          <p className="ml-9 hidden whitespace-nowrap xl:block">Azərbaycanda bağınız üçün hər şey</p>
        </nav>
      )}

      {/* Mobile bar */}
      <div className="flex items-center gap-3 px-5 py-[18px] md:hidden">
        <Logo />
        <div className="flex flex-1 items-center justify-between">
          <button type="button" aria-label="Axtarış" aria-expanded={mobileSearch} onClick={() => setSearchPath(mobileSearch ? null : pathname)} className="text-forest">
            <Search aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
          <button type="button" aria-label="Menyu" aria-expanded={menuOpen} onClick={() => setMenuPath(pathname)} className="text-forest">
            <Menu aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
        </div>
      </div>
      {mobileSearch && <HeaderSearch variant="mobile" onSubmitted={() => setSearchPath(null)} />}

      {/* Mobile drawer menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 md:hidden" onClick={closeMenu}>
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
              {[...sectionLinks, { label: 'VIP elanlar', to: '/elanlar?vip=1' }, { label: 'Seçilmişlər', to: '/secilmisler' }].map((l) => (
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
