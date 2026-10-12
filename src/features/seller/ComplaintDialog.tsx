import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button, buttonClass } from '@/components/ui/Button'
import { SelectField, TextAreaField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'

const MIN_LENGTH = 10
const MAX_LENGTH = 500

interface ComplaintDialogProps {
  open: boolean
  onClose: () => void
  /** "Elanı şikayət et" / "Satıcını şikayət et" */
  title: string
  /** First option is preselected (Figma shows "Məlumat düzgün deyil"). */
  reasons: string[]
}

/** Figma components frame → "Dialoqlar və bildirişlər" → "Elanı şikayət et". */
export function ComplaintDialog({ open, onClose, title, reasons }: ComplaintDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {/* Mounted only while open, so every opening starts with a fresh form. */}
      <ComplaintForm reasons={reasons} onClose={onClose} />
    </Dialog>
  )
}

function ComplaintForm({ reasons, onClose }: { reasons: string[]; onClose: () => void }) {
  const [reason, setReason] = useState(reasons[0] ?? '')
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])
  useEffect(() => {
    if (status === 'sent') closeRef.current?.focus()
  }, [status])

  const validate = (value: string) => {
    const length = value.trim().length
    if (length === 0) return 'Problemi qısaca təsvir edin.'
    if (length < MIN_LENGTH) return `Ən azı ${MIN_LENGTH} simvol yazın.`
    return undefined
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const message = validate(text)
    setError(message)
    if (message) return
    setStatus('sending')
    // No backend yet — simulate the request round-trip.
    timer.current = window.setTimeout(() => setStatus('sent'), 600)
  }

  if (status === 'sent') {
    return (
      <>
        <Notice tone="success" title="Şikayətiniz göndərildi">
          Moderatorlar şikayəti araşdıracaq. Nəticə haqqında məlumat veriləcək.
        </Notice>
        <button ref={closeRef} type="button" onClick={onClose} className={buttonClass('secondary', 'w-full')}>
          Bağla
        </button>
      </>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex w-full flex-col gap-5">
      <SelectField
        label="Səbəb seçin"
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        options={reasons.map((r) => ({ value: r, label: r }))}
      />
      <TextAreaField
        label="Əlavə izah"
        name="details"
        placeholder="Problemi təsvir edin"
        value={text}
        maxLength={MAX_LENGTH}
        error={error}
        onChange={(e) => {
          setText(e.target.value)
          if (error) setError(validate(e.target.value))
        }}
      />
      <Button type="submit" fullWidth disabled={status === 'sending'} aria-busy={status === 'sending'}>
        {status === 'sending' ? 'Göndərilir…' : 'Şikayəti göndər'}
      </Button>
    </form>
  )
}
