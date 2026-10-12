import type { ReactNode } from 'react'
import { preHydrationClass } from '@/state/bootstrap'

/**
 * Loading frame of a private page that looks different for guests and signed-in visitors. Both variants are in the
 * server HTML; the pre-hydration script marks <html> with the session the browser has, and CSS shows one variant
 * before the first paint (src/state/bootstrap.ts, src/styles/index.css).
 */
export function SessionFallback({ guest, user }: { guest: ReactNode; user: ReactNode }) {
  return (
    <>
      <div className={preHydrationClass('guest')}>{guest}</div>
      <div className={preHydrationClass('user')}>{user}</div>
    </>
  )
}
