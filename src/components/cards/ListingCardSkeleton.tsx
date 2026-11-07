import { SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'

/** Placeholder with ListingCard's geometry (square / 4:3 photo, price, title, details, city line). */
export function ListingCardSkeleton() {
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-xl border border-line bg-surface p-[7px] md:gap-3 md:p-[11px]">
      <SkeletonBlock className="aspect-square w-full md:aspect-[4/3]" />
      <div className="flex w-full min-w-0 flex-col gap-[3px] px-0.5 pb-0.5 md:px-1 md:pb-1">
        <p className="text-[17px] leading-[1.25] md:text-[21px]">
          <SkeletonText className="w-[3em]" />
        </p>
        <p className="text-[13px] leading-[1.35] md:text-[15px]">
          <SkeletonText className="w-4/5" />
        </p>
        <p className="text-[13px] leading-[1.4] max-md:hidden">
          <SkeletonText className="w-3/5" />
        </p>
        <p className="pt-0.5 text-xs leading-[1.4] md:text-[13px]">
          <SkeletonText className="w-2/5" />
        </p>
      </div>
    </div>
  )
}
