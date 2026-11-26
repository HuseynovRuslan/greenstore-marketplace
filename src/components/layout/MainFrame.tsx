import type { ReactNode } from 'react'
import { DemoBanner } from './DemoBanner'
import { Main } from './Frames'
import { MobileNav } from './MobileNav'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

/**
 * Public inner pages (catalogue, listing, seller, services, help, contact, terms, favourites, the 404 page): the
 * Variant 2 header and the full footer of the home page, so the sections, the sellers' card and the social profiles
 * are one scroll away on every public page (Nov 2026 decision). Its own module, apart from Frames.tsx, which the
 * login, cabinet, posting and admin layouts import: they keep the compact footer or none (docs/handoff/footer.md).
 * Cost against the compact footer: 1–7 KB gzip of JS and 4–5 KB gzip of HTML per page.
 */
export function MainFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <DemoBanner />
      <SiteHeader />
      <Main>{children}</Main>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}
