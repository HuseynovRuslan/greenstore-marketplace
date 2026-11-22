import { revalidateTag } from 'next/cache'
import { readRevalidation } from '@/services/revalidation'

/**
 * POST /api/revalidate — the API's change notices (backend-contract.md 3.6, src/services/revalidation.ts). Each tag's
 * cached reads expire at once (`{ expire: 0 }`, the docs' choice for a webhook that must take effect now): the next
 * visit fetches fresh data, so an approved listing is on its page and a removed one is gone for the very next visitor.
 *
 * Not `'max'` (stale-while-revalidate): in Next 16 it sets the tag's expiry a year ahead, overwriting the immediate
 * expiry the site's own Server Actions set with `updateTag` moments earlier (the notice arrives a few seconds after the
 * change), and the next visitor would be served the old page once more. Pages refresh within the minute anyway
 * (`revalidate: 60`).
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = undefined
  }
  const notice = readRevalidation(request.headers.get('authorization'), body, process.env.REVALIDATE_SECRET)
  if (!notice.ok) return Response.json({ error: notice.error }, { status: notice.status })
  for (const tag of notice.tags) revalidateTag(tag, { expire: 0 })
  return Response.json({ revalidated: notice.tags.length })
}
