/**
 * The staff tools' data boundary (backend-contract.md 3.5): kept apart from `MarketplaceRepository`, so the public
 * contract does not carry moderation. The API checks the session's role: moderators and admins see the overview, the
 * moderation queue and the reports; categories, «Təsdiqlənmiş satıcı» and blocking are for admins. Anyone else gets
 * 403 `forbidden`, a visitor without a session 401.
 *
 * DATA_SOURCE=api only. The demo (DATA_SOURCE=mock) has no staff accounts: its /idareetme pages keep reading the
 * Figma data in src/data/admin, as before. Phase 3 brought the moderation queue; phase 4 the overview, the reports,
 * the categories, verifying sellers and blocking accounts.
 */
import 'server-only'
import { formatPhone } from '@/features/auth/validation'
import type {
  AdminCategory,
  AdminCategoryInput,
  AdminCategoryPatch,
  AdminOverview,
  BlockResult,
  CategoryKind,
  ModerationDecisionInput,
  ModerationDecisionResult,
  ModerationItem,
  ModerationQuery,
  ModerationQueue,
  OwnListing,
  ReportItem,
  ReportQuery,
  ReportQueue,
  ReportUpdate,
  SellerVerification,
} from '@/types'
import { isApiError, send } from './apiRepository'
import { pageParam } from './apiQuery'

export interface AdminRepository {
  /** The numbers behind every section (moderators and admins). */
  overview(): Promise<AdminOverview>

  /** One page of the queue with the totals; `status` defaults to `pending`, `sort` to `newest`. */
  moderationQueue(query: ModerationQuery): Promise<ModerationQueue>
  /** One item in any status but deleted; `undefined` when there is no such listing. */
  moderationItem(listingId: string): Promise<ModerationItem | undefined>
  /** Approve (30 days on the site) or reject (a reason code; a note for `other`). */
  decide(listingId: string, decision: ModerationDecisionInput): Promise<ModerationDecisionResult>

  /** One page of reports with every report's totals; every status unless `status` is given, newest first. */
  reports(query: ReportQuery): Promise<ReportQueue>
  /** One report; `undefined` when there is none. */
  report(id: string): Promise<ReportItem | undefined>
  /** open → investigating → resolved (with a resolution); the note goes into the history. */
  updateReport(id: string, patch: ReportUpdate): Promise<ReportItem>

  /* Admins only */
  /** Every category in the site's order, inactive ones too, each with its sub-categories. */
  listCategories(kind?: CategoryKind): Promise<AdminCategory[]>
  /** A category (with its sub-categories) or a sub-category; `undefined` when there is none. */
  category(id: string): Promise<AdminCategory | undefined>
  /** `saveCategory` of the contract, for a new one. */
  createCategory(input: AdminCategoryInput): Promise<AdminCategory>
  /** `saveCategory` of the contract, for an existing one: what is sent changes. */
  updateCategory(id: string, patch: AdminCategoryPatch): Promise<AdminCategory>
  /** «Təsdiqlənmiş satıcı» on or off. */
  verifySeller(sellerId: string, verified: boolean): Promise<SellerVerification>
  /** Blocking ends the account's sessions and takes its active listings off the site; unblocking puts them back. */
  blockUser(userId: string, blocked: boolean, reason?: string): Promise<BlockResult>
}

/** The moderation queue's query string (`GET /admin/moderation`). */
export function moderationParams({ status, kind, sort, q, page, pageSize }: ModerationQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (kind) params.set('kind', kind)
  if (sort) params.set('sort', sort)
  const text = q?.trim()
  if (text) params.set('q', text)
  params.set('page', pageParam(page))
  if (pageSize) params.set('pageSize', String(pageSize))
  return params
}

/** The reports' query string (`GET /admin/reports`). */
export function reportParams({ status, target, reason, sort, page, pageSize }: ReportQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (target) params.set('target', target)
  if (reason) params.set('reason', reason)
  if (sort) params.set('sort', sort)
  params.set('page', pageParam(page))
  if (pageSize) params.set('pageSize', String(pageSize))
  return params
}

/** Staff see the number itself; it comes as E.164 and is shown in the site's spacing. */
function withPhone<T extends OwnListing | undefined>(listing: T): T {
  return listing?.contactPhone ? { ...listing, contactPhone: formatPhone(listing.contactPhone) } : listing
}

const toItem = (item: ModerationItem): ModerationItem => ({ ...item, listing: withPhone(item.listing) })

const toReport = (item: ReportItem): ReportItem => (item.listing ? { ...item, listing: withPhone(item.listing) } : item)

const id = (value: string) => encodeURIComponent(value)

/** A read of one thing: `undefined` when the API says 404. */
async function readOne<T>(route: string): Promise<T | undefined> {
  try {
    return await send<T>(route, { method: 'GET' })
  } catch (error) {
    if (isApiError(error) && error.status === 404) return undefined
    throw error
  }
}

export const adminRepository: AdminRepository = {
  async overview() {
    return send<AdminOverview>('admin/overview', { method: 'GET' })
  },

  async moderationQueue(query) {
    const queue = await send<ModerationQueue>(`admin/moderation?${moderationParams(query)}`, { method: 'GET' })
    return { ...queue, items: queue.items.map(toItem) }
  },
  async moderationItem(listingId) {
    const item = await readOne<ModerationItem>(`admin/moderation/${id(listingId)}`)
    return item && toItem(item)
  },
  async decide(listingId, decision) {
    return send<ModerationDecisionResult>(`admin/moderation/${id(listingId)}/decision`, { method: 'POST', body: decision })
  },

  async reports(query) {
    const queue = await send<ReportQueue>(`admin/reports?${reportParams(query)}`, { method: 'GET' })
    return { ...queue, items: queue.items.map(toReport) }
  },
  async report(reportId) {
    const item = await readOne<ReportItem>(`admin/reports/${id(reportId)}`)
    return item && toReport(item)
  },
  async updateReport(reportId, patch) {
    return toReport(await send<ReportItem>(`admin/reports/${id(reportId)}`, { method: 'PATCH', body: patch }))
  },

  async listCategories(kind) {
    return send<AdminCategory[]>(`admin/categories${kind ? `?kind=${kind}` : ''}`, { method: 'GET' })
  },
  async category(categoryId) {
    return readOne<AdminCategory>(`admin/categories/${id(categoryId)}`)
  },
  async createCategory(input) {
    return send<AdminCategory>('admin/categories', { method: 'POST', body: input })
  },
  async updateCategory(categoryId, patch) {
    return send<AdminCategory>(`admin/categories/${id(categoryId)}`, { method: 'PATCH', body: patch })
  },
  async verifySeller(sellerId, verified) {
    return send<SellerVerification>(`admin/sellers/${id(sellerId)}/verify`, { method: 'POST', body: { verified } })
  },
  async blockUser(userId, blocked, reason) {
    return send<BlockResult>(`admin/users/${id(userId)}/block`, { method: 'POST', body: reason ? { blocked, reason } : { blocked } })
  },
}
