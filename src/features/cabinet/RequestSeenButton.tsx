'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { markRequestSeen } from './actions'

/** «Baxıldı»: the request is no longer new; the list reloads. A failure leaves the button for another try. */
export function RequestSeenButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [, startTransition] = useTransition()
  return (
    <Button
      variant="secondary"
      disabled={busy}
      aria-busy={busy}
      icon={<Check aria-hidden size={18} strokeWidth={1.8} />}
      onClick={async () => {
        setBusy(true)
        const result = await markRequestSeen(id).catch(() => ({ ok: false }))
        setBusy(false)
        setFailed(!result.ok)
        if (result.ok) startTransition(() => router.refresh())
      }}
    >
      {busy ? 'Yenilənir…' : failed ? 'Alınmadı, yenidən' : 'Baxıldı'}
    </Button>
  )
}
