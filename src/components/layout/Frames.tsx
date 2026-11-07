import type { ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'
import { CompactFooter, SiteFooter } from './SiteFooter'
import { MobileNav } from './MobileNav'
import { WorkflowHeader } from './WorkflowHeader'
import { DemoBanner } from './DemoBanner'
import { MAIN_ID } from './ids'

/*
 * The four header/footer variants of the Figma file, used by the route-group layouts in src/app.
 * (Formerly src/layouts/Layouts.tsx; Next.js restores scroll and follows "#hash" links itself.)
 */

/** Target of the skip link (SkipLink.tsx). scroll-mt-24 keeps its top clear of the sticky header (58–82 px). */
function Main({ children }: { children: ReactNode }) {
  return (
    <main id={MAIN_ID} className="flex-1 scroll-mt-24 outline-none">
      {children}
    </main>
  )
}

/** Home page: the one-row home header (Variant 2) + full footer (Figma "Ana səhifə"). */
export function HomeFrame({ children }: { children: ReactNode }) {
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

/**
 * Inner public pages (catalogue, listing, seller, services, favourites, cabinet…): the same Variant 2 header as the
 * home page, so the main sections are one click away everywhere, + "Yığcam sonluq".
 */
export function MainFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <DemoBanner />
      <SiteHeader />
      <Main>{children}</Main>
      <CompactFooter />
      <MobileNav />
    </div>
  )
}

/** Login / registration / password reset: the Variant 2 header, no footer. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(86px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <DemoBanner />
      <SiteHeader />
      <Main>{children}</Main>
      <MobileNav />
    </div>
  )
}

/** Ad posting wizard: "İş axını başlığı", no footer. */
export function WorkflowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <WorkflowHeader />
      <Main>{children}</Main>
    </div>
  )
}

/** Moderation tools: same workflow header, signed in as the moderator from Figma ("İdarəetmə · Aysel Həsənova"). */
export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <WorkflowHeader right={<span className="truncate text-sm text-ink-soft">İdarəetmə · Aysel Həsənova</span>} />
      <Main>{children}</Main>
    </div>
  )
}
