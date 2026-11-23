'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { PromotionOrder } from '@/types'
import { refreshPromotedListing } from './actions'

/** How often a pending order is asked about again, and for how long (20 × 3 s = one minute). */
export const POLL_MS = 3_000
export const POLL_TRIES = 20

/**
 * The return page's live part (DATA_SOURCE=api, backend-contract.md 5.1). The provider may bring the visitor back
 * before it confirmed the payment to the API: while the order is `pending` the page reads it again every few seconds
 * for a minute, then offers «Yenilə». A paid order refreshes the cached pages of its listing once, so «Önə çıxan»
 * shows on the catalogue at once.
 */
export function PaymentStatusWatcher({ orderId, status }: { orderId: string; status: PromotionOrder['status'] }) {
  const router = useRouter()
  const [tries, setTries] = useState(0)
  const refreshed = useRef(false)

  useEffect(() => {
    if (status !== 'paid' || refreshed.current) return
    refreshed.current = true
    void refreshPromotedListing(orderId).catch(() => undefined)
  }, [status, orderId])

  useEffect(() => {
    if (status !== 'pending' || tries >= POLL_TRIES) return
    const timer = setTimeout(() => {
      setTries((n) => n + 1)
      router.refresh()
    }, POLL_MS)
    return () => clearTimeout(timer)
  }, [status, tries, router])

  if (status !== 'pending') return null
  if (tries < POLL_TRIES) {
    return (
      <p role="status" className="text-[13px] leading-[1.5] text-muted">
        Səhifə özü yenilənir…
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p role="status" className="text-[13px] leading-[1.5] text-muted">
        Təsdiq hələ gəlməyib. Bir az sonra yeniləyin: nəticə «Elanlarım»da da görünəcək.
      </p>
      <Button
        variant="secondary"
        icon={<RotateCcw aria-hidden size={16} strokeWidth={1.8} />}
        onClick={() => {
          setTries(0)
          router.refresh()
        }}
      >
        Yenilə
      </Button>
    </div>
  )
}
