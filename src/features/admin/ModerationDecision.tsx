'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { Panel } from '@/components/ui/Panel'
import { rejectionReasonCodes, rejectionReasonLabels } from '@/features/listing/rejection'
import type { RejectionReasonCode } from '@/types'
import { decideModeration } from './actions'
import { PanelTitle } from './AdminUi'

const TEXT_ERROR = 'Rədd etmək üçün aydın izah yazılmalıdır.'
const REASON_ERROR = 'Rədd səbəbini seçin.'

interface Props {
  listingId: string
  title: string
  /** The item's version as shown: the decision is refused when the listing changed since */
  version: string
  /** Only a pending listing is decided; the others show the review alone */
  pending: boolean
  /** The queue's address after the decision (the notice is added to it) */
  afterHref: string
  /** The review panel's content, rendered on the server */
  review: ReactNode
}

/**
 * DATA_SOURCE=api: the review panel with «Təsdiqlə və dərc et» and «Rədd et», and the «Rədd səbəbi» form (a reason
 * code and a note for the seller; both required, as on the demo's page). The decision goes to the API with the version
 * the moderator saw; the queue then reloads with a notice. A listing changed meanwhile is shown again, newer.
 */
export function ModerationDecision({ listingId, title, version, pending, afterHref, review }: Props) {
  const router = useRouter()
  const [reason, setReason] = useState<RejectionReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState<'approve' | 'reject' | null>(null)
  const [, startTransition] = useTransition()
  const rejectRef = useRef<HTMLDivElement>(null)

  const trimmed = note.trim()
  const canReject = Boolean(reason && trimmed)
  const textError = touched && !trimmed ? TEXT_ERROR : undefined
  const reasonError = touched && trimmed && !reason ? REASON_ERROR : undefined

  const send = async (decision: 'approve' | 'reject') => {
    if (sending) return
    setSending(decision)
    setError(undefined)
    const result = await decideModeration(listingId, decision === 'approve' ? { decision, version } : { decision, reasonCode: reason || undefined, note: trimmed, version }).catch(() => ({
      ok: false as const,
      error: 'Qərarı göndərmək alınmadı. İnternet bağlantısını yoxlayın.',
      stale: false,
    }))
    if (!result.ok) {
      setSending(null)
      setError(result.error)
      // The listing changed meanwhile: the page shows it as it is now (and its new version).
      if (result.stale) startTransition(() => router.refresh())
      return
    }
    const separator = afterHref.includes('?') ? '&' : '?'
    startTransition(() => router.replace(`${afterHref}${separator}done=${encodeURIComponent(listingId)}&decision=${decision}`, { scroll: false }))
  }

  return (
    <>
      <Panel aria-labelledby="review-title" className="w-full">
        {review}
        {error && (
          <Notice tone="danger" title="Qərar göndərilmədi">
            {error}
          </Notice>
        )}
        {pending && (
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button
              className="sm:flex-1"
              disabled={sending !== null}
              aria-busy={sending === 'approve'}
              icon={<Check aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
              onClick={() => void send('approve')}
            >
              {sending === 'approve' ? 'Təsdiqlənir…' : 'Təsdiqlə və dərc et'}
            </Button>
            <Button
              variant="danger"
              className="sm:flex-1"
              disabled={sending !== null}
              onClick={() => {
                setTouched(true)
                rejectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              Rədd et
            </Button>
          </div>
        )}
      </Panel>

      {pending && (
        <div ref={rejectRef} className="w-full scroll-mt-4">
          <Panel aria-labelledby="reject-title" className="w-full">
            <PanelTitle id="reject-title" subtitle="Yalnız elan rədd edildikdə doldurulur. Səbəb satıcıya göndərilir.">
              Rədd səbəbi
            </PanelTitle>
            <SelectField
              label="Səbəb seçin"
              value={reason}
              onChange={(e) => setReason(e.target.value as RejectionReasonCode | '')}
              options={[{ value: '', label: 'Səbəb seçilməyib' }, ...rejectionReasonCodes.map((code) => ({ value: code, label: rejectionReasonLabels[code] }))]}
              error={reasonError}
              containerClassName="w-full"
            />
            <TextAreaField
              label="Satıcı üçün izah"
              placeholder="Düzəliş tələb olunan məqamı qeyd edin"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              error={textError}
              containerClassName="w-full"
            />
            <Button
              variant="danger"
              disabled={!canReject || sending !== null}
              aria-busy={sending === 'reject'}
              aria-label={`Rədd qərarını təsdiqlə: ${title}`}
              onClick={() => (canReject ? void send('reject') : setTouched(true))}
            >
              {sending === 'reject' ? 'Göndərilir…' : 'Rədd qərarını təsdiqlə'}
            </Button>
          </Panel>
        </div>
      )}
    </>
  )
}
