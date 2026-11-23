'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CharCount, SelectField, TextAreaField } from '@/components/ui/Field'
import { InfoNotice, Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import type { ComplaintStatus, ReportItem, ReportOwner, ReportResolution, ReportSeller } from '@/types'
import { setAccountBlocked, setSellerVerified, updateReportStatus } from './actions'
import { PanelTitle } from './AdminUi'
import { complaintStatuses, complaintStatusLabels, reportResolutions, resolutionLabels, suggestedStatus, type ReportDone } from './reportsApi'

const NOTE_MAX = 500
const NETWORK = 'Göndərmək alınmadı. İnternet bağlantısını yoxlayın.'

interface Props {
  report: Pick<ReportItem, 'id' | 'status' | 'resolution'>
  /** The account behind the target: blocking it (admins) */
  owner?: ReportOwner
  /** A reported seller: «Təsdiqlənmiş satıcı» (admins) */
  seller?: ReportSeller
  admin: boolean
  /** This report's address; the notice is added to it after a change */
  afterHref: string
}

/**
 * DATA_SOURCE=api: «Araşdırma və qərar» of one report: a status, a resolution to close it, a note for the history.
 * Admins also block (or unblock) the account behind the target, after a confirmation, and verify a reported seller.
 * Each change goes through a Server Action; the page then reloads with a notice.
 */
export function ReportDecision({ report, owner, seller, admin, afterHref }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<ComplaintStatus>(suggestedStatus(report.status))
  const [resolution, setResolution] = useState<ReportResolution | ''>(report.resolution ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [resolutionError, setResolutionError] = useState<string>()
  const [busy, setBusy] = useState<'report' | 'close' | 'account' | 'verify' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [, startTransition] = useTransition()

  const blocked = owner?.status === 'blocked'
  const trimmed = note.trim()
  const canApply = status !== report.status || (status === 'resolved' && resolution !== (report.resolution ?? '')) || Boolean(trimmed)

  const done = (what: ReportDone) => {
    const separator = afterHref.includes('?') ? '&' : '?'
    startTransition(() => router.replace(`${afterHref}${separator}done=${what}`, { scroll: false }))
  }

  const send = async (next: ComplaintStatus, which: 'report' | 'close') => {
    if (busy) return
    if (next === 'resolved' && !resolution) {
      setStatus('resolved')
      setResolutionError('Şikayəti bağlamaq üçün nəticəni seçin.')
      return
    }
    setBusy(which)
    setError(undefined)
    const changed = next !== report.status || (next === 'resolved' && resolution !== report.resolution)
    const result = await updateReportStatus(report.id, {
      ...(changed ? { status: next } : {}),
      ...(changed && next === 'resolved' && resolution ? { resolution } : {}),
      ...(trimmed ? { note: trimmed } : {}),
    }).catch(() => ({ ok: false as const, error: NETWORK }))
    setBusy(null)
    if (!result.ok) return setError(result.error)
    done('report')
  }

  const toggleBlock = async () => {
    if (!owner || busy) return
    setBusy('account')
    setError(undefined)
    const result = await setAccountBlocked(owner.userId, !blocked, reason.trim() || undefined).catch(() => ({ ok: false as const, error: NETWORK }))
    setBusy(null)
    setConfirmOpen(false)
    if (!result.ok) return setError(result.error)
    done(blocked ? 'unblocked' : 'blocked')
  }

  const toggleVerified = async () => {
    if (!seller || busy) return
    setBusy('verify')
    setError(undefined)
    const result = await setSellerVerified(seller.id, !seller.verified).catch(() => ({ ok: false as const, error: NETWORK }))
    setBusy(null)
    if (!result.ok) return setError(result.error)
    done(seller.verified ? 'unverified' : 'verified')
  }

  return (
    <>
      <Panel aria-labelledby="decision-title" className="w-full">
        <PanelTitle id="decision-title">Araşdırma və qərar</PanelTitle>
        <SelectField
          label="Vəziyyət seçin"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ComplaintStatus)
            setResolutionError(undefined)
          }}
          options={complaintStatuses.map((s) => ({ value: s, label: complaintStatusLabels[s] }))}
          containerClassName="w-full"
        />
        {status === 'resolved' && (
          <SelectField
            label="Nəticə"
            value={resolution}
            error={resolutionError}
            onChange={(e) => {
              setResolution(e.target.value as ReportResolution | '')
              setResolutionError(undefined)
            }}
            options={[{ value: '', label: 'Seçin' }, ...reportResolutions.map((r) => ({ value: r, label: resolutionLabels[r] }))]}
            containerClassName="w-full"
          />
        )}
        <TextAreaField
          label="Moderator qeydi"
          optional
          hint="Qeyd qərar tarixçəsinə yazılır."
          value={note}
          maxLength={NOTE_MAX}
          aside={<CharCount value={note} max={NOTE_MAX} />}
          onChange={(e) => setNote(e.target.value)}
          containerClassName="w-full"
        />
        {error && (
          <Notice tone="danger" title="Göndərilmədi">
            {error}
          </Notice>
        )}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button disabled={!canApply || busy !== null} aria-busy={busy === 'report'} onClick={() => void send(status, 'report')}>
            {busy === 'report' ? 'Göndərilir…' : status === 'investigating' && report.status !== 'investigating' ? 'Araşdırmaya götür' : 'Yadda saxla'}
          </Button>
          <Button variant="secondary" disabled={report.status === 'resolved' || busy !== null} aria-busy={busy === 'close'} onClick={() => void send('resolved', 'close')}>
            {busy === 'close' ? 'Bağlanır…' : 'Şikayəti bağla'}
          </Button>
        </div>
      </Panel>

      {owner &&
        (admin ? (
          <Panel aria-labelledby="account-title" className="w-full">
            <PanelTitle id="account-title" subtitle={`${owner.name} · ${owner.accountType === 'business' ? 'biznes hesabı' : 'fərdi hesab'}${blocked ? ' · bloklanıb' : ''}`}>
              Hesab
            </PanelTitle>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
              {seller && (
                <Button variant="secondary" disabled={busy !== null} aria-busy={busy === 'verify'} onClick={() => void toggleVerified()}>
                  {busy === 'verify' ? 'Göndərilir…' : seller.verified ? 'Təsdiqi götür' : 'Satıcını təsdiqlə'}
                </Button>
              )}
              <Button variant={blocked ? 'secondary' : 'danger'} disabled={busy !== null} aria-haspopup="dialog" onClick={() => setConfirmOpen(true)}>
                {blocked ? 'Bloku aç' : 'Hesabı blokla'}
              </Button>
            </div>
          </Panel>
        ) : (
          <InfoNotice title="Hesab">Hesabı bloklamaq və satıcını təsdiqləmək yalnız adminə açıqdır.</InfoNotice>
        ))}

      {owner && (
        <Dialog open={confirmOpen} title={blocked ? 'Bloku açmaq istəyirsiniz?' : 'Hesabı bloklamaq istəyirsiniz?'} onClose={() => setConfirmOpen(false)}>
          <p className="text-[15px] leading-[1.5] text-ink">
            {blocked
              ? `“${owner.name}” yenidən daxil ola biləcək. Bloklananda saytdan çıxarılan elanları geri qayıdacaq (müddəti bitənlər «Müddəti bitib» olacaq).`
              : `“${owner.name}” hesabının bütün sessiyaları bağlanacaq, aktiv elanları saytdan çıxarılacaq və hesaba daxil olmaq mümkün olmayacaq. Bloku açanda elanlar geri qayıdır.`}
          </p>
          <TextAreaField label="Səbəb" optional value={reason} maxLength={NOTE_MAX} onChange={(e) => setReason(e.target.value)} containerClassName="w-full" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant={blocked ? 'primary' : 'danger'} className="sm:flex-1" disabled={busy !== null} aria-busy={busy === 'account'} onClick={() => void toggleBlock()}>
              {busy === 'account' ? 'Göndərilir…' : blocked ? 'Bloku aç' : 'Hesabı blokla'}
            </Button>
            <Button variant="secondary" className="sm:flex-1" onClick={() => setConfirmOpen(false)}>
              Ləğv et
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
