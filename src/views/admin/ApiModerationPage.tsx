import Link from 'next/link'
import { CircleAlert, Search, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { InfoNotice, Notice } from '@/components/ui/Notice'
import { PaginationLinks } from '@/components/ui/PaginationLinks'
import { Panel } from '@/components/ui/Panel'
import { SignInPrompt } from '@/features/account/SignInPrompt'
import { AdminPage, PanelTitle } from '@/features/admin/AdminUi'
import { chipClass, formatQueueTime, rowClass } from '@/features/admin/format'
import { ModerationDecision } from '@/features/admin/ModerationDecision'
import {
  changeLine,
  itemBadge,
  moderationHref,
  readModerationParams,
  reviewChecks,
  reviewDetails,
  reviewPrice,
  sellerLine,
  toModerationQuery,
  type ModerationPageState,
} from '@/features/admin/moderationApi'
import { rejectionReasonLabels } from '@/features/listing/rejection'
import { adminRepository } from '@/services/adminRepository'
import { getRepository } from '@/services/repository'
import { cn, formatDayMonth } from '@/lib/format'
import type { ModerationItem, ModerationQueue } from '@/types'

const BASE = '/idareetme/moderasiya'

const statusChips = [
  { value: 'pending', label: 'Gözləyən', total: (t: ModerationQueue['totals']) => t.pending },
  { value: 'approved', label: 'Təsdiqlənmiş', total: (t: ModerationQueue['totals']) => t.approved },
  { value: 'rejected', label: 'Rədd edilmiş', total: (t: ModerationQueue['totals']) => t.rejected },
] as const

const kindChips = [
  { value: undefined, label: 'Hamısı' },
  { value: 'new', label: 'Yeni' },
  { value: 'recheck', label: 'Təkrar yoxlama' },
] as const

const sortChips = [
  { value: 'newest', label: 'Əvvəl ən yenilər' },
  { value: 'oldest', label: 'Əvvəl ən köhnələr' },
] as const

/** The staff page for an account that is not staff (the API would answer 403 anyway). */
function NotStaff() {
  return (
    <div className="page-x mx-auto flex w-full max-w-[1440px] justify-center py-16">
      <EmptyState
        icon={<ShieldAlert aria-hidden size={30} strokeWidth={1.8} absoluteStrokeWidth />}
        title="Bu bölmə moderatorlar üçündür"
        description="Hesabınızın moderasiyaya icazəsi yoxdur. Elanlarınızı şəxsi kabinetdə idarə edə bilərsiniz."
        action={
          <ButtonLink href="/kabinet" fullWidth>
            Şəxsi kabinet
          </ButtonLink>
        }
      />
    </div>
  )
}

/** What the moderator reviews: the listing's photo, price, facts, text, seller, the checklist and what changed. */
function Review({ item }: { item: ModerationItem }) {
  const badge = itemBadge(item)
  const { listing } = item
  const changes = item.changes.map(changeLine)
  const last = item.lastDecision
  return (
    <>
      <div className="flex w-full items-start gap-3">
        <h2 id="review-title" className="min-w-0 flex-1 text-lg leading-[1.3] font-semibold tracking-[-0.01em] break-words text-forest">
          {item.title}
        </h2>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      {listing.cover && <img src={listing.cover} alt={item.title} className="h-[220px] w-full rounded-lg object-cover md:h-[280px]" />}
      {listing.images.length > 1 && (
        <ul aria-label="Digər şəkillər" className="flex w-full gap-2 overflow-x-auto">
          {listing.images.slice(1).map((src, i) => (
            <li key={src} className="shrink-0">
              <img src={src} alt={`Şəkil ${i + 2}`} loading="lazy" className="size-20 rounded-md object-cover" />
            </li>
          ))}
        </ul>
      )}
      <p className="w-full text-[22px] leading-[1.5] font-semibold text-ink md:text-[26px]">
        {reviewPrice(item)} · Elan № {item.number}
      </p>
      <p className="w-full text-sm leading-[1.5] text-ink">{reviewDetails(item)}</p>
      {listing.description && listing.description.length > 0 && (
        <div className="flex w-full flex-col gap-2 text-sm leading-[1.5] text-ink">
          {listing.description.map((p, i) => (
            <p key={i} className="break-words">
              {p}
            </p>
          ))}
        </div>
      )}
      <p className="w-full text-[13px] leading-[1.5] text-muted">{sellerLine(item)}</p>
      <ul className="flex w-full flex-wrap gap-x-3 gap-y-1 text-[13px] leading-[1.5]">
        {reviewChecks(item).map((c) => (
          <li key={c.text} className={cn('inline-flex items-center gap-1', c.ok ? 'text-ink' : 'font-semibold text-danger')}>
            {c.ok ? '✓' : <CircleAlert aria-hidden size={14} strokeWidth={2} />} {c.text}
          </li>
        ))}
      </ul>
      {changes.length > 0 && (
        <div className="flex w-full flex-col gap-2 rounded-lg bg-warning-soft p-4">
          <p className="text-[13px] leading-[1.4] font-semibold text-ink">Son təsdiqlənmiş versiyadan fərqlər ({item.revision}-ci versiya)</p>
          <dl className="grid w-full grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] leading-[1.45] sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
            {changes.map((c, i) => (
              <div key={`${c.label}-${i}`} className="contents">
                <dt className="font-semibold text-ink-soft">{c.label}</dt>
                <dd className="min-w-0 break-words text-ink">
                  <span className="text-muted line-through">{c.before}</span> → {c.after}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {last && (
        <p className={cn('w-full text-[13px] leading-[1.5]', last.decision === 'reject' ? 'text-danger' : 'text-muted')}>
          Son qərar ({formatDayMonth(last.createdAt)}): {last.decision === 'approve' ? 'təsdiqlənib' : 'rədd edilib'}
          {last.reasonCode ? `. Səbəb: ${rejectionReasonLabels[last.reasonCode]}` : ''}
          {last.note ? `. ${last.note}` : ''}
        </p>
      )}
    </>
  )
}

function Queue({ state, queue, selected }: { state: ModerationPageState; queue: ModerationQueue; selected?: string }) {
  if (queue.items.length === 0) {
    return <p className="w-full rounded-[10px] border border-line bg-surface p-[17px] text-sm leading-[1.5] text-muted">Bu bölmədə elan yoxdur.</p>
  }
  return (
    <ul className="flex w-full flex-col gap-3">
      {queue.items.map((item) => {
        const active = item.id === selected
        const badge = itemBadge(item)
        return (
          <li key={item.id}>
            <Link
              href={moderationHref(state, { item: item.id })}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={rowClass(active, 'forest', 'flex flex-col items-start gap-2.5 rounded-[10px] p-[17px]')}
            >
              <Badge tone={badge.tone}>{badge.label}</Badge>
              <span className="w-full text-[15px] leading-[1.5] font-semibold break-words text-ink">{item.title}</span>
              <span className="w-full text-[13px] leading-[1.5] text-muted">
                № {item.number} · {item.sellerName} · {formatQueueTime(item.submittedAt)}
                {!item.contactPhoneVerified && <span className="text-danger"> · nömrə təsdiqlənməyib</span>}
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
 * the signed-in moderator or admin; anyone else is asked to sign in or told the page is for staff. Filters, the page
 * and the open listing are links (the address keeps them); the decision is the one client island.
 */
export default async function ApiModerationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = readModerationParams(await searchParams)
  const me = await getRepository().getMe()
  if (!me) return <SignInPrompt next={moderationHref(state)} />
  if (me.role !== 'moderator' && me.role !== 'admin') return <NotStaff />

  const queue = await adminRepository.moderationQueue(toModerationQuery(state))
  const chosen = state.item ? (queue.items.find((i) => i.id === state.item) ?? (await adminRepository.moderationItem(state.item))) : queue.items[0]
  const done = state.done ? await adminRepository.moderationItem(state.done.listingId) : undefined
  const { totals } = queue
  const listHref = moderationHref(state, { item: undefined })

  return (
    <AdminPage title="Elan moderasiyası" subtitle={`${totals.pending} gözləyən elan · ${totals.recheck} təkrar yoxlama · Moderator: ${me.fullName}`}>
      <nav aria-label="Elan vəziyyəti" className="flex w-full flex-wrap items-start gap-2">
        {statusChips.map((chip) => (
          <Link key={chip.value} href={moderationHref(state, { status: chip.value })} aria-current={state.status === chip.value ? 'page' : undefined} className={chipClass(state.status === chip.value)}>
            {chip.label} · {chip.total(totals)}
          </Link>
        ))}
      </nav>

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Yoxlamanın növü">
          {kindChips.map((chip) => (
            <Link key={chip.label} href={moderationHref(state, { kind: chip.value })} aria-current={state.kind === chip.value ? 'true' : undefined} className={chipClass(state.kind === chip.value)}>
              {chip.label}
            </Link>
          ))}
          {sortChips.map((chip) => (
            <Link key={chip.value} href={moderationHref(state, { sort: chip.value })} aria-current={state.sort === chip.value ? 'true' : undefined} className={chipClass(state.sort === chip.value)}>
              {chip.label}
            </Link>
          ))}
        </div>
        <form action={BASE} role="search" className="flex w-full gap-2 lg:w-auto">
          {state.status !== 'pending' && <input type="hidden" name="status" value={state.status} />}
          {state.kind && <input type="hidden" name="kind" value={state.kind} />}
          {state.sort !== 'newest' && <input type="hidden" name="sort" value={state.sort} />}
          <label htmlFor="moderation-q" className="sr-only">
            Elan nömrəsi və ya başlıq
          </label>
          <input
            id="moderation-q"
            name="q"
            type="search"
            defaultValue={state.q}
            placeholder="Elan № və ya başlıq"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus-visible:border-forest focus-visible:outline-none lg:w-[260px]"
          />
          <button type="submit" className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-forest px-4 text-sm font-semibold text-white hover:bg-forest-hover">
            <Search aria-hidden size={16} strokeWidth={2} />
            Axtar
          </button>
        </form>
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section aria-labelledby="moderation-queue-title" className="flex w-full min-w-0 flex-col gap-3">
          <h2 id="moderation-queue-title" className="sr-only">
            Moderasiya növbəsi
          </h2>
          <Queue state={state} queue={queue} selected={chosen?.id} />
          {queue.pageCount > 1 && (
            <PaginationLinks page={queue.page} pageCount={queue.pageCount} basePath={BASE} query={moderationHref(state, { page: 1, item: undefined }).split('?')[1] ?? ''} />
          )}
        </section>

        <div className="flex w-full min-w-0 flex-col items-start gap-5">
          {done && state.done && (
            <Notice tone={state.done.decision === 'approve' ? 'success' : 'danger'} title={state.done.decision === 'approve' ? 'Elan təsdiqləndi' : 'Elan rədd edildi'}>
              {state.done.decision === 'approve'
                ? `“${done.title}” aktiv oldu və ictimai axtarışda görünür.`
                : `“${done.title}” satıcıya qaytarıldı.${done.listing.rejectionReasonCode ? ` Səbəb: ${rejectionReasonLabels[done.listing.rejectionReasonCode]}.` : ''}`}
            </Notice>
          )}

          {chosen ? (
            <ModerationDecision
              key={`${chosen.id}:${chosen.version}`}
              listingId={chosen.id}
              title={chosen.title}
              version={chosen.version}
              pending={chosen.status === 'pending'}
              afterHref={listHref}
              review={<Review item={chosen} />}
            />
          ) : (
            <Panel className="w-full">
              <PanelTitle subtitle="Yoxlamaq üçün növbədən elan seçin.">Elan seçilməyib</PanelTitle>
            </Panel>
          )}

          <InfoNotice title="Moderasiya qeydi">
            Təsdiqdən sonra elan 30 gün aktiv olur və ictimai axtarışda görünür. Rədd edilərsə, satıcı səbəbi şəxsi kabinetdə görür.
          </InfoNotice>
        </div>
      </div>
    </AdminPage>
  )
}
