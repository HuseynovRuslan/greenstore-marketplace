import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Heart, Menu, Plus, Search, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { useSession } from '@/app/store'
import { cn } from '@/lib/format'

const sectionLinks = [
  { label: 'Kateqoriyalar', to: '/#kateqoriyalar' },
  { label: 'Məhsullar', to: '/elanlar' },
  { label: 'Xidmətlər', to: '/xidmetler' },
  { label: 'Satıcılar', to: '/#saticilar' },
]

/** Header search: follows `?q=` on the catalogue pages and searches services while you are in /xidmetler. */
function useHeaderSearch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const target = pathname.startsWith('/xidmetler') ? '/xidmetler' : '/elanlar'
  const urlQuery = pathname === target ? (params.get('q') ?? '') : ''
  const [query, setQuery] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setQuery(urlQuery)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `${target}?q=${encodeURIComponent(q)}` : target)
  }
  return { query, setQuery, submit }
}

/**
 * Figma "Başlıq naviqasiyası".
 *  - `withSections` adds the second row ("Bölmələr") used on the home page (1440/768).
 *  - < 768 px: compact bar (logo · search · menu) from "Ana səhifə · 390".
 */
export function SiteHeader({ withSections = false }: { withSections?: boolean }) {
  const { user } = useSession()
  const { query, setQuery, submit } = useHeaderSearch()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    setMobileSearch(false)
  }, [location.pathname, location.search])

  return (
    <header className="sticky top-0 z-40 w-full bg-surface shadow-[inset_0_-1px_0_var(--color-line)]">
      {/* Desktop / tablet main row */}
      <div className="page-x mx-auto hidden w-full max-w-[1440px] items-center gap-[18px] py-[18px] md:flex">
        <Logo />
        <form role="search" onSubmit={submit} className="flex h-[46px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
          <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bitki, ağac və ya xidmət axtar"
            aria-label="Bitki, ağac və ya xidmət axtar"
            className="h-full min-w-0 flex-1 bg-transparent text-sm leading-[normal] text-ink outline-none placeholder:text-muted"
          />
        </form>
        <Link to="/secilmisler" aria-label="Seçilmişlər" className="shrink-0 text-forest hover:text-olive">
          <Heart aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
        {user ? (
          <Link to="/kabinet" className="hidden shrink-0 text-sm leading-[normal] whitespace-nowrap text-forest hover:text-olive xl:inline">
            {user.fullName}
          </Link>
        ) : (
          <Link to="/daxil-ol" className="hidden shrink-0 text-sm leading-[normal] whitespace-nowrap text-forest hover:text-olive xl:inline">
            Daxil ol
          </Link>
        )}
        <ButtonLink to="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
          Elan yerləşdir
        </ButtonLink>
      </div>

      {/* Second row ("Bölmələr") — home page only */}
      {withSections && (
        <nav aria-label="Bölmələr" className="page-x mx-auto hidden w-full max-w-[1440px] items-start py-3 text-[13px] leading-[normal] text-forest md:flex">
          <ul className="flex items-start gap-[18px] whitespace-nowrap">
            {sectionLinks.map((l, i) => (
              <li key={l.label}>
                <Link to={l.to} className={cn('hover:text-olive', i === 0 && 'font-semibold')}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/elanlar?vip=1" className="text-olive hover:text-forest">
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
          <button type="button" aria-label="Axtarış" aria-expanded={mobileSearch} onClick={() => setMobileSearch((v) => !v)} className="text-forest">
            <Search aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
          <button type="button" aria-label="Menyu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="text-forest">
            <Menu aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
        </div>
      </div>
      {mobileSearch && (
        <form role="search" onSubmit={submit} className="flex items-center gap-2.5 border-t border-line px-5 py-3 md:hidden">
          <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-lg border border-line bg-cream px-3 focus-within:border-olive">
            <Search aria-hidden size={20} strokeWidth={1} absoluteStrokeWidth className="shrink-0 text-forest" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Bitki, ağac və ya xidmət axtar"
              aria-label="Bitki, ağac və ya xidmət axtar"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
          </div>
        </form>
      )}

      {/* Mobile drawer menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 md:hidden" onClick={() => setMenuOpen(false)}>
          <nav
            aria-label="Əsas menyu"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-[86%] max-w-[340px] flex-col gap-6 overflow-y-auto bg-surface p-6"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button type="button" aria-label="Menyunu bağla" onClick={() => setMenuOpen(false)} className="text-forest">
                <X aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
              </button>
            </div>
            <ul className="flex flex-col gap-2 text-[15px] text-forest">
              {[...sectionLinks, { label: 'VIP elanlar', to: '/elanlar?vip=1' }, { label: 'Seçilmişlər', to: '/secilmisler' }].map((l) => (
                <li key={l.label}>
                  <NavLink to={l.to} className="block rounded-lg px-3 py-3 hover:bg-mint">
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <NavLink to={user ? '/kabinet' : '/daxil-ol'} className="block rounded-lg px-3 py-3 hover:bg-mint">
                  {user ? 'Şəxsi kabinet' : 'Daxil ol'}
                </NavLink>
              </li>
            </ul>
            <ButtonLink to="/elan-yerlesdir" fullWidth icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
              Elan yerləşdir
            </ButtonLink>
          </nav>
        </div>
      )}
    </header>
  )
}
