import { NavLink } from 'react-router'
import { CirclePlus, Heart, House, Search, UserRound, type LucideIcon } from 'lucide-react'
import { useSession } from '@/app/store'
import { cn } from '@/lib/format'

/* Figma "Mobil naviqasiya" (390): h 86, white, top border, pt 10 / pb 16 / px 6, 22 px icons, 11 px labels.
 * Active item: #173f32 icon + bold label; others #727c72. */
export function MobileNav() {
  const { user } = useSession()
  const items: Array<{ label: string; to: string; icon: LucideIcon; end?: boolean }> = [
    { label: 'Ana səhifə', to: '/', icon: House, end: true },
    { label: 'Axtarış', to: '/elanlar', icon: Search },
    { label: 'Elan yerləşdir', to: '/elan-yerlesdir', icon: CirclePlus },
    { label: 'Seçilmişlər', to: '/secilmisler', icon: Heart },
    { label: 'Profil', to: user ? '/kabinet' : '/daxil-ol', icon: UserRound },
  ]
  return (
    <nav
      aria-label="Mobil naviqasiya"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[86px] items-start border-t border-line bg-surface px-1.5 pt-2.5 pb-4 md:hidden"
    >
      {items.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn('flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-[11px] leading-[normal]', isActive ? 'font-bold text-forest' : 'text-muted')
          }
        >
          <Icon aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
          <span className="w-full truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
