'use client'

import { useCallback, useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/format'
import { ComplaintDialog } from './ComplaintDialog'
import { listingComplaintReasons, sellerComplaintReasons, serviceComplaintReasons } from './complaintReasons'

const variants = {
  listing: { label: 'Elandan şikayət et', reasons: listingComplaintReasons },
  seller: { label: 'Satıcıdan şikayət et', reasons: sellerComplaintReasons },
  service: { label: 'Xidmətdən şikayət et', reasons: serviceComplaintReasons },
} as const

interface ComplaintButtonProps {
  kind: keyof typeof variants
  targetId: string
  fullWidth?: boolean
  /** `link`: a quiet text link (the listing page's footer line) instead of a button */
  appearance?: 'button' | 'link'
  className?: string
}

/**
 * «Elandan / Satıcıdan / Xidmətdən şikayət et» with its dialog. The dialog renders nothing while closed and is a fixed
 * overlay while open, so it can live next to the button inside server-rendered markup.
 */
export function ComplaintButton({ kind, targetId, fullWidth, appearance = 'button', className }: ComplaintButtonProps) {
  const { label, reasons } = variants[kind]
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  return (
    <>
      {appearance === 'link' ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={cn('inline-flex min-h-11 items-center gap-2 text-sm leading-[normal] font-medium text-muted transition-colors duration-(--dur-fast) hover:text-danger', className)}
        >
          <Flag aria-hidden size={16} strokeWidth={1.8} />
          {label}
        </button>
      ) : (
        <Button
          variant="tertiary"
          fullWidth={fullWidth}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={className}
          icon={<Flag aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
        >
          {label}
        </Button>
      )}
      <ComplaintDialog open={open} onClose={close} title={label} reasons={[...reasons]} target={kind} targetId={targetId} />
    </>
  )
}
