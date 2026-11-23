import Link from 'next/link'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { InfoNotice, Notice } from '@/components/ui/Notice'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { Panel } from '@/components/ui/Panel'
import { AdminPage, PanelTitle } from '@/features/admin/AdminUi'
import { chipClass, rowClass } from '@/features/admin/format'
import { ReportDecision } from '@/features/admin/ReportDecision'
import {
  complaintStatuses,
  complaintStatusLabels,
  doneNotices,
  readReportParams,
  reportHistory,
  reportHref,
  reportListingMeta,
  reportMeta,
  reportPrice,
  reportTargetHref,
  reportTitle,
  resolutionLabels,
  targetLabels,
  toReportQuery,
  type ReportPageState,
} from '@/features/admin/reportsApi'
import { staffGate } from '@/features/admin/StaffGate'
import { adminRepository } from '@/services/adminRepository'
import { getRepository } from '@/services/repository'
import type { ComplaintStatus, ReportItem, ReportQueue, ReportTarget } from '@/types'

const BASE = '/idareetme/sikayetler'

const statusTone: Record<ComplaintStatus, BadgeTone> = { open: 'warning', investigating: 'warning', resolved: 'success' }

const targetChips: Array<{ value?: ReportTarget; label: string }> = [
  { value: undefined, label: 'Hamısı' },
  { value: 'listing', label: 'Elanlar' },
  { value: 'service', label: 'Xidmətlər' },
  { value: 'seller', label: 'Satıcılar' },
]

const sortChips = [
  { value: 'newest', label: 'Əvvəl ən yenilər' },
  { value: 'oldest', label: 'Əvvəl ən köhnələr' },
] as const

function ReportList({ state, queue, selected }: { state: ReportPageState; queue: ReportQueue; selected?: string }) {
  if (queue.items.length === 0) {
    return <p className="w-full rounded-xl border border-line bg-surface p-[19px] text-sm leading-[1.5] text-muted">Bu vəziyyətdə şikayət yoxdur.</p>
  }
  return (
    <ul className="flex w-full flex-col gap-3.5">
      {queue.items.map((item) => {
        const active = item.id === selected
        return (
          <li key={item.id}>
            <Link
              href={reportHref(state, { item: item.id })}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={rowClass(active, 'line', 'flex flex-col items-start gap-2.5 rounded-xl p-[19px]')}
            >
              <Badge tone={statusTone[item.status]}>{complaintStatusLabels[item.status]}</Badge>
              <span className="w-full text-[15px] leading-[1.5] font-semibold break-words text-ink">{reportTitle(item)}</span>
              <span className="w-full text-[13px] leading-[1.5] break-words text-muted">{reportMeta(item)}</span>
              {item.openReportsOnTarget > 1 && <span className="text-[13px] leading-[1.5] font-semibold text-danger">{item.openReportsOnTarget} açıq şikayət bu hədəf üzrə</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** The reported listing, service or seller, as the staff check it. */
function Target({ item }: { item: ReportItem }) {
  const href = reportTargetHref(item)
  const { listing, seller } = item
  const badges = (
    <>
      {item.targetDeleted && <Badge tone="danger">Silinib</Badge>}
      {item.owner?.status === 'blocked' && <Badge tone="danger">Hesab bloklanıb</Badge>}
      {listing && !item.targetDeleted && listing.status !== 'active' && <Badge tone="neutral">Saytda deyil</Badge>}
      {seller?.verified && <Badge tone="success">Təsdiqlənmiş satıcı</Badge>}
    </>
  )
  if (item.target === 'seller') {
    return (
      <div className="flex w-full min-w-0 flex-col items-start gap-3">
        <h3 className="w-full text-lg leading-[1.3] font-semibold tracking-[-0.01em] break-words text-forest">{seller?.name ?? 'Satıcı'}</h3>
        <p className="w-full text-[13px] leading-[1.5] text-ink">{item.owner ? `${item.owner.name} · ${item.owner.accountType === 'business' ? 'biznes hesabı' : 'fərdi hesab'}` : 'Hesab tapılmadı'}</p>
        <div className="flex flex-wrap items-center gap-3">
          {href && (
            <ButtonLink variant="secondary" href={href}>
              Satıcı səhifəsini aç
            </ButtonLink>
          )}
          {badges}
        </div>
      </div>
    )
  }
  return (
    <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start">
      {listing?.cover && <img src={listing.cover} alt={listing.title} className="h-[180px] w-full shrink-0 rounded-lg object-cover sm:w-[200px]" />}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
        <h3 className="w-full text-lg leading-[1.3] font-semibold tracking-[-0.01em] break-words text-forest">{listing?.title ?? targetLabels[item.target]}</h3>
        {listing && <p className="text-2xl leading-[1.5] font-semibold text-ink">{reportPrice(listing)}</p>}
        {listing && <p className="w-full text-[13px] leading-[1.5] break-words text-ink">{reportListingMeta(item)}</p>}
        {listing?.contactPhone && <p className="w-full text-[13px] leading-[1.5] text-muted tabular-nums">Əlaqə: {listing.contactPhone}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {href && (
            <ButtonLink variant="secondary" href={href}>
              {item.target === 'service' ? 'Xidməti aç' : 'Elanı aç'}
            </ButtonLink>
          )}
          {badges}
        </div>
      </div>
    </div>
  )
}

/**
 * /idareetme/sikayetler with DATA_SOURCE=api (backend-contract.md 3.5, 4.1): the API's reports, rendered on the
 * server for the signed-in moderator or admin; anyone else is asked to sign in or told the page is for staff.
 * Filters, the page and the open report are links (the address keeps them); the decision is the one client island.
 * «Elanı dayandır» of the demo has no API yet: admins block the account behind the target instead.
 */
export default async function ApiComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = readReportParams(await searchParams)
  const me = await getRepository().getMe()
  const gate = staffGate(me, reportHref(state))
  if (gate || !me) return gate

  const queue = await adminRepository.reports(toReportQuery(state))
  const chosen = state.item ? (queue.items.find((i) => i.id === state.item) ?? (await adminRepository.report(state.item))) : queue.items[0]
  const { totals } = queue
  const admin = me.role === 'admin'

  return (
    <AdminPage title="Şikayətlərin idarə olunması" subtitle={`${totals.open} açıq şikayət · ${totals.investigating} araşdırılır · ${totals.resolved} həll olunub`}>
      <nav aria-label="Şikayət vəziyyəti" className="flex w-full flex-wrap items-start gap-2">
        {complaintStatuses.map((status) => {
          const active = state.status === status
          return (
            <Link key={status} href={reportHref(state, { status: active ? undefined : status })} aria-current={active ? 'page' : undefined} className={chipClass(active)}>
              {complaintStatusLabels[status]} · {totals[status]}
            </Link>
          )
        })}
      </nav>
      <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Şikayətin hədəfi və sıra">
        {targetChips.map((chip) => (
          <Link key={chip.label} href={reportHref(state, { target: chip.value })} aria-current={state.target === chip.value ? 'true' : undefined} className={chipClass(state.target === chip.value)}>
            {chip.label}
          </Link>
        ))}
        {sortChips.map((chip) => (
          <Link key={chip.value} href={reportHref(state, { sort: chip.value })} aria-current={state.sort === chip.value ? 'true' : undefined} className={chipClass(state.sort === chip.value)}>
            {chip.label}
          </Link>
        ))}
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
        <section aria-labelledby="complaint-list-title" className="flex w-full min-w-0 flex-col gap-3">
          <h2 id="complaint-list-title" className="sr-only">
            Şikayət siyahısı
          </h2>
          <ReportList state={state} queue={queue} selected={chosen?.id} />
          {queue.pageCount > 1 && <PaginationLinks page={queue.page} pageCount={queue.pageCount} basePath={BASE} query={reportHref(state, { page: 1, item: undefined }).split('?')[1] ?? ''} />}
        </section>

        <div className="flex w-full min-w-0 flex-col items-start gap-6">
          {state.done && chosen && (
            <Notice tone="success" title={doneNotices[state.done]}>
              {reportTitle(chosen)}: {complaintStatusLabels[chosen.status].toLocaleLowerCase('az')}
              {chosen.resolution ? ` (${resolutionLabels[chosen.resolution].toLocaleLowerCase('az')})` : ''}.
            </Notice>
          )}
          {chosen ? (
            <>
              <Panel aria-labelledby="complaint-title" className="w-full">
                <div className="flex w-full items-start gap-3">
                  <h2 id="complaint-title" className="min-w-0 flex-1 text-lg leading-[1.3] font-semibold tracking-[-0.01em] break-words text-forest">
                    {reportTitle(chosen)} · {targetLabels[chosen.target]}
                  </h2>
                  <Badge tone={statusTone[chosen.status]}>{complaintStatusLabels[chosen.status]}</Badge>
                </div>
                <p className="w-full text-sm leading-[1.5] break-words text-ink">
                  Şikayətçi: {chosen.reporter?.name ?? 'qonaq (daxil olmayıb)'}.{chosen.comment && ` “${chosen.comment}”`}
                </p>
                <Target item={chosen} />
              </Panel>

              <ReportDecision
                key={`${chosen.id}:${chosen.status}:${chosen.history.length}:${chosen.owner?.status}:${chosen.seller?.verified}`}
                report={chosen}
                owner={chosen.owner?.status === 'deleted' ? undefined : chosen.owner}
                seller={chosen.seller}
                admin={admin}
                afterHref={reportHref(state, { item: chosen.id })}
              />

              <InfoNotice title="Qərar tarixçəsi">
                <ol className="flex flex-col gap-1">
                  {reportHistory(chosen).map((line, i) => (
                    <li key={i}>
                      {line.time} — {line.text}
                    </li>
                  ))}
                </ol>
              </InfoNotice>
            </>
          ) : (
            <Panel className="w-full">
              <PanelTitle subtitle="Təfərrüatları görmək üçün siyahıdan şikayət seçin.">Şikayət seçilməyib</PanelTitle>
            </Panel>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
