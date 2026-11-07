import type { ReactNode } from 'react'
import { LoadingFrame, SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'

/*
 * Server HTML of the cabinet pages while the session (browser storage) loads: the greeting, the section tabs and the
 * page's own blocks in their final sizes, so nothing jumps when the real page arrives.
 */

function CabinetFrame({ children }: { children: ReactNode }) {
  return (
    <LoadingFrame>
      <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[24px] leading-[1.2] md:text-[30px]">
              <SkeletonText className="w-[7em]" />
            </p>
            <p className="text-sm leading-[1.4]">
              <SkeletonText className="w-[12em]" />
            </p>
          </div>
          <div className="flex h-12 items-center gap-6 border-b border-line">
            {['w-[5.5em]', 'w-[5.5em]', 'w-[6.5em]', 'w-[3.5em]'].map((w, i) => (
              <SkeletonText key={i} className={w} />
            ))}
          </div>
        </div>
        {children}
      </div>
    </LoadingFrame>
  )
}

/** /kabinet — tiles and listing rows. */
export function DashboardSkeleton() {
  return (
    <CabinetFrame>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[84px] rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <SkeletonBlock key={i} className="h-[150px] rounded-xl" />
      ))}
    </CabinetFrame>
  )
}

/** /secilmisler — kind pills and a card grid. */
export function FavoritesSkeleton() {
  return (
    <CabinetFrame>
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[38px] w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBlock key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </CabinetFrame>
  )
}

/** /kabinet/profil — the form and the side column. */
export function ProfileSkeleton() {
  return (
    <CabinetFrame>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[926fr_358fr]">
        <SkeletonBlock className="h-[520px] rounded-xl" />
        <SkeletonBlock className="h-[320px] rounded-xl" />
      </div>
    </CabinetFrame>
  )
}

/** /kabinet/axtarislar — saved search cards. */
export function SavedSearchesSkeleton() {
  return (
    <CabinetFrame>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <SkeletonBlock key={i} className="h-[230px] rounded-xl" />
        ))}
      </div>
    </CabinetFrame>
  )
}
