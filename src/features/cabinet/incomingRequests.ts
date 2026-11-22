import { formatQueueTime } from '@/features/admin/format'
import { formatDayMonth } from '@/lib/format'
import type { IncomingServiceRequest } from '@/types'

/*
 * «Gələn sorğular» (DATA_SOURCE=api, backend-contract.md 4.2): the words of one request in the provider's list. Pure,
 * so the server page and the tests share them.
 */

/** «Sorğu № 3001 · Landşaft dizaynı» */
export const requestTitle = (r: Pick<IncomingServiceRequest, 'number' | 'category'>) => `Sorğu № ${r.number} · ${r.category}`

/** «Bakı, Mərdəkan · 120 m² · Nə vaxt: 25 noyabr · Göndərilib: 22 noy. · 14:05» */
export function requestDetails(r: Pick<IncomingServiceRequest, 'city' | 'area' | 'size' | 'preferredDate' | 'createdAt'>): string {
  return [
    r.area ? `${r.city}, ${r.area}` : r.city,
    r.size,
    r.preferredDate ? `Nə vaxt: ${formatDayMonth(r.preferredDate)}` : undefined,
    `Göndərilib: ${formatQueueTime(r.createdAt)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A request that went to several providers: the first to call usually gets the job. */
export const sharedNote = (r: Pick<IncomingServiceRequest, 'recipientCount'>) =>
  r.recipientCount > 1 ? `Bu sorğu ${r.recipientCount} ustaya göndərilib: müştəriyə tez zəng edin.` : undefined
