import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Notice } from '@/components/ui/Notice'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { dashboardStats } from '@/data/dashboard'
import { formatNumber } from '@/lib/format'
import { AccountTabs, STATS_ANCHOR } from '@/features/account/AccountTabs'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { AccountPage, InfoNotice } from '@/features/account/ui'
import { pillClass } from '@/features/account/pill'
import { firstName, useAccount } from '@/features/account/useAccount'
import { MyListingRowCard } from '@/features/account/dashboard/MyListingRowCard'
import { ViewsChart } from '@/features/account/dashboard/ViewsChart'
import { useMyListingRows, type MyListingRow, type StatusFilter } from '@/features/account/dashboard/useMyListingRows'

const filters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Hamısı' },
  { value: 'active', label: 'Aktiv' },
  { value: 'pending', label: 'Yoxlamada' },
  { value: 'expired', label: 'Müddəti bitib' },
]

/** "Leyland sərvi — 120 sm (№ 10524)" */
const listingLabel = (row: MyListingRow) => (row.listing.number ? `${row.listing.title} (№ ${row.listing.number})` : row.listing.title)

/** Figma "Şəxsi kabinet · 1440" (/kabinet). Requires a session. */
export default function DashboardPage() {
  const { account } = useAccount()
  if (!account) return <SignInPrompt next="/kabinet" />
  return <Dashboard sellerId={account.sellerId} name={account.fullName} subtitle={accountSubtitle(account)} />
}

function accountSubtitle(account: NonNullable<ReturnType<typeof useAccount>['account']>) {
  const name = account.companyName || account.fullName
  if (account.accountType === 'business') return `${name} · ${account.verified ? 'Təsdiqlənmiş biznes hesabı' : 'Biznes hesabı'}`
  return `${name} · Fərdi hesab`
}

function Dashboard({ sellerId, name, subtitle }: { sellerId?: string; name: string; subtitle: string }) {
  const { rows, counts, setStatus } = useMyListingRows(sellerId)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showMore, setShowMore] = useState(false)
  const [confirm, setConfirm] = useState<MyListingRow | null>(null)
  const [notice, setNotice] = useState<{ title: string; text: string } | null>(null)
  const closeDialog = useCallback(() => setConfirm(null), [])

  const filtered = rows.filter((r) => filter === 'all' || r.status === filter)
  const visible = showMore ? filtered : filtered.filter((r) => r.source !== 'more')
  const hasMore = !showMore && visible.length < filtered.length
  const pending = rows.find((r) => r.status === 'pending')

  const stats = [
    { label: 'Aktiv elanlar', value: counts.active },
    { label: 'Yoxlamada olanlar', value: counts.pending },
    { label: 'Müddəti bitmiş elanlar', value: counts.expired },
    { label: 'Son 30 günün baxışları', value: dashboardStats.views30d },
  ]

  return (
    <AccountPage>
      <SectionHeader as="h1" title={`Salam, ${firstName(name)}!`} subtitle={subtitle} />
      <AccountTabs active="listings" />

      <section aria-label="Hesab göstəriciləri" className="grid w-full grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col items-start gap-5 rounded-xl border border-line bg-surface p-[19px] md:p-[23px]">
            <p className="w-full text-xs leading-[1.5] text-muted">{s.label}</p>
            <p className="text-[30px] leading-[1.5] font-semibold text-ink">{formatNumber(s.value)}</p>
          </div>
        ))}
      </section>

      {pending && (
        <Notice tone="warning" title="Yeni elanınız yoxlamadadır">
          {listingLabel(pending)} moderasiya üçün göndərilib. Yoxlama adətən 24 saat ərzində tamamlanır.
        </Notice>
      )}

      <section aria-labelledby="my-listings-title" className="flex w-full flex-col items-start gap-7">
        <div className="flex w-full items-start justify-between gap-4">
          <h2 id="my-listings-title" className="text-[23px] leading-[1.35] font-normal text-ink">
            Elanlarım
          </h2>
          <ButtonLink to="/elan-yerlesdir" icon={<Plus aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
            Elan yerləşdir
          </ButtonLink>
        </div>

        <div role="group" aria-label="Elan statusu" className="flex w-full flex-wrap items-start gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value)
                setShowMore(false)
              }}
              className={pillClass(filter === f.value)}
            >
              {f.label} · {formatNumber(counts[f.value])}
            </button>
          ))}
        </div>

        {notice && (
          <Notice tone="success" title={notice.title}>
            {notice.text}
          </Notice>
        )}

        {visible.length > 0 ? (
          <div className="flex w-full flex-col gap-3.5">
            {visible.map((row) => (
              <MyListingRowCard
                key={row.listing.id}
                row={row}
                onDeactivate={setConfirm}
                onRenew={(r) => {
                  setStatus(r, 'active')
                  setNotice({ title: 'Elan yeniləndi', text: `${listingLabel(r)} yenidən aktivdir.` })
                }}
                onActivate={(r) => {
                  setStatus(r, 'active')
                  setNotice({ title: 'Elan aktiv edildi', text: `${listingLabel(r)} yenidən axtarışda görünür.` })
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-[1.5] text-muted">Bu bölmədə göstəriləcək elan yoxdur.</p>
        )}

        {hasMore && (
          <Button variant="secondary" onClick={() => setShowMore(true)}>
            Daha çox elan göstər
          </Button>
        )}
      </section>

      <div className="flex w-full flex-col items-start gap-6 xl:flex-row">
        <ViewsChart id={STATS_ANCHOR} />
        <div className="flex w-full shrink-0 flex-col items-start xl:w-[380px]">
          <InfoNotice title="Biznes üçün daha çox imkan">
            Genişləndirilmiş satıcı profili və ətraflı statistika ilə abunə paketləri tezliklə təqdim ediləcək.
          </InfoNotice>
          <p className="w-full text-xs leading-[1.5] text-muted">VIP təşviqi yalnız seçilən elanlarda göstərilir.</p>
        </div>
      </div>

      <Dialog open={confirm !== null} title="Elanı deaktiv etmək?" onClose={closeDialog}>
        <p className="text-sm leading-[1.5] text-ink">Elan axtarışdan gizlədiləcək. İstədiyiniz vaxt yenidən aktiv edə bilərsiniz.</p>
        <Button
          variant="danger"
          fullWidth
          onClick={() => {
            if (confirm) {
              setStatus(confirm, 'inactive')
              setNotice({ title: 'Elan deaktiv edildi', text: `${listingLabel(confirm)} axtarışdan gizlədildi.` })
            }
            setConfirm(null)
          }}
        >
          Deaktiv et
        </Button>
        <Button variant="secondary" fullWidth onClick={closeDialog}>
          Ləğv et
        </Button>
      </Dialog>
    </AccountPage>
  )
}
