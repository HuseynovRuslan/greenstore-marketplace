import { Heart, Plus } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { InfoNotice, Notice } from '@/components/ui/Notice'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { LoadingFrame, SkeletonBlock, SkeletonText } from '@/components/ui/Skeleton'
import { cn } from '@/lib/format'
import { preHydrationClass } from '@/state/bootstrap'
import { AccountTabs } from './AccountTabs'
import { pillClass } from './pill'
import { AccountPage, Card } from './ui'
import { ViewsChart } from './dashboard/ViewsChart'

/*
 * Loading frames of the cabinet pages, shown until the browser's demo session and local data are read.
 * They reuse the real page frame, headings, tabs and static panels; only per-visitor values are placeholders,
 * sized like the default demo state so the page does not jump when it renders.
 */

/** Badge-shaped placeholder that keeps the width of `label`. */
function BadgeSkeleton({ label }: { label: string }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 animate-pulse items-start rounded-[5px] bg-disabled px-[9px] py-[5px] text-xs leading-[normal] font-semibold whitespace-nowrap motion-reduce:animate-none">
      <span className="invisible">{label}</span>
    </span>
  )
}

/** Status / kind filter pill with a placeholder count ("Hamısı · ▢"). */
function PillSkeleton({ label, active }: { label: string; active?: boolean }) {
  return (
    <span aria-hidden className={pillClass(Boolean(active), 'hover:bg-mint')}>
      {label} · <SkeletonText className={cn('ml-1 w-[1.3em]', active && 'bg-white/30')} />
    </span>
  )
}

/** "Şəxsi elan sətri" placeholder (MyListingRowCard geometry). */
function ListingRowSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-line bg-surface p-[17px] md:flex-row md:items-start md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5 md:gap-5">
        <SkeletonBlock className="h-[84px] w-[104px] shrink-0 md:h-[105px] md:w-[130px]" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <BadgeSkeleton label="Yoxlamada" />
          <p className="w-full text-[15px] leading-[1.5]">
            <SkeletonText className="w-3/4" />
          </p>
          {/* The meta line ("№ 10482 · Abşeron · …") wraps to two lines below 1280 px. */}
          <p className="w-full text-[13px] leading-[1.5]">
            <SkeletonText className="w-full xl:w-3/4" />
            <SkeletonText className="w-1/3 xl:hidden" />
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2.5 md:w-[220px] xl:w-[300px]">
        <p className="text-[22px] leading-[1.5]">
          <SkeletonText className="w-[3.5em]" />
        </p>
        <div className="flex w-full flex-wrap items-start gap-2">
          <SkeletonBlock className="h-[46px] w-[106px]" />
          <SkeletonBlock className="h-[46px] w-[100px]" />
        </div>
      </div>
    </div>
  )
}

/** /kabinet — "Şəxsi kabinet" while the session and the seller's listings load. */
export function DashboardSkeleton() {
  return (
    <LoadingFrame>
      <AccountPage>
        <SectionHeader as="h1" title={<SkeletonText className="w-[6.5em]" />} subtitle={<SkeletonText className="w-[17em]" />} />
        <AccountTabs active="listings" />
        <section aria-label="Hesab göstəriciləri" className="grid w-full grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {['Aktiv elanlar', 'Yoxlamada olanlar', 'Müddəti bitmiş elanlar', 'Son 30 günün baxışları'].map((label) => (
            <div key={label} className="flex min-w-0 flex-col items-start gap-5 rounded-xl border border-line bg-surface p-[19px] md:p-[23px]">
              <p className="w-full text-xs leading-[1.5] text-muted">{label}</p>
              <p className="text-[30px] leading-[1.5] font-semibold">
                <SkeletonText className="w-[1.8em]" />
              </p>
            </div>
          ))}
        </section>
        <Notice tone="warning" title="Yeni elanınız yoxlamadadır">
          <SkeletonText className="w-[16em]" /> moderasiya üçün göndərilib. Yoxlama adətən 24 saat ərzində tamamlanır.
        </Notice>
        <section className="flex w-full flex-col items-start gap-7">
          <div className="flex w-full items-start justify-between gap-4">
            <h2 className="text-[23px] leading-[1.35] font-normal text-ink">Elanlarım</h2>
            <ButtonLink href="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
              Elan yerləşdir
            </ButtonLink>
          </div>
          <div className="flex w-full flex-wrap items-start gap-2">
            <PillSkeleton label="Hamısı" active />
            <PillSkeleton label="Aktiv" />
            <PillSkeleton label="Yoxlamada" />
            <PillSkeleton label="Müddəti bitib" />
          </div>
          <div className="flex w-full flex-col gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <ListingRowSkeleton key={i} />
            ))}
          </div>
          <Button variant="secondary">
            Daha çox elan göstər
          </Button>
        </section>
        <div className="flex w-full flex-col items-start gap-6 xl:flex-row">
          <ViewsChart />
          <div className="flex w-full shrink-0 flex-col items-start xl:w-[380px]">
            <InfoNotice title="Biznes üçün daha çox imkan">
              Genişləndirilmiş satıcı profili və ətraflı statistika ilə abunə paketləri tezliklə təqdim ediləcək.
            </InfoNotice>
            <p className="w-full text-xs leading-[1.5] text-muted">VIP təşviqi yalnız seçilən elanlarda göstərilir.</p>
          </div>
        </div>
      </AccountPage>
    </LoadingFrame>
  )
}

/** Listing-card placeholder with ListingCard's geometry (145 / 210 px photo, 1.6 text lines, Figma's negative margin). */
function CardSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-2 self-start rounded-xl border border-line bg-surface p-[9px] md:p-[13px]">
      <SkeletonBlock className="h-[145px] w-full md:h-[210px]" />
      <div className="-mb-0.5 w-full min-w-0 leading-[1.6] md:-mb-[5px]">
        <p className="text-[20px] md:text-[23px]">
          <SkeletonText className="w-[3em]" />
        </p>
        <p className="text-[13px] md:text-[15px]">
          <SkeletonText className="w-4/5" />
        </p>
        <p className="text-[11px] md:text-[12px]">
          <SkeletonText className="w-3/5" />
        </p>
        <p className="text-[11px] md:text-[12px]">
          <SkeletonText className="w-2/5" />
        </p>
      </div>
    </div>
  )
}

/** "Seçilmiş xidmət" placeholder (SavedServiceCard geometry). */
function SavedServiceSkeleton() {
  return (
    <Card className="w-full gap-6 md:flex-row xl:flex-col">
      <SkeletonBlock className="h-[220px] w-full shrink-0 md:w-[302px] xl:w-full" />
      <div className="flex w-full min-w-0 flex-col items-start gap-3.5 md:flex-1">
        <SkeletonBlock className="h-[245px] w-full xl:h-[214px]" />
      </div>
    </Card>
  )
}

/**
 * /secilmisler — "Seçilmişlər". The pre-hydration script also records whether the visitor's list is empty
 * (`data-favorites`), so an empty list shows its empty state straight away instead of placeholder cards.
 */
export function FavoritesSkeleton() {
  return (
    <LoadingFrame>
      <AccountPage>
        <SectionHeader
          as="h1"
          title="Seçilmişlər"
          subtitle={
            <>
              Bəyəndiyiniz elanlara bir yerdən baxın. <SkeletonText className="w-[8em]" />
            </>
          }
          className="[&_p]:leading-[1.6] md:[&_p]:leading-[1.43]"
        />
        <div className={preHydrationClass('user')}>
          <AccountTabs active="favorites" />
        </div>
        <div className="flex w-full flex-wrap items-start gap-2">
          <PillSkeleton label="Hamısı" active />
          <PillSkeleton label="Məhsullar" />
          <PillSkeleton label="Xidmətlər" />
        </div>
        {/* Same children as the page's list (cards, saved services, note), inside a gap-7 column like AccountPage. */}
        <div className="favorites-some flex w-full flex-col gap-7">
          <section className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </section>
          <section className="flex w-full flex-col items-start gap-7">
            <h2 className="text-[23px] leading-[1.35] font-normal text-ink">
              <SkeletonText className="w-[8em]" />
            </h2>
            <div className="grid w-full grid-cols-1 items-start gap-3 md:gap-5 xl:grid-cols-3">
              <SavedServiceSkeleton />
            </div>
          </section>
          <p className="w-full text-[13px] leading-[1.5] text-muted">
            Qiymət və mövcudluq dəyişə bilər. Elanın son məlumatlarını satıcı ilə dəqiqləşdirin.
          </p>
        </div>
        <div className="favorites-none w-full">
          <EmptyState
            icon={<Heart aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
            title="Seçilmişlər hələ boşdur"
            description="Bəyəndiyiniz elanda ürək işarəsinə toxunun."
            action={
              <ButtonLink href="/elanlar" fullWidth>
                Elanlara bax
              </ButtonLink>
            }
          />
        </div>
      </AccountPage>
    </LoadingFrame>
  )
}

/** /kabinet/profil — heading, tabs and the profile panels (form, security, public card, notifications, notice). */
export function ProfileSkeleton() {
  return (
    <LoadingFrame>
      <AccountPage>
        <SectionHeader as="h1" title="Profil məlumatları" subtitle="Hesabınızı və alıcılara görünən məlumatları idarə edin." />
        <AccountTabs active="profile" />
        <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-[926fr_358fr] xl:gap-7">
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="w-full">
              <SkeletonBlock className="h-[963px] w-full" />
            </Card>
            <Card className="w-full">
              <SkeletonBlock className="h-[304px] w-full" />
            </Card>
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-1">
            <Card className="w-full">
              <SkeletonBlock className="h-[324px] w-full" />
            </Card>
            <Card className="w-full">
              <SkeletonBlock className="h-[154px] w-full" />
            </Card>
            <SkeletonBlock className="h-[100px] w-full md:col-span-2 md:h-[79px] xl:col-span-1 xl:h-[100px]" />
          </div>
        </div>
      </AccountPage>
    </LoadingFrame>
  )
}
