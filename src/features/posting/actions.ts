'use server'

import { getRepository } from '@/services/repository'
import type { ListingSubmitResult } from '@/types'
import { restoreDraft, toListingInput, type StepNumber } from './draft'
import { firstInvalidStep } from './validation'

export type SubmitResult = { ok: true; result: ListingSubmitResult } | { ok: false; error: string; step?: StepNumber }

/**
 * «Elanı göndər». The draft is checked again here with the wizard's own rules (a Server Action is a public endpoint),
 * then sent as ListingInput. In DATA_SOURCE=mock the repository returns the next number and stores nothing.
 */
export async function submitPosting(raw: unknown): Promise<SubmitResult> {
  const draft = restoreDraft(raw)
  const step = firstInvalidStep(draft)
  if (step) return { ok: false, error: 'Bəzi xanalar doldurulmayıb. Həmin addıma qayıdıb düzəldin.', step }
  try {
    const result = await getRepository().submitListing(toListingInput(draft))
    return { ok: true, result }
  } catch {
    return { ok: false, error: 'Elanı göndərmək alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin — qaralama saxlanılıb.' }
  }
}
