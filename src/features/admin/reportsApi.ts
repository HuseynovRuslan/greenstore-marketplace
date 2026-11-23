import { complaintStatusLabels } from '@/data/admin'
import { cityName } from '@/data/cities'
import { listingPrice } from '@/features/listing/facts'
import { complaintReasonLabel } from '@/features/seller/complaintReasons'
import { lowerAz } from '@/lib/format'
import { formatQueueTime } from './format'
import type { ComplaintStatus, ModerationSort, OwnListing, ReportItem, ReportQuery, ReportResolution, ReportTarget } from '@/types'

/*
 * DATA_SOURCE=api: /idareetme/sikayetler over the API's reports (backend-contract.md 3.5, 4.1). The API sends codes,
 * not texts; these pure helpers word them, and keep the page's filters in its address
 * (?status=…&target=…&sort=…&sehife=…&item=<reportId>), so a reload or a shared link shows the same list.
 */

export { complaintStatusLabels }

const STATUSES: ComplaintStatus[] = ['open', 'investigating', 'resolved']
const TARGETS: ReportTarget[] = ['listing', 'seller', 'service']
const SORTS: ModerationSort[] = ['newest', 'oldest']
const ID_RE = /^[a-z0-9-]{1,80}$/

export const complaintStatuses = STATUSES

export const resolutionLabels: Record<ReportResolution, string> = {
  'action-taken': 'Tədbir görüldü',
  'no-violation': 'Pozuntu yoxdur',
}

export const reportResolutions = Object.keys(resolutionLabels) as ReportResolution[]

export const targetLabels: Record<ReportTarget, string> = { listing: 'Elan', seller: 'Satıcı', service: 'Xidmət' }

/** What the page says after a change (`?done=`). */
export type ReportDone = 'report' | 'blocked' | 'unblocked' | 'verified' | 'unverified'

const DONE: ReportDone[] = ['report', 'blocked', 'unblocked', 'verified', 'unverified']

export const doneNotices: Record<ReportDone, string> = {
  report: 'Şikayət yeniləndi',
  blocked: 'Hesab bloklandı',
  unblocked: 'Hesabın bloku açıldı',
  verified: 'Satıcı təsdiqləndi',
  unverified: 'Satıcının təsdiqi götürüldü',
}

export interface ReportPageState {
  /** Every status when not set (the Figma list shows all three) */
  status?: ComplaintStatus
  target?: ReportTarget
  sort: ModerationSort
  page: number
  /** The report open in the detail panel */
  item?: string
  /** The change just made (the notice after it); never carried along */
  done?: ReportDone
}

type Params = Record<string, string | string[] | undefined>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** The page's state from its address; anything unknown falls back to the list's defaults. */
export function readReportParams(params: Params): ReportPageState {
  const pick = <T extends string>(value: string | undefined, allowed: T[]) => (allowed.includes(value as T) ? (value as T) : undefined)
  const page = Number(one(params.sehife))
  const item = one(params.item)
  const done = pick(one(params.done), DONE)
  return {
    status: pick(one(params.status), STATUSES),
    target: pick(one(params.target), TARGETS),
    sort: pick(one(params.sort), SORTS) ?? 'newest',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    ...(item && ID_RE.test(item) ? { item } : {}),
    ...(done ? { done } : {}),
  }
}

export function toReportQuery(state: ReportPageState): ReportQuery {
  return { status: state.status, target: state.target, sort: state.sort, page: state.page }
}

/** The page's address with some of its state changed; a changed filter starts again at page 1 with nothing open. */
export function reportHref(state: ReportPageState, patch: Partial<Omit<ReportPageState, 'done'>> = {}, basePath = '/idareetme/sikayetler'): string {
  const filterChanged = (['status', 'target', 'sort'] as const).some((k) => k in patch && patch[k] !== state[k])
  const next = { ...state, ...(filterChanged ? { page: 1, item: undefined } : {}), ...patch }
  const params = new URLSearchParams()
  if (next.status) params.set('status', next.status)
  if (next.target) params.set('target', next.target)
  if (next.sort !== 'newest') params.set('sort', next.sort)
  if (next.page > 1) params.set('sehife', String(next.page))
  if (next.item) params.set('item', next.item)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

/** «Məlumat düzgün deyil»: the reason in the words the reporter chose it by. */
export const reportTitle = (item: Pick<ReportItem, 'target' | 'reason'>) => complaintReasonLabel(item.target, item.reason)

/** «Elan № 10430 · Limon ağacı», «Xidmət № 20316 · Landşaft dizaynı», «Satıcı · Yaşıl Bağ». */
export function reportTargetLine(item: Pick<ReportItem, 'target' | 'listing' | 'seller'>): string {
  if (item.target === 'seller') return `Satıcı · ${item.seller?.name ?? 'silinib'}`
  const listing = item.listing
  if (!listing) return targetLabels[item.target]
  return [`${targetLabels[item.target]}${listing.number ? ` № ${listing.number}` : ''}`, listing.title].join(' · ')
}

/** The list row's line: the target, the reporter (a guest has no name), when. */
export function reportMeta(item: ReportItem): string {
  return [reportTargetLine(item), item.reporter?.name ?? 'Qonaq', formatQueueTime(item.createdAt)].join(' · ')
}

/** Where the reported thing is on the site; none when it is no longer there for visitors. */
export function reportTargetHref(item: Pick<ReportItem, 'target' | 'listing' | 'seller' | 'targetDeleted' | 'owner'>): string | undefined {
  if (item.targetDeleted || item.owner?.status === 'blocked') return undefined
  if (item.target === 'seller') return item.seller ? `/saticilar/${item.seller.slug}` : undefined
  if (!item.listing || item.listing.status !== 'active') return undefined
  return `${item.target === 'service' ? '/xidmetler' : '/elanlar'}/${item.listing.slug}`
}

/** «38 ₼ · ədəd», «Razılaşma ilə» */
export function reportPrice(listing: OwnListing): string {
  const price = listingPrice(listing)
  return price.unit ? `${price.amount} ${price.unit}` : price.amount
}

/** «№ 10430 · Lənkəran · Rauf Məmmədov · 80–100 sm · Meyvəli»: the reported listing's line under its price. */
export function reportListingMeta(item: Pick<ReportItem, 'listing' | 'owner'>): string {
  const { listing } = item
  if (!listing) return ''
  return [listing.number ? `№ ${listing.number}` : undefined, cityName(listing.cityId), item.owner?.name, ...listing.attributes].filter(Boolean).join(' · ')
}

/** «Vəziyyət seçin»'s first choice: an open report is suggested for investigation (as on the Figma screen). */
export const suggestedStatus = (status: ComplaintStatus): ComplaintStatus => (status === 'open' ? 'investigating' : status)

export interface HistoryLine {
  time: string
  text: string
}

/**
 * «Qərar tarixçəsi»: the report's arrival, then each staff change in words. A change that kept the status only added a
 * note.
 */
export function reportHistory(item: Pick<ReportItem, 'createdAt' | 'history'>): HistoryLine[] {
  const lines: HistoryLine[] = [{ time: formatQueueTime(item.createdAt), text: 'Şikayət daxil oldu.' }]
  let previous: { status: ComplaintStatus; resolution?: ReportResolution } = { status: 'open' }
  for (const entry of item.history) {
    const changed = entry.status !== previous.status || entry.resolution !== previous.resolution
    const action = !changed
      ? 'Moderator qeydi əlavə olundu.'
      : entry.status === 'resolved'
        ? `Şikayət bağlandı: ${lowerAz(resolutionLabels[entry.resolution ?? 'no-violation'])}.`
        : entry.status === 'investigating'
          ? 'Şikayət araşdırmaya götürüldü.'
          : 'Şikayət yenidən açıldı.'
    const parts = [action, entry.note ? `Qeyd: ${entry.note}` : undefined, entry.by ? `(${entry.by.name})` : undefined]
    lines.push({ time: formatQueueTime(entry.at), text: parts.filter(Boolean).join(' ') })
    previous = { status: entry.status, resolution: entry.resolution }
  }
  return lines
}
