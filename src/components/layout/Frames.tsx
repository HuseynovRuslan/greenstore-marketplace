import type { ReactNode } from 'react'
import { SiteHeader } from './SiteHeader'
import { CompactFooter, SiteFooter } from './SiteFooter'
import { MobileNav } from './MobileNav'
import { WorkflowHeader } from './WorkflowHeader'
import { DemoBanner } from './DemoBanner'

/*
 * The four header/footer variants of the Figma file, used by the route-group layouts in src/app.
 * (Formerly src/layouts/Layouts.tsx; Next.js restores scroll and follows "#hash" links itself.)
 */

/** Home page: header with section row + full footer (Figma "Ana səhifə"). */
export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <DemoBanner />
      <SiteHeader withSections />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}

/** Inner public pages: 82 px header + "Yığcam sonluq" (search, detail, services, seller, cabinet…). */
export function MainFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <CompactFooter />
      <MobileNav />
    </div>
  )
}

/** Login / registration: header only (Figma "Daxil ol", "Qeydiyyat"). */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
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
      <main className="flex-1">{children}</main>
    </div>
  )
}

/** Moderation tools: same workflow header, signed in as the moderator from Figma ("İdarəetmə · Aysel Həsənova"). */
export function AdminFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <WorkflowHeader right={<span>İdarəetmə · Aysel Həsənova</span>} />
      <main className="flex-1">{children}</main>
    </div>
  )
}
