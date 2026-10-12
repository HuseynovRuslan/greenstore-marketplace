'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useSession } from '@/state/store'
import { preHydrationClass } from '@/state/bootstrap'
import { useHydrated } from './ClientGate'

/* Figma "İş axını başlığı" (Elan yerləşdir / İdarəetmə): white, bottom border, px 64 py 24, 25 px wordmark, 14 px account link */
export function WorkflowHeader({ right }: { right?: ReactNode }) {
  const { user } = useSession()
  const hydrated = useHydrated()
  return (
    <header className="w-full bg-surface text-forest shadow-[inset_0_-1px_0_var(--color-line)]">
      <div className="page-x mx-auto flex w-full max-w-[1440px] items-start justify-between gap-4 py-6 leading-[normal] whitespace-nowrap">
        <Link href="/" className="text-[22px] md:text-[25px]">
          GreenStore
        </Link>
        <div className="truncate pt-1.5 text-sm md:pt-[9px]">
          {right ??
            (hydrated ? (
              <Link href={user ? '/kabinet' : '/daxil-ol'} className="hover:text-olive">
                {user ? `${user.fullName} · Şəxsi kabinet` : 'Daxil ol'}
              </Link>
            ) : (
              // Before hydration: both variants, CSS shows the one the browser knows (src/state/bootstrap.ts).
              <>
                <Link href="/kabinet" className={`hover:text-olive ${preHydrationClass('user')}`}>
                  <span className="auth-user-name" /> · Şəxsi kabinet
                </Link>
                <Link href="/daxil-ol" className={`hover:text-olive ${preHydrationClass('guest')}`}>
                  Daxil ol
                </Link>
              </>
            ))}
        </div>
      </div>
    </header>
  )
}
