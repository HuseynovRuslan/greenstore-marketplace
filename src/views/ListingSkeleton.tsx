import { LoadingFrame, SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'
import { InfoNotice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { SectionHeader } from '@/components/ui/SectionHeader'

/**
 * Listing page placeholder (owner preview while the browser's session and listings load). Mirrors ListingDetail:
 * breadcrumb, status notice, badges, heading, gallery with the price and seller panels, details row.
 */
export function ListingSkeleton() {
  return (
    <LoadingFrame>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-6 pb-9 md:pt-9 xl:pt-[51px]">
        <p className="w-full text-xs leading-[1.5]">
          <SkeletonText className="w-[22em]" />
        </p>
        <SkeletonBlock className="h-[100px] w-full md:h-[79px]" />
        <SkeletonBlock className="h-[25px] w-[96px] rounded-[5px]" />
        <SectionHeader as="h1" title={<SkeletonText className="w-[10em]" />} subtitle={<SkeletonText className="w-[22em]" />} />
        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <SkeletonBlock className="h-[436px] w-full min-w-0 md:h-[656px] xl:h-[772px] xl:flex-1" />
          <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 xl:flex xl:w-[358px] xl:shrink-0 xl:flex-col">
            <Panel>
              <SkeletonBlock className="h-[123px] w-full" />
            </Panel>
            <Panel>
              <SkeletonBlock className="h-[393px] w-full xl:h-[354px]" />
            </Panel>
          </div>
        </div>
        <div className="flex w-full flex-col items-start gap-7 xl:flex-row">
          <div className="flex w-full min-w-0 flex-col gap-6 xl:flex-1">
            <Panel className="w-full">
              <SkeletonBlock className="h-[93px] w-full" />
            </Panel>
          </div>
          <div className="flex w-full flex-col items-start gap-5 xl:w-[358px] xl:shrink-0">
            <InfoNotice title="Alışdan əvvəl dəqiqləşdirin">
              Bitkinin ölçüsünü, vəziyyətini və çatdırılma şərtlərini satıcı ilə yoxlayın. Şübhəli təkliflərə qarşı diqqətli olun.
            </InfoNotice>
            <SkeletonBlock className="h-[46px] w-[190px]" />
            <p className="w-full text-xs leading-[1.5] text-muted">GreenStore elan platformasıdır. Razılaşma alıcı və satıcı arasında edilir.</p>
          </div>
        </div>
      </div>
    </LoadingFrame>
  )
}

/** Generic placeholder for the remaining browser-rendered pages (confirmation, moderation queue). */
export function PageSkeleton() {
  return (
    <LoadingFrame>
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col items-start gap-7 pt-8 pb-10 md:pt-9 xl:pt-[51px]">
        <div className="w-full">
          <p className="text-[23px] leading-[1.35] md:text-[30px]">
            <SkeletonText className="w-[10em]" />
          </p>
          <p className="text-[15px] leading-[1.6]">
            <SkeletonText className="w-[18em]" />
          </p>
        </div>
        <SkeletonBlock className="h-[44px] w-full max-w-[520px]" />
        <SkeletonBlock className="h-[420px] w-full" />
      </div>
    </LoadingFrame>
  )
}
