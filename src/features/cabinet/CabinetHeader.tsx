'use client'

import { useRouter } from 'next/navigation'
import { BadgeCheck, LogOut, Plus } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { UnderlineTabs } from '@/components/ui/UnderlineTabs'
import { useAccount, firstName } from '@/features/account/useAccount'

export type CabinetSection = 'listings' | 'favorites' | 'searches' | 'profile'

const sections: Array<{ key: CabinetSection; label: string; href: string }> = [
  { key: 'listings', label: 'Elanlarım', href: '/kabinet' },
  { key: 'favorites', label: 'Seçilmişlər', href: '/secilmisler' },
  { key: 'searches', label: 'Axtarışlarım', href: '/kabinet/axtarislar' },
  { key: 'profile', label: 'Profil', href: '/kabinet/profil' },
]

/**
 * Top of every cabinet page: greeting, account line (business name, verified), «Elan yerləşdir», the section tabs
 * and «Çıxış» (kept apart from the tabs: signing out is not a section).
 */
export function CabinetHeader({ active, counts }: { active: CabinetSection; counts?: Partial<Record<CabinetSection, number>> }) {
  const { account, signOut } = useAccount()
  const router = useRouter()
  if (!account) return null
  const business = account.accountType === 'business'
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[30px]">Salam, {firstName(account.fullName)}!</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-sm leading-[1.4] text-ink-soft">
            {business ? (account.companyName ?? 'Biznes hesabı') : 'Fərdi hesab'}
            {business && account.verified && (
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <BadgeCheck aria-hidden size={15} strokeWidth={2} />
                Təsdiqlənmiş biznes
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              signOut()
              router.push('/')
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm leading-[normal] font-medium text-muted transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest"
          >
            <LogOut aria-hidden size={16} strokeWidth={1.8} />
            Çıxış
          </button>
          <ButtonLink href="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} />} className="max-sm:hidden">
            Elan yerləşdir
          </ButtonLink>
        </div>
      </div>
      <UnderlineTabs
        label="Şəxsi kabinet"
        tabs={sections.map((s) => ({ key: s.key, label: s.label, href: s.href, active: s.key === active, count: counts?.[s.key] }))}
      />
    </header>
  )
}
