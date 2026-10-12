import { useRef, useState } from 'react'
import { complaintStatusLabels, type ComplaintStatus } from '@/data/admin'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Panel } from '@/components/ui/Panel'
import { AdminPage, Chip, InfoNote, PanelTitle } from '@/features/admin/AdminUi'
import {
  complaintCounts,
  complaintListing,
  complaintListingMeta,
  complaintStatuses,
  initialComplaints,
  statusChangeText,
  suggestedStatus,
  type ComplaintState,
} from '@/features/admin/complaints'
import { historyTimestamp, revealWhenStacked, rowClass, useAdminState } from '@/features/admin/lib'
import { formatFullDate, formatPrice } from '@/lib/format'

const statusTone: Record<ComplaintStatus, BadgeTone> = { open: 'warning', investigating: 'warning', resolved: 'success' }

/** Figma "İdarəetmə · Şikayətlər · 1440" — complaint handling. */
export default function ComplaintsPage() {
  const [items, setItems] = useAdminState<ComplaintState[]>('complaints:items', initialComplaints)
  /** null = every status (the Figma list shows all three complaints) */
  const [filter, setFilter] = useAdminState<ComplaintStatus | null>('complaints:filter', () => null)
  const [selectedId, setSelectedId] = useAdminState<string | null>('complaints:selected', () => 's-184')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const detailRef = useRef<HTMLDivElement>(null)

  const counts = complaintCounts(items)
  const visible = items.filter((c) => !filter || c.status === filter)
  const selected = visible.find((c) => c.id === selectedId) ?? visible[0]

  const [draftStatus, setDraftStatus] = useState<ComplaintStatus>(() => suggestedStatus(selected?.status ?? 'open'))
  const [draftNote, setDraftNote] = useState(selected?.note ?? '')
  const [draftFor, setDraftFor] = useState(selected?.id)

  // Reset the decision form whenever another complaint is shown (render-time sync, no effect needed).
  if (selected?.id !== draftFor) {
    setDraftFor(selected?.id)
    setDraftStatus(suggestedStatus(selected?.status ?? 'open'))
    setDraftNote(selected?.note ?? '')
  }

  const select = (id: string, reveal = false) => {
    setSelectedId(id)
    if (reveal) requestAnimationFrame(() => revealWhenStacked(detailRef.current))
  }

  /** Applies a decision: new status, optional suspension, and one "Qərar tarixçəsi" entry. */
  const decide = (c: ComplaintState, status: ComplaintStatus, text: string, extra: Partial<ComplaintState> = {}) => {
    const note = draftNote.trim()
    const noteChanged = note !== (c.note ?? '').trim()
    const entry = { time: historyTimestamp(), text: noteChanged && note ? `${text} Moderator qeydi: ${note}` : text }
    setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...extra, status, note, history: [...x.history, entry] } : x)))
    setDraftStatus(suggestedStatus(status))
    setDraftNote(note)
  }

  const applyDraft = (c: ComplaintState) => {
    const statusChanged = draftStatus !== c.status
    decide(c, draftStatus, statusChanged ? statusChangeText[draftStatus] : 'Moderator qeydi yeniləndi.')
  }

  const toggleFilter = (status: ComplaintStatus) => setFilter((f) => (f === status ? null : status))

  const listing = selected ? complaintListing(selected) : undefined
  const noteDirty = selected ? draftNote.trim() !== (selected.note ?? '').trim() : false
  const canApply = selected ? draftStatus !== selected.status || noteDirty : false
  const closingNote = selected?.listingSuspended
    ? 'Elan dayandırılıb və ictimai axtarışda görünmür.'
    : selected?.status !== 'resolved'
      ? selected?.listingNote
      : undefined

  return (
    <AdminPage
      title="Şikayətlərin idarə olunması"
      subtitle={`${counts.open} açıq şikayət · ${counts.investigating} araşdırılır · ${counts.resolved} həll olunub`}
    >
      <div role="group" aria-label="Şikayət vəziyyəti" className="flex w-full flex-wrap items-start gap-2">
        {complaintStatuses.map((status) => (
          <Chip key={status} active={filter === status} onClick={() => toggleFilter(status)}>
            {complaintStatusLabels[status]} · {counts[status]}
          </Chip>
        ))}
      </div>

      <div className="grid w-full items-start gap-6 xl:grid-cols-[480px_minmax(0,1fr)]">
        <section aria-labelledby="complaint-list-title" className="flex w-full min-w-0 flex-col">
          <h2 id="complaint-list-title" className="sr-only">
            Şikayət siyahısı
          </h2>
          {visible.length === 0 ? (
            <p className="w-full rounded-xl border border-line bg-surface p-[19px] text-sm leading-[1.5] text-muted">
              Bu vəziyyətdə şikayət yoxdur.
            </p>
          ) : (
            <ul className="flex w-full flex-col gap-3.5">
              {visible.map((c) => {
                const isSelected = c.id === selected?.id
                const l = complaintListing(c)
                return (
                  <li key={c.id}>
                    <article
                      onClick={() => select(c.id)}
                      className={rowClass(isSelected, 'line', 'flex cursor-pointer flex-col items-start gap-2.5 rounded-xl p-[19px]')}
                    >
                      <Badge tone={statusTone[c.status]}>{complaintStatusLabels[c.status]}</Badge>
                      <h3 className="w-full text-[15px] leading-[1.5] font-semibold text-ink">{c.reason}</h3>
                      <p className="w-full text-[13px] leading-[1.5] text-muted">
                        {[c.code, `Elan № ${c.listingNumber}`, l?.title, c.complainant, formatFullDate(c.createdAt)].filter(Boolean).join(' · ')}
                      </p>
                      <Button
                        variant="secondary"
                        aria-pressed={isSelected}
                        aria-label={`Araşdır: ${c.code}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          select(c.id, true)
                        }}
                      >
                        Araşdır
                      </Button>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div ref={detailRef} className="flex w-full min-w-0 scroll-mt-4 flex-col items-start gap-6">
          {selected ? (
            <>
              <Panel aria-labelledby="complaint-title" className="w-full">
                <h2 id="complaint-title" className="w-full text-[23px] leading-[1.35] font-normal text-ink">
                  {selected.code} · {selected.reason}
                </h2>
                <p className="w-full text-sm leading-[1.5] text-ink">
                  Şikayətçi: {selected.complainant}.{selected.message && ` “${selected.message}”`}
                </p>
                <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start">
                  {(selected.image ?? listing?.cover) && (
                    <img
                      src={selected.image ?? listing?.cover}
                      alt={listing?.title ?? `Elan № ${selected.listingNumber}`}
                      className="h-[180px] w-full shrink-0 rounded-lg object-cover sm:w-[200px]"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                    <h3 className="w-full text-[23px] leading-[1.35] font-normal text-ink">{listing?.title ?? `Elan № ${selected.listingNumber}`}</h3>
                    {listing && <p className="text-2xl leading-[1.5] font-semibold whitespace-nowrap text-ink">{formatPrice(listing.price)}</p>}
                    <p className="w-full text-[13px] leading-[1.5] text-ink">{complaintListingMeta(selected, listing)}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {listing && (
                        <ButtonLink variant="secondary" to={`/elanlar/${listing.slug}`}>
                          Elanı aç
                        </ButtonLink>
                      )}
                      {selected.listingSuspended && <Badge tone="danger">Dayandırılıb</Badge>}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel aria-labelledby="decision-title" className="w-full">
                <PanelTitle id="decision-title">Araşdırma və qərar</PanelTitle>
                <SelectField
                  label="Vəziyyət seçin"
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as ComplaintStatus)}
                  options={complaintStatuses.map((s) => ({ value: s, label: complaintStatusLabels[s] }))}
                  containerClassName="w-full"
                />
                <TextAreaField
                  label="Moderator qeydi"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  containerClassName="w-full"
                />
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button disabled={!canApply} onClick={() => applyDraft(selected)}>
                    {draftStatus === 'investigating' ? 'Araşdırmaya götür' : 'Yadda saxla'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={selected.status === 'resolved'}
                    onClick={() => decide(selected, 'resolved', statusChangeText.resolved)}
                  >
                    Şikayəti bağla
                  </Button>
                  <Button variant="danger" disabled={selected.listingSuspended} onClick={() => setConfirmOpen(true)}>
                    Elanı dayandır
                  </Button>
                </div>
              </Panel>

              <InfoNote title="Qərar tarixçəsi">
                <div aria-live="polite">
                  {selected.history.length === 0 && !closingNote ? (
                    'Qərar hələ qeydə alınmayıb.'
                  ) : (
                    <>
                      <ol className="inline">
                        {selected.history.map((h, i) => (
                          <li key={i} className="inline">
                            {h.time} — {h.text}{' '}
                          </li>
                        ))}
                      </ol>
                      {closingNote}
                    </>
                  )}
                </div>
              </InfoNote>

              <Dialog open={confirmOpen} title="Elanı dayandırmaq istəyirsiniz?" onClose={() => setConfirmOpen(false)}>
                <p className="text-[15px] leading-[1.5] text-ink">
                  “{listing?.title ?? 'Elan'}” (Elan № {selected.listingNumber}) ictimai axtarışdan çıxarılacaq və şikayət bağlanacaq. Satıcı
                  qərar barədə bildiriş alacaq.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="danger"
                    className="sm:flex-1"
                    onClick={() => {
                      decide(selected, 'resolved', 'Elan dayandırıldı, şikayət bağlandı.', { listingSuspended: true })
                      setConfirmOpen(false)
                    }}
                  >
                    Elanı dayandır
                  </Button>
                  <Button variant="secondary" className="sm:flex-1" onClick={() => setConfirmOpen(false)}>
                    Ləğv et
                  </Button>
                </div>
              </Dialog>
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
