import { ListingCardSkeleton } from '@/components/cards/ListingCardSkeleton'
import { LoadingFrame, SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'

/**
 * Catalogue placeholder (loading.tsx of /elanlar and the category pages), shown when the catalogue is opened from
 * another page. It has the page's geometry: breadcrumb line, search card (126 / 74 px), sidebar column from
 * 1280 px, heading, the bar below 1280 px and six cards. Filter changes on the page keep the old results instead.
 */
export function CatalogSkeleton() {
  return (
    <LoadingFrame label="Elanlar yüklənir…">
      <div className="page-x mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-4 pb-10 md:gap-5 md:pt-5 md:pb-14">
        <p className="text-xs leading-[1.5]">
          <SkeletonText className="w-[12em]" />
        </p>
        <SkeletonBlock className="h-[126px] w-full rounded-2xl md:h-[74px] md:rounded-search" />
        <div className="mt-1 flex w-full items-start gap-8 md:mt-2">
          <div className="hidden w-[256px] shrink-0 flex-col gap-2 xl:flex">
            <p className="pb-1 text-sm leading-[normal]">
              <SkeletonText className="w-[6em]" />
            </p>
            {Array.from({ length: 10 }, (_, i) => (
              <SkeletonBlock key={i} className="h-8 w-full" />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex min-h-11 items-center">
              <p className="text-[22px] leading-[1.25] md:text-[28px]">
                <SkeletonText className="w-[7em]" />
              </p>
            </div>
            <div className="py-2 xl:hidden">
              <SkeletonBlock className="h-11 w-full" />
            </div>
            <ul className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="flex">
                  <ListingCardSkeleton />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </LoadingFrame>
  )
}
