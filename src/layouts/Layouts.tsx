import { Outlet } from 'react-router'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { CompactFooter, SiteFooter } from '@/components/layout/SiteFooter'
import { MobileNav } from '@/components/layout/MobileNav'
import { WorkflowHeader } from '@/components/layout/WorkflowHeader'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { ScrollManager } from './ScrollManager'

/** Home page: header with section row + full footer (Figma "Ana səhifə"). */
export function HomeLayout() {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <ScrollManager />
      <DemoBanner />
      <SiteHeader withSections />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileNav />
    </div>
  )
}

/** Inner public pages: 82 px header + "Yığcam sonluq" (search, detail, services, seller, cabinet…). */
export function MainLayout() {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <ScrollManager />
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <CompactFooter />
      <MobileNav />
    </div>
  )
}

/** Login / registration: header only (Figma "Daxil ol", "Qeydiyyat"). */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col pb-[86px] md:pb-0">
      <ScrollManager />
      <DemoBanner />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}

/** Ad posting wizard and admin tools: "İş axını başlığı", no footer. */
export function WorkflowLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <DemoBanner />
      <WorkflowHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

/** Moderation tools: same workflow header, signed in as the moderator from Figma ("İdarəetmə · Aysel Həsənova"). */
export function AdminLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <DemoBanner />
      <WorkflowHeader right={<span>İdarəetmə · Aysel Həsənova</span>} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
