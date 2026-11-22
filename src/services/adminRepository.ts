/**
 * The staff tools' data boundary (backend-contract.md 3.5): kept apart from `MarketplaceRepository`, so the public
 * contract does not carry moderation. Moderators and admins only: the API answers 403 `forbidden` to anyone else and
 * 401 without a session.
 *
 * DATA_SOURCE=api only. The demo (DATA_SOURCE=mock) has no staff accounts: its /idareetme pages keep reading the
 * Figma data in src/data/admin, as before. Phase 3 brings the moderation queue; complaints, categories, verifying
 * sellers and blocking users (the rest of 3.5) come in phase 4.
 */
import 'server-only'
import { formatPhone } from '@/features/auth/validation'
import type { ModerationDecisionInput, ModerationDecisionResult, ModerationItem, ModerationQuery, ModerationQueue } from '@/types'
import { isApiError, send } from './apiRepository'
import { pageParam } from './apiQuery'

export interface AdminRepository {
  /** One page of the queue with the totals; `status` defaults to `pending`, `sort` to `newest`. */
  moderationQueue(query: ModerationQuery): Promise<ModerationQueue>
  /** One item in any status but deleted; `undefined` when there is no such listing. */
  moderationItem(listingId: string): Promise<ModerationItem | undefined>
  /** Approve (30 days on the site) or reject (a reason code; a note for `other`). */
  decide(listingId: string, decision: ModerationDecisionInput): Promise<ModerationDecisionResult>
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

/** Staff see the number itself; it comes as E.164 and is shown in the site's spacing. */
function toItem(item: ModerationItem): ModerationItem {
  const phone = item.listing.contactPhone
  return phone ? { ...item, listing: { ...item.listing, contactPhone: formatPhone(phone) } } : item
}

export const adminRepository: AdminRepository = {
  async moderationQueue(query) {
    const queue = await send<ModerationQueue>(`admin/moderation?${moderationParams(query)}`, { method: 'GET' })
    return { ...queue, items: queue.items.map(toItem) }
  },
  async moderationItem(listingId) {
    try {
      return toItem(await send<ModerationItem>(`admin/moderation/${encodeURIComponent(listingId)}`, { method: 'GET' }))
    } catch (error) {
      if (isApiError(error) && error.status === 404) return undefined
      throw error
    }
  },
  async decide(listingId, decision) {
    return send<ModerationDecisionResult>(`admin/moderation/${encodeURIComponent(listingId)}/decision`, { method: 'POST', body: decision })
  },
}
