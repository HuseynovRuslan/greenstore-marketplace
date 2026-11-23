'use server'

import { cities } from '@/data/cities'
import { serviceCategories } from '@/data/services'
import { localDigits } from '@/lib/phone'
import { isApiError } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import type { ServiceRequestInput, ServiceRequestResult } from '@/types'

/** `Idempotency-Key`: up to 80 printable ASCII characters (the API's rule). */
const KEY_RE = /^[\x21-\x7e]{1,80}$/

const FIELD_MESSAGES: Record<string, string> = {
  categoryId: 'Xidmətin növünü seçin.',
  cityId: 'Şəhəri seçin.',
  description: 'İşi qısaca təsvir edin (10–1000 simvol).',
  name: 'Adınızı yazın.',
  phone: 'Telefon nömrəsi düzgün deyil.',
  preferredDate: 'Bu gündən bir ilə qədər olan tarixi seçin.',
  area: 'Ərazinin adı çox uzundur.',
  size: 'Sahə çox uzun yazılıb.',
}

/** The API's refusal of a request in the customer's words (backend-contract.md 4.2). */
function requestFailure(error: unknown): string {
  if (isApiError(error, 'service-request.phone-limit')) return 'Bu nömrədən bu gün çox sorğu göndərilib. Sabah yenidən cəhd edin və ya ustaya zəng edin.'
  if (isApiError(error) && error.status === 429) return 'Çox sorğu göndərildi. Bir az sonra yenidən cəhd edin.'
  if (isApiError(error, 'service.not-found')) return 'Bu xidmət artıq saytda deyil.'
  if (isApiError(error, 'provider.not-found')) return 'Bu usta indi sorğu qəbul etmir. Kataloqdan başqa usta seçin.'
  if (isApiError(error, 'validation')) {
    const field = Object.keys(error.problem.errors ?? {}).find((f) => FIELD_MESSAGES[f])
    if (field) return FIELD_MESSAGES[field]
  }
  return 'Sorğunu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.'
}

/**
 * «Usta çağır». Checked here again (public endpoint). `idempotencyKey`: one per form content, so a retry after a lost
 * answer gets the same request number instead of a second request. DEMO: the mock numbers the request and stores
 * nothing.
 */
export async function sendServiceRequest(
  input: ServiceRequestInput,
  idempotencyKey?: string,
): Promise<({ ok: true } & ServiceRequestResult) | { ok: false; error: string }> {
  const fail = (error: string) => ({ ok: false as const, error })
  if (!input || !serviceCategories.some((c) => c.id === input.categoryId)) return fail('Xidmətin növünü seçin.')
  if (!cities.some((c) => c.id === input.cityId)) return fail('Şəhəri seçin.')
  if (typeof input.description !== 'string' || input.description.trim().length < 10 || input.description.length > 1000) return fail('İşi qısaca təsvir edin.')
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) return fail('Adınızı yazın.')
  if (localDigits(input.phone ?? '').length !== 9) return fail('Telefon nömrəsi düzgün deyil.')
  const key = typeof idempotencyKey === 'string' && KEY_RE.test(idempotencyKey) ? idempotencyKey : undefined
  // Exactly the contract's fields (the API reads its bodies strictly): an optional one only when it is a string.
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
  const request: ServiceRequestInput = {
    serviceId: text(input.serviceId),
    providerId: text(input.providerId),
    categoryId: input.categoryId,
    cityId: input.cityId,
    area: text(input.area),
    preferredDate: text(input.preferredDate),
    size: text(input.size),
    description: input.description.trim(),
    name: input.name.trim(),
    phone: `+994${localDigits(input.phone)}`,
  }
  try {
    const result = await getRepository().submitServiceRequest(request, key)
    return { ok: true, ...result }
  } catch (error) {
    return fail(requestFailure(error))
  }
}
