'use client'

import { useMemo, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { useMyListings, useSession } from '@/state/store'
import { categories } from '@/data/categories'
import { moderationSortOptions, moderatorName, rejectionReasons, type ModerationStatus } from '@/data/admin'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { InfoNotice, Notice, type NoticeTone } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { AdminPage, Chip, PanelTitle } from '@/features/admin/AdminUi'
import { formatQueueTime, revealWhenStacked, rowClass, useAdminState } from '@/features/admin/lib'
import { buildQueue, moderationCounts, type ModerationDecision, type QueueEntry } from '@/features/admin/moderation'
import { formatPrice } from '@/lib/format'

type SortValue = (typeof moderationSortOptions)[number]['value']

const statusChips: Array<{ value: ModerationStatus; label: string }> = [
  { value: 'pending', label: 'Gözləyən' },
  { value: 'approved', label: 'Təsdiqlənmiş' },
  { value: 'rejected', label: 'Rədd edilmiş' },
]

function entryBadge(entry: QueueEntry): { tone: BadgeTone; label: string } {
  if (entry.status === 'approved') return { tone: 'success', label: 'Aktiv' }
  if (entry.status === 'rejected') return { tone: 'danger', label: 'Rədd edilib' }
  return { tone: 'warning', label: entry.kind === 'recheck' ? 'Təkrar yoxlama' : 'Yoxlamada' }
}

const TEXT_ERROR = 'Rədd etmək üçün aydın izah yazılmalıdır.'
const REASON_ERROR = 'Rədd səbəbini seçin.'

/** Figma "İdarəetmə · Moderasiya · 1440" — listing moderation queue and review. */
export default function ModerationPage() {
  const { submitted, updateListing } = useMyListings()
  const { user } = useSession()

  const [decisions, setDecisions] = useAdminState<Record<string, ModerationDecision>>('moderation:decisions', () => ({}))
  const [statusFilter, setStatusFilter] = useAdminState<ModerationStatus>('moderation:status', () => 'pending')
  const [category, setCategory] = useAdminState('moderation:category', () => '')
  const [sort, setSort] = useAdminState<SortValue>('moderation:sort', () => 'newest')
  const [selectedKey, setSelectedKey] = useAdminState<string | null>('moderation:selected', () => 'figma:mod-10524')
  const [notice, setNotice] = useState<{ tone: NoticeTone; title: string; body: string } | null>(null)

  const [reason, setReason] = useState('')
  const [explanation, setExplanation] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)

  const detailRef = useRef<HTMLDivElement>(null)
  const rejectRef = useRef<HTMLDivElement>(null)

  const entries = useMemo(() => buildQueue(submitted, decisions, user?.fullName ?? ''), [submitted, decisions, user])
  const counts = moderationCounts(entries)

  const visible = useMemo(() => {
    const list = entries.filter((e) => e.status === statusFilter && (!category || e.categoryId === category))
    const time = (e: QueueEntry) => Date.parse(e.submittedAt) || 0
    return list.sort((a, b) => (sort === 'oldest' ? time(a) - time(b) : time(b) - time(a)))
  }, [entries, statusFilter, category, sort])

  const selected = visible.find((e) => e.key === selectedKey) ?? visible[0]

  const resetRejectForm = () => {
    setReason('')
    setExplanation('')
    setRejectTouched(false)
  }

  const select = (key: string, reveal = false) => {
    if (key !== selected?.key) resetRejectForm()
    setSelectedKey(key)
    setNotice(null)
    if (reveal) requestAnimationFrame(() => revealWhenStacked(detailRef.current))
  }

  const decide = (entry: QueueEntry, decision: ModerationDecision) => {
    setDecisions((prev) => ({ ...prev, [entry.key]: decision }))
    entry.submittedIds.forEach((id) => updateListing(id, { status: decision.status === 'approved' ? 'active' : 'rejected' }))
    resetRejectForm()
  }

  const approve = (entry: QueueEntry) => {
    decide(entry, { status: 'approved' })
    setNotice({ tone: 'success', title: 'Elan təsdiqləndi', body: `“${entry.title}” aktiv oldu və ictimai axtarışda görünür.` })
  }

  const trimmed = explanation.trim()
  const canReject = Boolean(reason && trimmed)
  const textError = rejectTouched && !trimmed ? TEXT_ERROR : undefined
  const reasonError = rejectTouched && trimmed && !reason ? REASON_ERROR : undefined

  const startReject = () => {
    setRejectTouched(true)
    rejectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const confirmReject = (entry: QueueEntry) => {
    if (!canReject) return setRejectTouched(true)
    decide(entry, { status: 'rejected', reason, explanation: trimmed })
    setNotice({ tone: 'danger', title: 'Elan rədd edildi', body: `“${entry.title}” satıcıya qaytarıldı. Səbəb: ${reason}.` })
  }

  const badge = selected ? entryBadge(selected) : undefined

  return (
    <AdminPage
      title="Elan moderasiyası"
      subtitle={`${counts.pending} gözləyən elan · ${counts.recheck} təkrar yoxlama · Moderator: ${moderatorName}`}
    >
      <div role="group" aria-label="Elan vəziyyəti" className="flex w-full flex-wrap items-start gap-2">
        {statusChips.map((chip) => (
          <Chip
            key={chip.value}
            active={statusFilter === chip.value}
            onClick={() => {
              setStatusFilter(chip.value)
              setNotice(null)
            }}
          >
            {chip.label} · {counts[chip.value]}
          </Chip>
        ))}
      </div>

      <div className="grid w-full gap-3 md:grid-cols-2">
        <SelectField
          label="Kateqoriya seçin"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[{ value: '', label: 'Bütün kateqoriyalar' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          containerClassName="w-full"
        />
        <SelectField
          label="Sıralama seçin"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortValue)}
          options={[...moderationSortOptions]}
          containerClassName="w-full"
        />
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section aria-labelledby="moderation-queue-title" className="flex w-full min-w-0 flex-col gap-3">
          <h2 id="moderation-queue-title" className="sr-only">
            Moderasiya növbəsi
          </h2>
          {visible.length === 0 ? (
            <p className="w-full rounded-[10px] border border-line bg-surface p-[17px] text-sm leading-[1.5] text-muted">
              Bu bölmədə elan yoxdur.
            </p>
          ) : (
            <ul className="flex w-full flex-col gap-3">
              {visible.map((entry) => {
                const isSelected = entry.key === selected?.key
                const b = entryBadge(entry)
                return (
                  <li key={entry.key}>
                    <article
                      onClick={() => select(entry.key)}
                      className={rowClass(isSelected, 'forest', 'flex cursor-pointer flex-col items-start gap-2.5 rounded-[10px] p-[17px]')}
                    >
                      <Badge tone={b.tone}>{b.label}</Badge>
                      <h3 className="w-full text-[15px] leading-[1.5] font-semibold text-ink">{entry.title}</h3>
                      <p className="w-full text-[13px] leading-[1.5] text-muted">
                        {[entry.number != null ? `№ ${entry.number}` : undefined, entry.sellerName, formatQueueTime(entry.submittedAt)]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <Button
                        variant="secondary"
                        aria-pressed={isSelected}
                        aria-label={`Yoxla: ${entry.title}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          select(entry.key, true)
                        }}
                      >
                        Yoxla
                      </Button>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div ref={detailRef} className="flex w-full min-w-0 scroll-mt-4 flex-col items-start gap-5">
          {notice && (
            <Notice tone={notice.tone} title={notice.title}>
              {notice.body}
            </Notice>
          )}

          {selected && badge ? (
            <>
              <Panel aria-labelledby="review-title" className="w-full">
                <div className="flex w-full items-start gap-3">
                  <h2 id="review-title" className="min-w-0 flex-1 text-[23px] leading-[1.35] font-normal text-ink">
                    {selected.title}
                  </h2>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
                {selected.review.image && (
                  <img
                    src={selected.review.image}
                    alt={selected.title}
                    className="h-[220px] w-full rounded-lg object-cover md:h-[280px]"
                  />
                )}
                <p className="w-full text-[22px] leading-[1.5] font-semibold text-ink md:text-[26px]">
                  {[selected.review.price != null ? formatPrice(selected.review.price) : undefined, selected.number != null ? `Elan № ${selected.number}` : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {selected.review.details && <p className="w-full text-sm leading-[1.5] text-ink">{selected.review.details}</p>}
                {selected.review.description && <p className="w-full text-sm leading-[1.5] text-ink">{selected.review.description}</p>}
                {selected.review.seller && <p className="w-full text-[13px] leading-[1.5] text-muted">{selected.review.seller}</p>}
                {selected.review.checks && selected.review.checks.length > 0 && (
                  <p className="w-full text-[13px] leading-[1.5] text-ink">{selected.review.checks.map((c) => `✓ ${c}`).join(' · ')}</p>
                )}
                {selected.status === 'rejected' && selected.decision?.reason && (
                  <p className="w-full text-[13px] leading-[1.5] text-danger">
                    Rədd səbəbi: {selected.decision.reason}. {selected.decision.explanation}
                  </p>
                )}
                {selected.status === 'pending' && (
                  <div className="flex w-full flex-col gap-3 sm:flex-row">
                    <Button
                      className="sm:flex-1"
                      icon={<Check aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
                      onClick={() => approve(selected)}
                    >
                      Təsdiqlə və dərc et
                    </Button>
                    <Button variant="danger" className="sm:flex-1" onClick={startReject}>
                      Rədd et
                    </Button>
                  </div>
                )}
              </Panel>

              {selected.status === 'pending' && (
                <div ref={rejectRef} className="w-full scroll-mt-4">
                  <Panel aria-labelledby="reject-title" className="w-full">
                    <PanelTitle id="reject-title" subtitle="Yalnız elan rədd edildikdə doldurulur. Səbəb satıcıya göndərilir.">
                      Rədd səbəbi
                    </PanelTitle>
                    <SelectField
                      label="Səbəb seçin"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      options={[{ value: '', label: 'Səbəb seçilməyib' }, ...rejectionReasons.map((r) => ({ value: r, label: r }))]}
                      error={reasonError}
                      containerClassName="w-full"
                    />
                    <TextAreaField
                      label="Satıcı üçün izah"
                      placeholder="Düzəliş tələb olunan məqamı qeyd edin"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      error={textError}
                      containerClassName="w-full"
                    />
                    <Button variant="danger" disabled={!canReject} onClick={() => confirmReject(selected)}>
                      Rədd qərarını təsdiqlə
                    </Button>
                  </Panel>
                </div>
              )}
            </>
          ) : (
            <Panel className="w-full">
              <PanelTitle subtitle="Yoxlamaq üçün növbədən elan seçin.">Elan seçilməyib</PanelTitle>
            </Panel>
          )}

          <InfoNotice title="Moderasiya qeydi">
            Təsdiqdən sonra elan aktiv olur və ictimai axtarışda görünür. Rədd edilərsə, satıcı səbəbi şəxsi kabinetdə görür.
          </InfoNotice>
        </div>
      </div>
    </AdminPage>
  )
}
