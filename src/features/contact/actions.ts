'use server'

import { getRepository } from '@/services/repository'
import type { ContactReveal } from '@/types'

/*
 * «Nömrəni göstər» (backend-contract.md 3.1). Numbers are never in a page's HTML: the button asks for one here, the
 * repository counts the click and answers. Public endpoints, so the id is checked here, not only in the button.
 */

export type RevealResult = { ok: true; contact: ContactReveal } | { ok: false }

const ID_RE = /^[a-z0-9-]{1,80}$/

async function run(id: unknown, load: (id: string) => Promise<ContactReveal>): Promise<RevealResult> {
  if (typeof id !== 'string' || !ID_RE.test(id)) return { ok: false }
  try {
    const { phone, whatsappUrl } = await load(id)
    return { ok: true, contact: { ...(phone ? { phone } : {}), ...(whatsappUrl ? { whatsappUrl } : {}) } }
  } catch {
    return { ok: false }
  }
}

/** A listing's or a service's number (services are listings). */
export async function revealListingContact(listingId: string): Promise<RevealResult> {
  return run(listingId, (id) => getRepository().revealPhone(id))
}

/** A business's number on its seller page. */
export async function revealSellerContact(sellerId: string): Promise<RevealResult> {
  return run(sellerId, (id) => getRepository().revealSellerPhone(id))
}
