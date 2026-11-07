'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CircleAlert, Clock3, Plus, RotateCcw, Sprout } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { UnderlineTabs } from '@/components/ui/UnderlineTabs'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { useAccount } from '@/features/account/useAccount'
import { CabinetHeader } from '@/features/cabinet/CabinetHeader'
import { DraftRowCard, ListingRowCard } from '@/features/cabinet/ListingRows'
import { cabinetTabs, daysLeft, tabFromParam, type CabinetTab } from '@/features/cabinet/model'
import { useCabinet } from '@/features/cabinet/useCabinet'
import { formatNumber } from '@/lib/format'

const empty: Record<CabinetTab, { title: string; text: string }> = {
  all: { title: 'Hələ elanınız yoxdur', text: 'Bir neçə dəqiqəyə ilk elanınızı yerləşdirin: şəkil, qiymət, əlaqə — bu qədər.' },
  active: { title: 'Aktiv elan yoxdur', text: 'Yoxlamadan keçən elanlar burada görünəcək.' },
  pending: { title: 'Yoxlamada elan yoxdur', text: 'Yeni və dəyişdirilmiş elanlar moderasiya zamanı burada olur.' },
  expired: { title: 'Müddəti bitən elan yoxdur', text: 'Elanlar 30 gün saytda qalır; bitəndə burada pulsuz yeniləyə bilərsiniz.' },
  rejected: { title: 'Rədd edilən elan yoxdur', text: 'Əla! Bütün elanlarınız qaydalara uyğundur.' },
  inactive: { title: 'Deaktiv elan yoxdur', text: 'Satılan və ya müvəqqəti gizlətdiyiniz elanlar burada olur.' },
  draft: { title: 'Qaralama yoxdur', text: 'Yarımçıq qalan elan avtomatik saxlanılır və burada görünür.' },
}

const subscribe = () => () => {}
let pageNow: number | undefined

/**
 * /kabinet — «Elanlarım»: the owner's numbers (14 days), what needs attention (rejected, expiring), status tabs with
 * counts in the URL (?status=), and a card per listing with its numbers and the actions its status allows. Loading
 * shows placeholders; a failed load offers «Yenidən cəhd et».
 */
export default function DashboardPage() {
  const { account } = useAccount()
  const params = useSearchParams()
  const cabinet = useCabinet(account)
  const now = useSyncExternalStore(subscribe, () => (pageNow ??= Date.now()), () => 0)
  if (!account) return <SignInPrompt next="/kabinet" />

  const tab = tabFromParam(params.get('status'))
  const { listings, stats, counts, draft } = cabinet
  const shown = tab === 'all' ? listings : listings.filter((l) => l.status === tab)
  const showDraft = Boolean(draft) && (tab === 'all' || tab === 'draft')
  const total = (key: 'views' | 'phoneReveals' | 'favourites') => listings.reduce((sum, l) => sum + (stats[l.id]?.[key] ?? 0), 0)
  const views14 = listings.reduce((sum, l) => sum + (stats[l.id]?.viewsByDay.reduce((s, d) => s + d.views, 0) ?? 0), 0)
  const expiringSoon = listings.filter((l) => l.status === 'active' && (daysLeft(l, now) ?? 99) <= 3).length

  const tiles = [
    { label: 'Aktiv elan', value: counts.active },
    { label: 'Baxış, son 14 gün', value: views14 },
    { label: 'Nömrəyə baxış', value: total('phoneReveals') },
    { label: 'Seçilmişlərdə', value: total('favourites') },
  ]

  return (
    <div className="page-x mx-auto flex w-full max-w-[1200px] flex-col gap-6 pt-5 pb-14 md:pt-8">
      <CabinetHeader active="listings" counts={{ listings: counts.all }} />

      {cabinet.load.status === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl bg-danger-soft p-5">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <CircleAlert aria-hidden size={18} strokeWidth={2} className="text-danger" />
            {cabinet.load.error}
          </p>
          <Button variant="secondary" onClick={cabinet.retry} icon={<RotateCcw aria-hidden size={16} strokeWidth={1.8} />}>
            Yenidən cəhd et
          </Button>
        </div>
      ) : cabinet.load.status === 'loading' ? (
        <div aria-busy className="flex flex-col gap-4">
          <p role="status" className="sr-only">
            Elanlar yüklənir…
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBlock key={i} className="h-[84px] rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonBlock key={i} className="h-[150px] rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3.5">
                <dt className="text-[13px] leading-[1.3] text-muted">{t.label}</dt>
                <dd className="text-[24px] leading-[1.15] font-bold tracking-[-0.01em] text-forest tabular-nums">{formatNumber(t.value)}</dd>
              </div>
            ))}
          </dl>

          {(counts.rejected > 0 || expiringSoon > 0) && (
            <div className="flex flex-col gap-2">
              {counts.rejected > 0 && (
                <Link href="/kabinet?status=redd" scroll={false} className="flex items-center gap-2.5 rounded-xl bg-danger-soft px-4 py-3 text-sm leading-[1.4] text-ink hover:underline">
                  <CircleAlert aria-hidden size={18} strokeWidth={2} className="shrink-0 text-danger" />
                  <span>
                    <span className="font-semibold">{counts.rejected} elan rədd edilib.</span> Səbəbinə baxın, düzəldib yenidən göndərin.
                  </span>
                </Link>
              )}
              {expiringSoon > 0 && (
                <Link href="/kabinet?status=aktiv" scroll={false} className="flex items-center gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-sm leading-[1.4] text-ink hover:underline">
                  <Clock3 aria-hidden size={18} strokeWidth={2} className="shrink-0 text-warning" />
                  <span>
                    <span className="font-semibold">{expiringSoon} elanın müddəti 3 gün ərzində bitir.</span> Bitəndə pulsuz yeniləyə bilərsiniz.
                  </span>
                </Link>
              )}
            </div>
          )}

          <UnderlineTabs
            label="Elanın vəziyyəti"
            tabs={cabinetTabs.map((t) => ({ key: t.key, label: t.label, count: counts[t.key], href: t.param ? `/kabinet?status=${t.param}` : '/kabinet', active: t.key === tab }))}
          />

          {shown.length === 0 && !showDraft ? (
            <div className="flex justify-center py-4">
              <EmptyState
                icon={<Sprout aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
                title={empty[tab].title}
                description={empty[tab].text}
                action={
                  <ButtonLink href="/elan-yerlesdir" fullWidth icon={<Plus aria-hidden size={18} strokeWidth={1.8} />}>
                    Elan yerləşdir
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {showDraft && draft && <DraftRowCard draft={draft} onDiscard={cabinet.discardDraft} />}
              {shown.map((l) => (
                <ListingRowCard key={l.id} listing={l} stats={stats[l.id]} now={now} handlers={cabinet} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
