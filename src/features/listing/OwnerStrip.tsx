'use client'

import Link from 'next/link'
import { BarChart3, Rocket } from 'lucide-react'
import { useSession } from '@/state/store'

/**
 * On the seller's own published listing: «Bu sizin elanınızdır» with «Önə çıxar» and a way to the cabinet. Visitors
 * never see sales pitches on someone else's listing (turbo-functional-analysis.md, row 21).
 */
export function OwnerStrip({ sellerId, listingId }: { sellerId?: string; listingId: string }) {
  const { user } = useSession()
  if (!sellerId || user?.sellerId !== sellerId) return null
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-vip px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-[1.45] font-semibold text-ink">Bu sizin elanınızdır</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/kabinet?status=aktiv" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-surface">
          <BarChart3 aria-hidden size={16} strokeWidth={2} />
          Elanlarım və statistika
        </Link>
        <Link href={`/reklam?elan=${listingId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-forest px-3.5 text-sm font-semibold text-white hover:bg-forest-hover">
          <Rocket aria-hidden size={16} strokeWidth={2} />
          Önə çıxar
        </Link>
      </div>
    </div>
  )
}
