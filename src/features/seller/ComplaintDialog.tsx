'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button, buttonClass } from '@/components/ui/Button'
import { CharCount, TextAreaField } from '@/components/ui/Field'
import { FieldGroup } from '@/components/ui/FormControls'
import { Notice } from '@/components/ui/Notice'
import { optionClass } from '@/features/search/filterStyles'
import { sendReport } from '@/features/listing/actions'
import type { ReportTarget } from '@/types'
import { OTHER_REASON } from './complaintReasons'

const MAX_LENGTH = 500
const MIN_OTHER = 10

interface ComplaintDialogProps {
  open: boolean
  onClose: () => void
  /** «Elandan şikayət et» / «Satıcıdan şikayət et» */
  title: string
  reasons: string[]
  target: ReportTarget
  targetId: string
}

/**
 * Report a listing, seller or service: one reason (pills, a radio group), an optional comment (required for
 * «Digər səbəb»), then «Göndər». Sends through the `sendReport` Server Action; while it runs the button says
 * «Göndərilir…», an error keeps the form filled, success replaces the form with a confirmation.
 */
export function ComplaintDialog({ open, onClose, title, reasons, target, targetId }: ComplaintDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {/* Mounted only while open, so every opening starts with a fresh form. */}
      <ComplaintForm reasons={reasons} onClose={onClose} target={target} targetId={targetId} />
    </Dialog>
  )
}

function ComplaintForm({ reasons, onClose, target, targetId }: Omit<ComplaintDialogProps, 'open' | 'title'>) {
  const [reason, setReason] = useState('')
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<{ reason?: string; text?: string; form?: string }>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (status === 'sent') closeRef.current?.focus()
  }, [status])

  const validate = (r: string, t: string) => ({
    reason: r ? undefined : 'Səbəbi seçin.',
    text: r === OTHER_REASON && t.trim().length < MIN_OTHER ? `Nə baş verdiyini qısaca yazın (ən azı ${MIN_OTHER} simvol).` : undefined,
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = validate(reason, text)
    setErrors(next)
    if (next.reason || next.text) return
    setStatus('sending')
    const result = await sendReport({ target, targetId, reason, comment: text })
    if (result.ok) setStatus('sent')
    else {
      setStatus('idle')
      setErrors({ form: result.error })
    }
  }

  if (status === 'sent') {
    return (
      <>
        <Notice tone="success" title="Şikayətiniz göndərildi">
          Moderatorlar 24 saat ərzində yoxlayacaq. Qayda pozulubsa, elan saytdan götürüləcək.
        </Notice>
        <button ref={closeRef} type="button" onClick={onClose} className={buttonClass('secondary', 'w-full')}>
          Bağla
        </button>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-5">
      <FieldGroup legend="Səbəb" error={errors.reason}>
        <div className="flex flex-wrap gap-2">
          {reasons.map((r) => (
            <label key={r} className={optionClass(r === reason, true) + ' inline-flex cursor-pointer items-center has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-olive'}>
              <input
                type="radio"
                name="reason"
                value={r}
                checked={r === reason}
                onChange={() => {
                  setReason(r)
                  if (errors.reason || errors.text) setErrors(validate(r, text))
                }}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </div>
      </FieldGroup>
      <TextAreaField
        label="İzah"
        optional={reason !== OTHER_REASON}
        name="details"
        placeholder="Məsələn: zəng etdim, bitkinin satıldığını dedilər."
        value={text}
        maxLength={MAX_LENGTH}
        error={errors.text}
        aside={<CharCount value={text} max={MAX_LENGTH} />}
        onChange={(e) => {
          setText(e.target.value)
          if (errors.text) setErrors((prev) => ({ ...prev, text: validate(reason, e.target.value).text }))
        }}
      />
      {errors.form && (
        <Notice tone="danger" title="Göndərilmədi">
          {errors.form}
        </Notice>
      )}
      <Button type="submit" fullWidth disabled={status === 'sending'} aria-busy={status === 'sending'}>
        {status === 'sending' ? 'Göndərilir…' : 'Şikayəti göndər'}
      </Button>
    </form>
  )
}
