'use server'

import { getRepository } from '@/services/repository'
import { localDigits } from '@/lib/phone'
import type { BusinessKind, OtpChallenge, OtpPurpose, OtpVerifyResult, SellerType } from '@/types'

/*
 * Account Server Actions: SMS code, registration and password reset. Public endpoints, so every input is checked
 * here. DATA_SOURCE=mock: no SMS is sent; the challenge carries a demo code that the UI shows in a demo note.
 */

type Fail = { ok: false; error: string }
const fail = (error: string): Fail => ({ ok: false, error })
const PURPOSES: OtpPurpose[] = ['register', 'login', 'reset-password', 'change-phone']

export async function requestCode(phone: string, purpose: OtpPurpose): Promise<({ ok: true } & OtpChallenge) | Fail> {
  if (typeof phone !== 'string' || localDigits(phone).length !== 9) return fail('Nömrəni tam yazın: 50 555 12 34.')
  if (!PURPOSES.includes(purpose)) return fail('Sorğu düzgün deyil.')
  try {
    const challenge = await getRepository().requestOtp({ phone: `+994${localDigits(phone)}`, purpose })
    return { ok: true, ...challenge }
  } catch {
    return fail('Kodu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.')
  }
}

export async function verifyCode(challengeId: string, code: string): Promise<OtpVerifyResult> {
  if (typeof challengeId !== 'string' || typeof code !== 'string' || !/^\d{4,6}$/.test(code.trim())) return { ok: false, error: 'wrong-code' }
  return getRepository().verifyOtp({ challengeId, code: code.trim() })
}

const KINDS: BusinessKind[] = ['nursery', 'garden-centre', 'landscaping']

export async function registerAccount(input: {
  accountType: SellerType
  businessKind?: BusinessKind
  companyName?: string
  fullName: string
  phone: string
  email?: string
  password: string
  otpChallengeId: string
}): Promise<{ ok: true; userId: string } | Fail> {
  if (input?.accountType !== 'business' && input?.accountType !== 'individual') return fail('Hesab növünü seçin.')
  if (input.accountType === 'business' && (!input.businessKind || !KINDS.includes(input.businessKind) || !input.companyName?.trim())) {
    return fail('Biznesin növünü və adını yazın.')
  }
  if (!input.fullName?.trim() || input.fullName.length > 60) return fail('Adınızı yazın.')
  if (localDigits(input.phone ?? '').length !== 9) return fail('Telefon nömrəsi düzgün deyil.')
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) return fail('Şifrə ən azı 8 simvol olmalıdır.')
  try {
    const { userId } = await getRepository().register({ ...input, phone: `+994${localDigits(input.phone)}` })
    return { ok: true, userId }
  } catch {
    return fail('Telefon təsdiqinin vaxtı keçib. Kodu yenidən istəyin.')
  }
}

export async function resetPasswordWithCode(otpChallengeId: string, password: string): Promise<{ ok: true } | Fail> {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return fail('Şifrə ən azı 8 simvol olmalıdır.')
  const { ok } = await getRepository().resetPassword({ otpChallengeId, password })
  return ok ? { ok: true } : fail('Təsdiqin vaxtı keçib. Kodu yenidən istəyin.')
}
