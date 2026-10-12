'use client'

import { useCallback, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { ComplaintDialog } from './ComplaintDialog'

/** "Elanı şikayət et" on a service page: dialog, then a disabled button and the "Şikayətiniz göndərildi" notice. */
export function ServiceComplaint() {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <div className="flex w-full flex-col items-start gap-4">
        <Button variant="tertiary" disabled={sent} onClick={() => setOpen(true)} icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}>
          Elanı şikayət et
        </Button>
        {sent && (
          <Notice tone="success" title="Şikayətiniz göndərildi" className="max-w-[432px]">
            Nəticə haqqında məlumat veriləcək.
          </Notice>
        )}
      </div>

      <ComplaintDialog
        open={open}
        onClose={close}
        onSubmitted={() => {
          setOpen(false)
          setSent(true)
        }}
      />
    </>
  )
}
