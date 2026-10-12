import { Link, useLocation, useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { useSession } from '@/app/store'
import { pillClass } from './pill'

export type AccountTab = 'listings' | 'favorites' | 'profile'

const tabs: Array<{ key: AccountTab | 'stats'; label: string; to: string }> = [
  { key: 'listings', label: 'Elanlarım', to: '/kabinet' },
  { key: 'favorites', label: 'Seçilmişlər', to: '/secilmisler' },
  { key: 'profile', label: 'Profil məlumatları', to: '/kabinet/profil' },
  { key: 'stats', label: 'Elan statistikası', to: '/kabinet#statistika' },
]

export const STATS_ANCHOR = 'statistika'

/**
 * Figma "Bölmə seçimləri" under the cabinet headings (Şəxsi kabinet / Profil məlumatları / Seçilmişlər).
 * "Elan statistikası" scrolls to the statistics panel on the dashboard. "Çıxış" (sign out) is not in Figma;
 * it sits quietly at the end of the row.
 */
export function AccountTabs({ active }: { active: AccountTab }) {
  const { signOut } = useSession()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav aria-label="Şəxsi kabinet" className="flex w-full flex-wrap items-start gap-2">
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            to={t.to}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => {
              // Same-page anchor: the router does not re-run the hash scroll when the hash is unchanged.
              if (t.key === 'stats' && pathname === '/kabinet') {
                document.getElementById(STATS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            className={pillClass(isActive)}
          >
            {t.label}
          </Link>
        )
      })}
      <button
        type="button"
        onClick={() => {
          signOut()
          navigate('/')
        }}
        className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] leading-[normal] whitespace-nowrap text-muted transition-colors hover:bg-mint hover:text-forest"
      >
        <LogOut aria-hidden size={16} strokeWidth={1.8} absoluteStrokeWidth />
        Çıxış
      </button>
    </nav>
  )
}
