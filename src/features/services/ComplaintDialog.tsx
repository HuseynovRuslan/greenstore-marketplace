import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/Field'

/** Complaint reasons as they appear in Figma (dialog default + "Şikayətlər" moderation queue). */
const reasons = ['Məlumat düzgün deyil', 'Təkrar elan', 'Uyğun olmayan şəkil'].map((r) => ({ value: r, label: r }))

/* Figma components frame "Dialoqlar" → "Elanı şikayət et": reason select, "Əlavə izah" textarea, primary "Şikayəti göndər". */
export function ComplaintDialog({ open, onClose, onSubmitted }: { open: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [reason, setReason] = useState(reasons[0].value)
  const [details, setDetails] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // No backend yet — the complaint would be POSTed here.
    setDetails('')
    setReason(reasons[0].value)
    onSubmitted()
  }

  return (
    <Dialog open={open} title="Elanı şikayət et" onClose={onClose}>
      <form onSubmit={submit} className="flex w-full flex-col gap-5">
        <SelectField label="Səbəb seçin" value={reason} onChange={(e) => setReason(e.target.value)} options={reasons} />
        <TextAreaField
          label="Əlavə izah"
          placeholder="Problemi təsvir edin"
          maxLength={500}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <Button type="submit" fullWidth>
          Şikayəti göndər
        </Button>
      </form>
    </Dialog>
  )
}
