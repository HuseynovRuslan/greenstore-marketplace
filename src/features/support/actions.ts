'use server'

import { getRepository } from '@/services/repository'
import type { SupportMessageInput } from '@/types'

const TOPICS: SupportMessageInput['topic'][] = ['listing', 'account', 'payment', 'complaint', 'other']

/** «Bizimlə əlaqə». Checked here again; DEMO: the mock returns a ticket number and stores nothing. */
export async function sendSupportMessage(input: SupportMessageInput): Promise<{ ok: true; ticket: number } | { ok: false; error: string }> {
  if (!input || !TOPICS.includes(input.topic)) return { ok: false, error: 'Mövzunu seçin.' }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) return { ok: false, error: 'Adınızı yazın.' }
  if (typeof input.contact !== 'string' || input.contact.trim().length < 5 || input.contact.length > 100) return { ok: false, error: 'Telefon və ya e-poçt yazın.' }
  if (typeof input.message !== 'string' || input.message.trim().length < 10 || input.message.length > 2000) return { ok: false, error: 'Mesajı yazın.' }
  try {
    const { ticket } = await getRepository().submitSupportMessage(input)
    return { ok: true, ticket }
  } catch {
    return { ok: false, error: 'Mesajı göndərmək alınmadı. Bir az sonra yenidən cəhd edin və ya zəng edin.' }
  }
}
