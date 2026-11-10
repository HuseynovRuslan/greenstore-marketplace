import type { ReactNode } from 'react'
import { DemoBanner } from './DemoBanner'
import { Main } from './Frames'
import { MobileNav } from './MobileNav'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

/**
 * Home page: the one-row home header (Variant 2), transparent over the hero until it has scrolled past, + full footer
 * (Figma "Ana səhifə", footer direction A). Apart from the other frames (Frames.tsx), so only the home page loads the
 * full footer's client island.
 */
export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <DemoBanner />
      <SiteHeader hero />
      <Main>{children}</Main>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}
