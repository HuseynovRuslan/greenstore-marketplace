'use server'

import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { localDigits } from '@/lib/phone'
import { getRepository } from '@/services/repository'
import type { ServiceRequestInput, ServiceRequestResult } from '@/types'

/** «Usta çağır». Checked here again (public endpoint); DEMO: the mock numbers the request and stores nothing. */
export async function sendServiceRequest(input: ServiceRequestInput): Promise<({ ok: true } & ServiceRequestResult) | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error })
  if (!input || !serviceCategories.some((c) => c.id === input.categoryId)) return fail('Xidmətin növünü seçin.')
  if (!cities.some((c) => c.id === input.cityId)) return fail('Şəhəri seçin.')
  if (typeof input.description !== 'string' || input.description.trim().length < 10 || input.description.length > 1000) return fail('İşi qısaca təsvir edin.')
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) return fail('Adınızı yazın.')
  if (localDigits(input.phone ?? '').length !== 9) return fail('Telefon nömrəsi düzgün deyil.')
  try {
    const result = await getRepository().submitServiceRequest({ ...input, phone: `+994${localDigits(input.phone)}` })
    return { ok: true, ...result }
  } catch {
    return fail('Sorğunu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.')
  }
}
