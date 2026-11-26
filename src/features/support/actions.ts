'use server'

import { isPersonName } from '@/lib/names'
import { isApiError } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import type { SupportMessageInput } from '@/types'

const TOPICS: SupportMessageInput['topic'][] = ['listing', 'account', 'payment', 'complaint', 'other']

const FIELD_MESSAGES: Record<string, string> = {
  topic: 'Mövzunu seçin.',
  name: 'Adınızı yalnız hərflərlə yazın.',
  contact: 'Telefon nömrəsini və ya e-poçtu düzgün yazın.',
  message: 'Mesajı yazın (10–2000 simvol).',
  listingNumber: 'Elan nömrəsini rəqəmlə yazın.',
}

/** The API's refusal of a message in the visitor's words (backend-contract.md 4.2). */
function supportFailure(error: unknown): string {
  if (isApiError(error) && error.status === 429) return 'Bir neçə mesajı ard-arda göndərdiniz. Bir az sonra yenidən cəhd edin və ya zəng edin.'
  if (isApiError(error, 'validation')) {
    const field = Object.keys(error.problem.errors ?? {}).find((f) => FIELD_MESSAGES[f])
    if (field) return FIELD_MESSAGES[field]
  }
  return 'Mesajı göndərmək alınmadı. Bir az sonra yenidən cəhd edin və ya zəng edin.'
}

/** «Bizimlə əlaqə». Checked here again; DEMO: the mock returns a ticket number and stores nothing. */
export async function sendSupportMessage(input: SupportMessageInput): Promise<{ ok: true; ticket: number } | { ok: false; error: string }> {
  if (!input || !TOPICS.includes(input.topic)) return { ok: false, error: 'Mövzunu seçin.' }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) return { ok: false, error: 'Adınızı yazın.' }
  if (!isPersonName(input.name)) return { ok: false, error: 'Adınızı yalnız hərflərlə yazın.' }
  if (typeof input.contact !== 'string' || input.contact.trim().length < 5 || input.contact.length > 100) return { ok: false, error: 'Telefon və ya e-poçt yazın.' }
  if (typeof input.message !== 'string' || input.message.trim().length < 10 || input.message.length > 2000) return { ok: false, error: 'Mesajı yazın.' }
  const listingNumber = input.listingNumber
  if (listingNumber !== undefined && (typeof listingNumber !== 'number' || !Number.isSafeInteger(listingNumber) || listingNumber <= 0)) {
    return { ok: false, error: 'Elan nömrəsini rəqəmlə yazın.' }
  }
  try {
    // Exactly the contract's fields (the API reads its bodies strictly).
    const { ticket } = await getRepository().submitSupportMessage({
      topic: input.topic,
      name: input.name.trim(),
      contact: input.contact.trim(),
      message: input.message.trim(),
      ...(listingNumber !== undefined ? { listingNumber } : {}),
    })
    return { ok: true, ticket }
  } catch (error) {
    return { ok: false, error: supportFailure(error) }
  }
}
