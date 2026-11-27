'use client'

import { useId, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CircleAlert, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { rejectionReasonCodes, rejectionReasonLabels } from '@/features/listing/rejection'
import { cn } from '@/lib/format'
import type { RejectionReasonCode } from '@/types'
import { decideModeration } from './actions'

const TEXT_ERROR = 'Satıcıya nəyi düzəltməli olduğunu yazın.'
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
  /** The review's content, rendered on the server */
  review: ReactNode
}

/**
 * DATA_SOURCE=api: the review with its decision bar. The bar stays at the bottom of the screen while the listing is
 * read; «Təsdiqlə və dərc et» decides at once, «Rədd et» opens the reason and the note for the seller in its place
 * (both required; their errors show only after a try). The decision goes to the API with the version the moderator
 * saw; the queue then reloads with a notice. A listing changed meanwhile is shown again, newer.
 */
export function ModerationDecision({ listingId, title, version, pending, afterHref, review }: Props) {
  const router = useRouter()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState<RejectionReasonCode | ''>('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState<'approve' | 'reject' | null>(null)
  const [, startTransition] = useTransition()
  const reasonsRef = useRef<HTMLFieldSetElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const legendId = useId()
  const noteId = useId()

  const trimmed = note.trim()
  const reasonError = tried && !reason ? REASON_ERROR : undefined
  const textError = tried && !trimmed ? TEXT_ERROR : undefined

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

  const openReject = () => {
    setRejecting(true)
    setError(undefined)
    // The form comes into view and its first reason gets the focus.
    requestAnimationFrame(() => {
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      barRef.current?.scrollIntoView?.({ block: 'end', behavior: still ? 'auto' : 'smooth' })
      reasonsRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }

  const submitReject = () => {
    setTried(true)
    if (!reason) return reasonsRef.current?.querySelector<HTMLInputElement>('input')?.focus()
    if (!trimmed) return document.getElementById(noteId)?.focus()
    void send('reject')
  }

  return (
    <article aria-labelledby="review-title" className="flex w-full min-w-0 flex-col rounded-xl border border-line bg-surface">
      <div className="flex w-full flex-col gap-7 p-5 md:p-7">{review}</div>

      {pending && (
        <div
          ref={barRef}
          className={cn(
            'z-10 scroll-mb-4 rounded-b-xl border-t border-line bg-surface px-5 py-4 md:px-7',
            // Docked while the listing is read; the reject form stays in place at the end, so the listing can be checked again above it.
            rejecting ? 'relative' : 'sticky bottom-0 shadow-dock',
          )}
        >
          {error && (
            <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] leading-[1.45] text-ink">
              <CircleAlert aria-hidden size={16} strokeWidth={2} className="mt-px shrink-0 text-danger" />
              <span>
                <span className="font-semibold">Qərar göndərilmədi. </span>
                {error}
              </span>
            </p>
          )}

          {rejecting ? (
            <div className="flex animate-fade-up flex-col gap-4">
              <fieldset ref={reasonsRef} aria-describedby={reasonError ? `${legendId}-error` : undefined} className="flex flex-col gap-2.5">
                <legend id={legendId} className="mb-2.5 text-[15px] leading-[1.3] font-semibold text-forest">
                  Niyə rədd edilir?
                </legend>
                <div className="flex flex-wrap gap-2">
                  {rejectionReasonCodes.map((code) => (
                    <label
                      key={code}
                      className={cn(
                        'inline-flex min-h-10 cursor-pointer items-center rounded-lg border px-3 text-[13px] leading-[1.3] transition-colors duration-(--dur-fast)',
                        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-olive',
                        reason === code ? 'border-danger bg-danger-soft font-semibold text-danger' : 'border-line-strong bg-surface text-ink hover:border-olive',
                      )}
                    >
                      <input type="radio" name={`reason-${listingId}`} value={code} checked={reason === code} onChange={() => setReason(code)} className="sr-only" />
                      {rejectionReasonLabels[code]}
                    </label>
                  ))}
                </div>
                {reasonError && (
                  <p id={`${legendId}-error`} className="text-[13px] leading-[1.4] font-medium text-danger">
                    {reasonError}
                  </p>
                )}
              </fieldset>

              <TextAreaField
                id={noteId}
                label="Satıcıya izah"
                hint="Satıcı bu mətni kabinetində görəcək. Nəyi düzəltməli olduğunu yazın."
                placeholder="Məsələn: şəkillərdə başqa bitki görünür, öz bitkinizin şəklini əlavə edin."
                value={note}
                maxLength={500}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                error={textError}
                containerClassName="w-full"
              />

              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  disabled={sending !== null}
                  icon={<Undo2 aria-hidden size={17} strokeWidth={1.8} absoluteStrokeWidth />}
                  onClick={() => {
                    setRejecting(false)
                    setTried(false)
                  }}
                >
                  Geri
                </Button>
                <Button variant="danger" disabled={sending !== null} aria-busy={sending === 'reject'} aria-label={`Rədd et və satıcıya göndər: ${title}`} onClick={submitReject}>
                  {sending === 'reject' ? 'Göndərilir…' : 'Rədd et və satıcıya göndər'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-[1.45] text-muted max-sm:hidden">Təsdiqdən sonra elan 30 gün saytda görünür.</p>
              <div className="flex flex-col-reverse gap-2.5 min-[360px]:flex-row sm:shrink-0">
                <Button variant="secondary" className="flex-1 text-danger hover:border-danger sm:flex-none" disabled={sending !== null} onClick={openReject}>
                  Rədd et
                </Button>
                <Button
                  className="flex-[1.6] sm:flex-none"
                  disabled={sending !== null}
                  aria-busy={sending === 'approve'}
                  icon={<Check aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
                  onClick={() => void send('approve')}
                >
                  {sending === 'approve' ? 'Təsdiqlənir…' : 'Təsdiqlə və dərc et'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
