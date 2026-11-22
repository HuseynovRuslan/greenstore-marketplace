/**
 * The API's change notices (backend-contract.md 3.6): when a listing appears on the site or leaves it, the API posts
 * `{ "tags": [...] }` to /api/revalidate with `Authorization: Bearer <REVALIDATE_SECRET>`, and the route expires the
 * cached reads with those tags (`revalidateTag`, src/app/api/revalidate/route.ts). The tags are apiRepository's:
 * `listing:<id or slug>`, `listings`, `home`, `seller:<id or slug>`, `sellers`, `services`, `service:…`,
 * `provider:<id>`, `sitemap:<kind>`.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

/** The most tags one notice may name; the API splits longer notices (Revalidation.MaxTagsPerNotice in backend/src/GreenStore.Api/Modules/Platform/Outbox.cs). */
export const MAX_TAGS = 64
/** Next's own limit for a cache tag. */
const MAX_TAG_LENGTH = 256
const TAG_RE = /^[\x21-\x7e]+$/

export type RevalidationRequest = { ok: true; tags: string[] } | { ok: false; status: 400 | 401; error: string }

/** Compares in constant time (hashes first, so the lengths do not show either). */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Checks a notice: the shared secret (no secret configured refuses every notice), then the body. Unknown tags are
 * harmless (they match no cached read), so any printable tag up to 256 characters is taken, each once.
 */
export function readRevalidation(authorization: string | null, body: unknown, secret: string | undefined): RevalidationRequest {
  const expected = secret?.trim()
  const token = /^Bearer (.+)$/.exec(authorization?.trim() ?? '')?.[1]
  if (!expected || !token || !sameSecret(token, expected)) return { ok: false, status: 401, error: 'unauthorized' }
  const tags = body && typeof body === 'object' ? (body as { tags?: unknown }).tags : undefined
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) return { ok: false, status: 400, error: 'tags' }
  if (!tags.every((t): t is string => typeof t === 'string' && t.length <= MAX_TAG_LENGTH && TAG_RE.test(t))) return { ok: false, status: 400, error: 'tags' }
  return { ok: true, tags: [...new Set(tags)] }
}
