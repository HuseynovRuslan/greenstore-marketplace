import type { ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'
import { CompactFooter } from './CompactFooter'
import { MobileNav } from './MobileNav'
import { WorkflowHeader } from './WorkflowHeader'
import { dataSource } from '@/seo/env'
import { DemoBanner } from './DemoBanner'
import { MAIN_ID } from './ids'

/*
 * The header/footer variants of the Figma file, used by the route-group layouts in src/app. The frames with the full
 * footer live in their own modules, HomeFrame.tsx (home) and MainFrame.tsx (public inner pages), so the cabinet,
 * auth, posting and admin layouts that import this module do not pull the full footer in.
 * (Formerly src/layouts/Layouts.tsx; Next.js restores scroll and follows "#hash" links itself.)
 */

/** Target of the skip link (SkipLink.tsx). scroll-mt-24 keeps its top clear of the sticky header (58–82 px). */
export function Main({ children }: { children: ReactNode }) {
  return (
    <main id={MAIN_ID} className="flex-1 scroll-mt-24 outline-none">
      {children}
    </main>
  )
}

/**
 * The cabinet (/kabinet…), and login, registration and password reset: the Variant 2 header + "Yığcam sonluq". A
 * workspace or a form, so the footer is the one row of help and terms links, without the sellers' card and the link
 * groups that would pull the eye away from it.
 */
export function CompactFrame({ children }: { children: ReactNode }) {
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

/** Ad posting wizard: "İş axını başlığı", no footer: a step-by-step flow, like a checkout, keeps the way out small. */
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
      {/* The demo's moderator is Figma's; with the API the page names the signed-in one. */}
      <WorkflowHeader right={<span className="truncate text-sm text-ink-soft">{dataSource() === 'api' ? 'İdarəetmə' : 'İdarəetmə · Aysel Həsənova'}</span>} />
      <Main>{children}</Main>
    </div>
  )
}
