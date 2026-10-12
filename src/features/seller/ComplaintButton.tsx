'use client'

import { useCallback, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ComplaintDialog } from './ComplaintDialog'
import { listingComplaintReasons, sellerComplaintReasons } from './complaintReasons'

const variants = {
  listing: { label: 'Elanı şikayət et', reasons: listingComplaintReasons },
  seller: { label: 'Satıcını şikayət et', reasons: sellerComplaintReasons },
} as const

/**
 * "Elanı şikayət et" / "Satıcını şikayət et" with its dialog. The dialog renders nothing while closed and is a
 * fixed overlay while open, so it can live next to the button inside server-rendered markup.
 */
export function ComplaintButton({ kind, fullWidth }: { kind: keyof typeof variants; fullWidth?: boolean }) {
  const { label, reasons } = variants[kind]
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      <Button
        variant="tertiary"
        fullWidth={fullWidth}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
      >
        {label}
      </Button>
      <ComplaintDialog open={open} onClose={close} title={label} reasons={[...reasons]} />
    </>
  )
}
