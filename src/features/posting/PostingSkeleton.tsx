import { SkeletonBlock as Skeleton } from '@/components/ui/Skeleton'

/** Server HTML of the posting flow while the draft (browser storage) loads: the step header, progress and form box. */
export function PostingSkeleton() {
  return (
    <div aria-busy className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-16 md:gap-8 md:pt-8">
      <span className="sr-only">Yüklənir…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="grid grid-cols-6 gap-1.5 pt-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-1.5 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex h-[420px] flex-col gap-4 rounded-2xl border border-line bg-surface p-5 md:p-7">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-[300px] rounded-xl max-lg:hidden" />
      </div>
    </div>
  )
}
