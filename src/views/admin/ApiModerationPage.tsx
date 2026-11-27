import Link from 'next/link'
import { ArrowDownUp, ArrowLeft, ArrowRight, BadgeCheck, Check, CircleAlert, CircleCheck, Clock3, History, ImageOff, Search, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Notice } from '@/components/ui/Notice'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { AdminPage } from '@/features/admin/AdminUi'
import { formatQueueTime } from '@/features/admin/format'
import { ModerationDecision } from '@/features/admin/ModerationDecision'
import { AdminOverviewPanel } from '@/features/admin/AdminOverviewPanel'
import { ReviewGallery } from '@/features/admin/ReviewGallery'
import { staffGate } from '@/features/admin/StaffGate'
import {
  changeLine,
  itemBadge,
  moderationHref,
  queueFlags,
  readModerationParams,
  requestTime,
  reviewChecks,
  reviewFacts,
  sellerFacts,
  toModerationQuery,
  waitLabel,
  type ModerationPageState,
  type ReviewRow,
} from '@/features/admin/moderationApi'
import { ordinal } from '@/features/listing/detail'
import { listingPrice } from '@/features/listing/facts'
import { rejectionReasonLabels } from '@/features/listing/rejection'
import { adminRepository } from '@/services/adminRepository'
import { getRepository } from '@/services/repository'
import { cn, formatDayMonth } from '@/lib/format'
import type { ModerationItem, ModerationQueue } from '@/types'

const BASE = '/idareetme/moderasiya'

const statusTabs = [
  { value: 'pending', label: 'Gözləyən', total: (t: ModerationQueue['totals']) => t.pending },
  { value: 'approved', label: 'Təsdiqlənmiş', total: (t: ModerationQueue['totals']) => t.approved },
  { value: 'rejected', label: 'Rədd edilmiş', total: (t: ModerationQueue['totals']) => t.rejected },
] as const

const kindChips = [
  { value: undefined, label: 'Hamısı' },
  { value: 'new', label: 'Yeni' },
  { value: 'recheck', label: 'Təkrar yoxlama' },
] as const

/** «7 elan yoxlama gözləyir, 1 təkrar yoxlama daxil olmaqla» */
function summary(totals: ModerationQueue['totals']): string {
  if (totals.pending === 0) return 'Yoxlama gözləyən elan yoxdur.'
  return `${totals.pending} elan yoxlama gözləyir${totals.recheck ? `, ${totals.recheck} təkrar yoxlama daxil olmaqla` : ''}.`
}

/** A two-column list of facts: label on the left, the value as the reader will see it. */
function Facts({ rows, className }: { rows: ReviewRow[]; className?: string }) {
  return (
    <dl className={cn('grid w-full grid-cols-[minmax(0,128px)_minmax(0,1fr)] gap-x-4 text-sm leading-[1.45]', className)}>
      {rows.map((r) => (
        <div key={r.label} className="col-span-2 grid grid-cols-subgrid border-b border-line py-2 last:border-b-0">
          <dt className="text-muted">{r.label}</dt>
          <dd className={cn('min-w-0 break-words text-ink', r.latin && 'italic')}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-[15px] leading-[1.3] font-semibold text-forest">
      {children}
    </h3>
  )
}

/** What the moderator reviews, in the order it is judged: what changed, the photos and facts, the text, who sent it. */
function Review({ item, now }: { item: ModerationItem; now: number }) {
  const badge = itemBadge(item)
  const { listing, seller } = item
  const price = listingPrice(listing)
  const changes = item.changes.map(changeLine)
  const checks = reviewChecks(item)
  const last = item.lastDecision
  const pending = item.status === 'pending'
  const wait = waitLabel(item.submittedAt, now)
  const phone = listing.contactPhone
  return (
    <>
      <header className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] leading-[1.4] text-muted">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="tabular-nums">Elan № {item.number}</span>
          {pending && <span>Göndərilib: {formatQueueTime(item.submittedAt, ', ')}</span>}
          {pending && wait.text && (
            <span className={cn('inline-flex items-center gap-1', wait.late && 'font-semibold text-warning')}>
              {wait.late && <Clock3 aria-hidden size={13} strokeWidth={2.2} />}
              {wait.text} gözləyir
            </span>
          )}
        </div>
        <h2 id="review-title" className="text-[22px] leading-[1.25] font-semibold tracking-[-0.015em] break-words text-forest md:text-[26px]">
          {item.title}
        </h2>
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[22px] leading-[1.3] font-semibold text-ink tabular-nums">{price.amount}</span>
          {price.unit && <span className="text-[15px] text-muted">{price.unit}</span>}
        </p>
      </header>

      {!pending && last && (
        <p
          className={cn(
            'flex w-full items-start gap-2 rounded-lg px-3.5 py-3 text-sm leading-[1.5]',
            last.decision === 'approve' ? 'bg-success-soft text-ink' : 'bg-danger-soft text-ink',
          )}
        >
          {last.decision === 'approve' ? (
            <CircleCheck aria-hidden size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-success" />
          ) : (
            <ShieldAlert aria-hidden size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
          )}
          <span>
            <span className="font-semibold">{last.decision === 'approve' ? 'Təsdiqlənib' : 'Rədd edilib'}</span>, {formatDayMonth(last.createdAt)}.
            {last.reasonCode ? ` Səbəb: ${rejectionReasonLabels[last.reasonCode]}.` : ''}
            {last.note ? ` ${last.note}` : ''}
          </span>
        </p>
      )}

      {changes.length > 0 && (
        <section aria-labelledby="review-changes" className="flex w-full flex-col gap-3 rounded-lg border border-warning-line bg-warning-soft p-4">
          <div className="flex flex-col gap-0.5">
            <h3 id="review-changes" className="text-[15px] leading-[1.3] font-semibold text-ink">
              Nə dəyişib
            </h3>
            <p className="text-[13px] leading-[1.4] text-ink-soft">{ordinal(item.revision)} versiya, son təsdiqlənmiş versiya ilə müqayisədə</p>
          </div>
          <dl className="grid w-full grid-cols-1 gap-x-4 gap-y-2 text-sm leading-[1.45] sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
            {changes.map((c, i) => (
              <div key={`${c.label}-${i}`} className="contents">
                <dt className="font-semibold text-ink-soft">{c.label}</dt>
                <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 break-words">
                  <span className="text-muted line-through decoration-muted/60">
                    <span className="sr-only">əvvəl: </span>
                    {c.before}
                  </span>
                  <ArrowRight aria-hidden size={14} strokeWidth={2} className="shrink-0 text-warning" />
                  <span className="sr-only">indi:</span>
                  <span className="font-medium text-ink">{c.after}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="grid w-full items-start gap-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <ReviewGallery images={item.photoCount > 0 ? listing.images : []} title={item.title} />
        <section aria-labelledby="review-facts" className="flex min-w-0 flex-col gap-1">
          <SectionTitle id="review-facts">Elan haqqında</SectionTitle>
          <Facts rows={reviewFacts(item)} />
        </section>
      </div>

      <section aria-labelledby="review-description" className="flex w-full flex-col gap-2">
        <SectionTitle id="review-description">Təsvir</SectionTitle>
        {listing.description && listing.description.length > 0 ? (
          <div className="flex max-w-[70ch] flex-col gap-2.5 text-[15px] leading-[1.6] text-ink">
            {listing.description.map((p, i) => (
              <p key={i} className="break-words">
                {p}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Satıcı təsvir yazmayıb.</p>
        )}
      </section>

      <div className="grid w-full items-start gap-7 md:grid-cols-2">
        <section aria-labelledby="review-seller" className="flex min-w-0 flex-col gap-2">
          <SectionTitle id="review-seller">Satıcı</SectionTitle>
          <p className="flex items-center gap-1.5 text-[15px] leading-[1.4] font-semibold text-ink">
            <span className="min-w-0 break-words">{seller.name}</span>
            {seller.verified && <BadgeCheck aria-label="Təsdiqlənmiş biznes" size={16} strokeWidth={2} className="shrink-0 text-success" />}
          </p>
          {phone && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-[1.45]">
              <span className="text-ink tabular-nums">{phone}</span>
              {item.contactPhoneVerified ? (
                <span className="inline-flex items-center gap-1 text-[13px] text-success">
                  <Check aria-hidden size={14} strokeWidth={2.2} />
                  hesabın öz nömrəsi
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-danger">
                  <CircleAlert aria-hidden size={14} strokeWidth={2} />
                  təsdiqlənməyib
                </span>
              )}
            </p>
          )}
          <Facts rows={sellerFacts(item)} className="mt-1" />
        </section>

        <section aria-labelledby="review-checks" className="flex min-w-0 flex-col gap-2">
          <SectionTitle id="review-checks">Yoxlama</SectionTitle>
          <ul className="flex flex-col gap-2 text-sm leading-[1.45]">
            {[...checks].sort((a, b) => Number(a.ok) - Number(b.ok)).map((c) => (
              <li key={c.text} className={cn('flex items-start gap-2', c.ok ? 'text-ink' : 'font-semibold text-danger')}>
                {c.ok ? (
                  <Check aria-hidden size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <CircleAlert aria-hidden size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
                )}
                {c.text}
              </li>
            ))}
          </ul>
          {pending && last && (
            <p className="mt-1 flex items-start gap-2 text-[13px] leading-[1.45] text-muted">
              <History aria-hidden size={15} strokeWidth={1.8} className="mt-px shrink-0" />
              Əvvəlki qərar, {formatDayMonth(last.createdAt)}: {last.decision === 'approve' ? 'təsdiqlənib' : 'rədd edilib'}
              {last.reasonCode ? ` (${rejectionReasonLabels[last.reasonCode]})` : ''}
            </p>
          )}
        </section>
      </div>
    </>
  )
}

/** A queue row's photo; a listing without one shows the gap (it is one of the flags). */
function Thumb({ item }: { item: ModerationItem }) {
  const src = item.listing.thumbnail ?? item.listing.cover
  if (item.photoCount === 0 || !src) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-sand text-muted">
        <ImageOff aria-hidden size={20} strokeWidth={1.6} />
      </span>
    )
  }
  return <img src={src} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
}

function QueueFilters({ state, totals }: { state: ModerationPageState; totals: ModerationQueue['totals'] }) {
  return (
    <div className="flex flex-col gap-3 p-3.5">
      <nav aria-label="Elan vəziyyəti" className="grid grid-cols-3 gap-1 rounded-[10px] bg-mint p-1">
        {statusTabs.map((tab) => {
          const active = state.status === tab.value
          return (
            <Link
              key={tab.value}
              href={moderationHref(state, { status: tab.value })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg px-1 text-center transition-colors duration-(--dur-fast)',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:ring-inset',
                active ? 'bg-surface text-forest ring-1 ring-line' : 'text-ink-soft hover:text-forest',
              )}
            >
              <span className={cn('max-w-full truncate text-[13px] leading-[1.3]', active && 'font-semibold')}>{tab.label}</span>
              <span className={cn('text-xs leading-[1.3] tabular-nums', active ? 'font-semibold' : 'text-muted')}>{tab.total(totals)}</span>
            </Link>
          )
        })}
      </nav>

      <div role="group" aria-label="Yoxlamanın növü" className="flex flex-wrap gap-1">
        {kindChips.map((chip) => {
          const active = state.kind === chip.value
          return (
            <Link
              key={chip.label}
              href={moderationHref(state, { kind: chip.value })}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] leading-[normal] whitespace-nowrap transition-colors duration-(--dur-fast)',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive',
                active ? 'bg-forest font-semibold text-white' : 'text-ink-soft hover:bg-mint hover:text-forest',
              )}
            >
              {chip.label}
              {chip.value === 'recheck' && state.status === 'pending' && totals.recheck > 0 && <span className="tabular-nums opacity-80">{totals.recheck}</span>}
            </Link>
          )
        })}
      </div>

      <form action={BASE} role="search" className="relative">
        {state.status !== 'pending' && <input type="hidden" name="status" value={state.status} />}
        {state.kind && <input type="hidden" name="kind" value={state.kind} />}
        {state.sort !== 'newest' && <input type="hidden" name="sort" value={state.sort} />}
        <label htmlFor="moderation-q" className="sr-only">
          Elan nömrəsi və ya başlıq
        </label>
        <Search aria-hidden size={16} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          id="moderation-q"
          name="q"
          type="search"
          defaultValue={state.q}
          placeholder="Elan nömrəsi və ya başlıq"
          className="h-11 w-full min-w-0 rounded-lg border border-line-strong bg-surface pr-[76px] pl-9 text-[15px] text-ink placeholder:text-muted focus-visible:border-forest focus-visible:outline-none"
        />
        <button
          type="submit"
          className="absolute top-1/2 right-1.5 inline-flex h-8 -translate-y-1/2 items-center rounded-md bg-mint px-3 text-[13px] font-semibold text-forest transition-colors duration-(--dur-fast) hover:bg-line focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive"
        >
          Axtar
        </button>
      </form>
    </div>
  )
}

/** Above the rows: how many there are (or what was searched) and the order, which a click turns around. */
function QueueHeader({ state, total }: { state: ModerationPageState; total: number }) {
  const nextSort = state.sort === 'newest' ? 'oldest' : 'newest'
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-y border-line bg-cream px-3.5 text-[13px] leading-[1.4] text-ink-soft">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 break-words">{state.q ? `«${state.q}» üzrə ${total} elan` : `${total} elan`}</span>
        {state.q && (
          <Link href={moderationHref(state, { q: '' })} className="font-semibold text-forest underline-offset-2 hover:underline">
            Sıfırla
          </Link>
        )}
      </p>
      <Link
        href={moderationHref(state, { sort: nextSort })}
        aria-label={`Sıra: ${state.sort === 'newest' ? 'əvvəl yenilər' : 'əvvəl köhnələr'}. Dəyiş`}
        className="-mr-2 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 whitespace-nowrap transition-colors duration-(--dur-fast) hover:bg-mint hover:text-forest focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive"
      >
        <ArrowDownUp aria-hidden size={15} strokeWidth={1.8} />
        {state.sort === 'newest' ? 'Əvvəl yenilər' : 'Əvvəl köhnələr'}
      </Link>
    </div>
  )
}

function Queue({ state, queue, selected, picked, now }: { state: ModerationPageState; queue: ModerationQueue; selected?: string; picked: boolean; now: number }) {
  if (queue.items.length === 0) {
    return <p className="px-4 py-10 text-center text-sm leading-[1.5] text-muted">{state.q ? 'Bu axtarışa uyğun elan tapılmadı.' : 'Bu bölmədə elan yoxdur.'}</p>
  }
  const pending = state.status === 'pending'
  return (
    <ul className="flex w-full flex-col divide-y divide-line xl:min-h-0 xl:overflow-y-auto">
      {queue.items.map((item) => {
        const active = item.id === selected
        const wait = waitLabel(item.submittedAt, now)
        const flags = queueFlags(item)
        return (
          <li key={item.id}>
            <Link
              href={moderationHref(state, { item: item.id })}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'relative flex gap-3 px-3.5 py-3 transition-colors duration-(--dur-fast)',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:ring-inset',
                // Nothing is open on a narrow screen until a row is chosen: the first one is marked on wide screens only.
                active ? (picked ? 'bg-mint' : 'hover:bg-cream xl:bg-mint') : 'hover:bg-cream',
              )}
            >
              {active && <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px] bg-forest', !picked && 'max-xl:hidden')} />}
              <Thumb item={item} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-start justify-between gap-3">
                  <span className="line-clamp-2 text-sm leading-[1.35] font-semibold break-words text-ink">{item.title}</span>
                  {pending ? (
                    <span
                      title={`Göndərilib: ${formatQueueTime(item.submittedAt)}`}
                      className={cn('mt-px inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap tabular-nums', wait.late ? 'font-semibold text-warning' : 'text-muted')}
                    >
                      {wait.late && <Clock3 aria-hidden size={12} strokeWidth={2.2} />}
                      {wait.text}
                      <span className="sr-only"> gözləyir</span>
                    </span>
                  ) : (
                    <span className="mt-px shrink-0 text-xs whitespace-nowrap text-muted tabular-nums">{formatQueueTime(item.submittedAt)}</span>
                  )}
                </span>
                <span className="truncate text-[13px] leading-[1.4] text-ink-soft">{item.sellerName}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-[1.3] text-muted">
                  <span className="tabular-nums">№ {item.number}</span>
                  {item.kind === 'recheck' && pending && <span className="rounded bg-warning-soft px-1.5 py-0.5 font-semibold text-warning">Təkrar yoxlama</span>}
                  {flags.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1 font-medium text-danger">
                      <CircleAlert aria-hidden size={12} strokeWidth={2.2} />
                      {f}
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * /idareetme/moderasiya with DATA_SOURCE=api (backend-contract.md 3.5): the API's queue, rendered on the server for
 * the signed-in moderator or admin; anyone else is asked to sign in or told the page is for staff. On /idareetme the
 * numbers of every section (`GET /admin/overview`) come first. Filters, the page and the open listing are links (the
 * address keeps them); the decision is the one client island. Wide screens show the queue and the review side by side
 * (the queue stays under the 68 px header and keeps its own scroll); narrower ones show one at a time: the queue, or the listing chosen from it.
 */
export default async function ApiModerationPage({
  searchParams,
  withOverview = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  /** /idareetme: the numbers of every section above the queue */
  withOverview?: boolean
}) {
  const state = readModerationParams(await searchParams)
  const me = await getRepository().getMe()
  const gate = staffGate(me, withOverview ? '/idareetme' : moderationHref(state))
  if (gate || !me) return gate

  const [queue, overview] = await Promise.all([adminRepository.moderationQueue(toModerationQuery(state)), withOverview ? adminRepository.overview() : undefined])
  const chosen = state.item ? (queue.items.find((i) => i.id === state.item) ?? (await adminRepository.moderationItem(state.item))) : queue.items[0]
  const done = state.done ? await adminRepository.moderationItem(state.done.listingId) : undefined
  const { totals } = queue
  const listHref = moderationHref(state, { item: undefined })
  const now = requestTime()
  // A listing chosen from the queue: on narrow screens it replaces the queue (and links back to it).
  const picked = Boolean(state.item)

  return (
    <AdminPage
      title="Elan moderasiyası"
      subtitle={summary(totals)}
      aside={
        <p className="text-[13px] leading-[1.4] text-muted">
          Moderator: <span className="font-medium text-ink-soft">{me.fullName}</span>
        </p>
      }
    >
      {overview && <AdminOverviewPanel overview={overview} admin={me.role === 'admin'} />}

      {done && state.done && (
        <Notice tone={state.done.decision === 'approve' ? 'success' : 'danger'} title={state.done.decision === 'approve' ? 'Elan təsdiqləndi' : 'Elan rədd edildi'} className="w-full">
          {state.done.decision === 'approve' ? (
            <>
              «{done.title}» saytda görünür və 30 gün aktiv olacaq.{' '}
              <Link href={`/elanlar/${done.listing.slug}`} className="font-semibold text-forest underline underline-offset-2">
                Saytda bax
              </Link>
            </>
          ) : (
            `«${done.title}» satıcıya qaytarıldı.${done.listing.rejectionReasonCode ? ` Səbəb: ${rejectionReasonLabels[done.listing.rejectionReasonCode]}.` : ''}`
          )}
        </Notice>
      )}

      <div className="grid w-full items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <section
          aria-labelledby="moderation-queue-title"
          className={cn(
            'flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface xl:sticky xl:top-[84px] xl:max-h-[calc(100dvh-100px)]',
            picked && 'max-xl:hidden',
          )}
        >
          <h2 id="moderation-queue-title" className="sr-only">
            Moderasiya növbəsi
          </h2>
          <QueueFilters state={state} totals={totals} />
          <QueueHeader state={state} total={queue.total} />
          <Queue state={state} queue={queue} selected={chosen?.id} picked={picked} now={now} />
          {queue.pageCount > 1 && (
            <div className="border-t border-line p-3">
              <PaginationLinks page={queue.page} pageCount={queue.pageCount} basePath={BASE} query={moderationHref(state, { page: 1, item: undefined }).split('?')[1] ?? ''} />
            </div>
          )}
        </section>

        <div className={cn('flex w-full min-w-0 flex-col gap-3', !picked && 'max-xl:hidden')}>
          {picked && (
            <Link
              href={listHref}
              className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg pr-3 text-sm font-semibold text-forest hover:underline hover:underline-offset-2 xl:hidden"
            >
              <ArrowLeft aria-hidden size={17} strokeWidth={1.8} />
              Növbəyə qayıt
            </Link>
          )}
          {chosen ? (
            <ModerationDecision
              key={`${chosen.id}:${chosen.version}`}
              listingId={chosen.id}
              title={chosen.title}
              version={chosen.version}
              pending={chosen.status === 'pending'}
              afterHref={listHref}
              review={<Review item={chosen} now={now} />}
            />
          ) : (
            <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <CircleCheck aria-hidden size={32} strokeWidth={1.6} className="text-success" />
              <h2 className="text-lg leading-[1.3] font-semibold text-forest">{state.status === 'pending' && !state.q ? 'Növbə boşdur' : 'Elan seçilməyib'}</h2>
              <p className="max-w-[44ch] text-sm leading-[1.5] text-muted">
                {state.status === 'pending' && !state.q ? 'Yoxlanacaq elan qalmayıb. Yeni elan göndəriləndə burada görünəcək.' : 'Bu bölmədə göstəriləcək elan yoxdur.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
