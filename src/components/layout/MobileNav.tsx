'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CirclePlus, Heart, House, Search, UserRound, type LucideIcon } from 'lucide-react'
import { useSession } from '@/state/store'
import { preHydrationClass } from '@/state/bootstrap'
import { useHydrated } from './ClientGate'
import { cn } from '@/lib/format'

/** Same matching as a non-`end` NavLink: the path itself or anything below it. */
function isWithin(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

/* Figma "Mobil naviqasiya" (390): h 86, white, top border, pt 10 / pb 16 / px 6, 22 px icons, 11 px labels.
 * Active item: #173f32 icon + bold label; others #727c72. */
export function MobileNav() {
  const { user } = useSession()
  const pathname = usePathname()
  const hydrated = useHydrated()
  type Item = { label: string; to: string; icon: LucideIcon; end?: boolean; also?: string[]; preHydration?: 'user' | 'guest' }
  // Before hydration the session is unknown to React: render both "Profil" targets, CSS shows one (bootstrap.ts).
  const profile: Item[] = hydrated
    ? [{ label: 'Profil', to: user ? '/kabinet' : '/daxil-ol', icon: UserRound }]
    : [
        { label: 'Profil', to: '/kabinet', icon: UserRound, preHydration: 'user' },
        { label: 'Profil', to: '/daxil-ol', icon: UserRound, preHydration: 'guest' },
      ]
  const items: Item[] = [
    { label: 'Ana səhifə', to: '/', icon: House, end: true },
    { label: 'Axtarış', to: '/elanlar', icon: Search, also: ['/kateqoriyalar'] },
    { label: 'Elan yerləşdir', to: '/elan-yerlesdir', icon: CirclePlus },
    { label: 'Seçilmişlər', to: '/secilmisler', icon: Heart },
    ...profile,
  ]
  return (
    <nav
      aria-label="Mobil naviqasiya"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[86px] items-start border-t border-line bg-surface px-1.5 pt-2.5 pb-4 md:hidden"
    >
      {items.map(({ label, to, icon: Icon, end, also = [], preHydration }) => {
        const isActive = end ? pathname === to : [to, ...also].some((p) => isWithin(pathname, p))
        return (
          <Link
            key={`${label}-${to}`}
            href={to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-[11px] leading-[normal]',
              isActive ? 'font-bold text-forest' : 'text-muted',
              preHydration && preHydrationClass(preHydration),
            )}
          >
            <Icon aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
            <span className="w-full truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
