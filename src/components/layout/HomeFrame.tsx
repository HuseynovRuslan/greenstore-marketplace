import type { ReactNode } from 'react'
import { DemoBanner } from './DemoBanner'
import { Main } from './Frames'
import { HomeHeader } from './HomeHeader'
import { MobileNav } from './MobileNav'
import { SiteFooter } from './SiteFooter'

/**
 * Home page: the one-row home header (Variant 2) — transparent at the top of the hero, solid once the hero has
 * scrolled past (HomeHeader) — + full footer (Figma "Ana səhifə", footer direction A). The positioned wrapper starts
 * where the hero does, right under the demo banner, so the transparent header's `top: 0` is the hero's top. Apart
 * from Frames.tsx, which the cabinet, login, posting and admin layouts import (the public inner pages have the full
 * footer too: MainFrame.tsx).
 */
export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <DemoBanner />
      <div className="relative flex flex-1 flex-col">
        <HomeHeader />
        <Main>{children}</Main>
      </div>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}
