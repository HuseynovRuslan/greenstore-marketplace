'use server'

import { updateTag } from 'next/cache'
import type { AccountProfile } from '@/data/user'
import { accountOf } from '@/features/account/profile'
import { localDigits } from '@/lib/phone'
import { dataSource } from '@/seo/env'
import { isApiError } from '@/services/apiRepository'
import { getRepository } from '@/services/repository'
import type { BusinessKind, LoginResult, OtpChallenge, OtpPurpose, OtpVerifyResult, SellerType } from '@/types'
import { loginErrorText, otpRequestErrorText, registerErrorText, waitText } from './messages'

/*
 * Account Server Actions: SMS code, registration, sign-in and password reset. Public endpoints, so every input is
 * checked here.
 * - DATA_SOURCE=mock: no SMS is sent (the challenge carries a demo code that the UI shows in a demo note) and the demo
 *   session lives in the browser: the pages sign in locally, as before.
 * - DATA_SOURCE=api: the sign-ins write the session cookies (src/services/session.ts) through the repository and
 *   answer with the account (`account`), which the page hands to the store. The API's refusals become the texts of
 *   ./messages.ts.
 */

type Fail = { ok: false; error: string }
const fail = (error: string): Fail => ({ ok: false, error })
const PURPOSES: OtpPurpose[] = ['register', 'login', 'reset-password', 'change-phone']

/** A signed-in account, for the store: the API's profile with the business profile, when it has one. */
export type SignedIn = { ok: true; account: AccountProfile }

async function signedInAccount(result: Extract<LoginResult, { ok: true }>): Promise<AccountProfile> {
  const repo = getRepository()
  const seller = result.user.accountType === 'business' ? await repo.getOwnSeller().catch(() => undefined) : undefined
  return accountOf(result.user, seller)
}

export async function requestCode(phone: string, purpose: OtpPurpose): Promise<({ ok: true } & OtpChallenge) | Fail> {
  if (typeof phone !== 'string' || localDigits(phone).length !== 9) return fail('Nömrəni tam yazın: 50 555 12 34.')
  if (!PURPOSES.includes(purpose)) return fail('Sorğu düzgün deyil.')
  try {
    const challenge = await getRepository().requestOtp({ phone: `+994${localDigits(phone)}`, purpose })
    return { ok: true, ...challenge }
  } catch (error) {
    return isApiError(error) ? fail(otpRequestErrorText(error.code, error.retryAfterSec, error.fieldError('phone'))) : fail('Kodu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.')
  }
}

/** The repository's answer, or a refusal that is not about the code (`message` is said as it is). */
export type VerifyCodeResult = OtpVerifyResult | { ok: false; message: string }

/** A refusal that a new code would not cure: too many requests (wait), or the API failing (try again). */
function notAboutTheCode(error: unknown): string | undefined {
  if (isApiError(error) && error.status === 429) return `Çox cəhd oldu. ${waitText(error.retryAfterSec)} sonra yenidən yoxlayın.`
  if (!isApiError(error) || error.status >= 500) return 'Server indi cavab vermir. Bir az sonra yenidən cəhd edin.'
  return undefined
}

export async function verifyCode(challengeId: string, code: string): Promise<VerifyCodeResult> {
  if (typeof challengeId !== 'string' || typeof code !== 'string' || !/^\d{4,6}$/.test(code.trim())) return { ok: false, error: 'wrong-code' }
  try {
    return await getRepository().verifyOtp({ challengeId, code: code.trim() })
  } catch (error) {
    const message = notAboutTheCode(error)
    // Otherwise the API no longer knows the challenge: a new code is the way on.
    return message ? { ok: false, message } : { ok: false, error: 'expired' }
  }
}

const KINDS: BusinessKind[] = ['nursery', 'garden-centre', 'landscaping']

/**
 * The new account, signed in at once (backend-contract.md 2.1). A business account opens its «mağaza» too: its public
 * page /saticilar/<slug> exists from this moment, so the sellers' cached reads are refreshed.
 */
export async function registerAccount(input: {
  accountType: SellerType
  businessKind?: BusinessKind
  companyName?: string
  fullName: string
  phone: string
  email?: string
  password: string
  otpChallengeId: string
}): Promise<{ ok: true; userId: string; account?: AccountProfile } | Fail> {
  if (input?.accountType !== 'business' && input?.accountType !== 'individual') return fail('Hesab növünü seçin.')
  if (input.accountType === 'business' && (!input.businessKind || !KINDS.includes(input.businessKind) || !input.companyName?.trim())) {
    return fail('Biznesin növünü və adını yazın.')
  }
  if (!input.fullName?.trim() || input.fullName.length > 60) return fail('Adınızı yazın.')
  if (localDigits(input.phone ?? '').length !== 9) return fail('Telefon nömrəsi düzgün deyil.')
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) return fail('Şifrə ən azı 8 simvol olmalıdır.')
  const business = input.accountType === 'business'
  try {
    const result = await getRepository().register({
      accountType: input.accountType,
      ...(business ? { businessKind: input.businessKind, companyName: input.companyName?.trim() } : {}),
      fullName: input.fullName.trim(),
      phone: `+994${localDigits(input.phone)}`,
      ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      password: input.password,
      otpChallengeId: String(input.otpChallengeId),
    })
    if (!result.ok) return fail(loginErrorText(result.error, result.retryAfterSec))
    if (dataSource() !== 'api') return { ok: true, userId: result.user.id }
    if (business) updateTag('sellers')
    return { ok: true, userId: result.user.id, account: await signedInAccount(result) }
  } catch (error) {
    return fail(isApiError(error) ? registerErrorText(error.code, error.problem.errors) : 'Hesab yaradılmadı. Server indi cavab vermir, bir az sonra yenidən cəhd edin.')
  }
}

/** DATA_SOURCE=api: «Şifrə ilə» on /daxil-ol. (The mock's demo signs in in the browser.) */
export async function signInWithPassword(login: string, password: string): Promise<SignedIn | Fail> {
  if (typeof login !== 'string' || !login.trim() || login.length > 200) return fail('Telefon nömrəsini və ya e-poçtu yazın.')
  if (typeof password !== 'string' || !password || password.length > 128) return fail('Şifrəni yazın.')
  try {
    const result = await getRepository().login({ login: login.trim(), password })
    return result.ok ? { ok: true, account: await signedInAccount(result) } : fail(loginErrorText(result.error, result.retryAfterSec))
  } catch (error) {
    if (isApiError(error, 'rate-limited')) return fail(`Çox cəhd oldu. ${waitText(error.retryAfterSec)} sonra yenidən yoxlayın.`)
    return fail('Daxil olmaq alınmadı. Bir az sonra yenidən cəhd edin.')
  }
}

/** DATA_SOURCE=api: «SMS kodu ilə» on /daxil-ol, once the code is verified. */
export async function signInWithCode(otpChallengeId: string): Promise<SignedIn | Fail> {
  if (typeof otpChallengeId !== 'string' || !otpChallengeId) return fail('Kodun vaxtı bitib. Yenisini istəyin.')
  try {
    const result = await getRepository().loginWithOtp({ otpChallengeId })
    return result.ok ? { ok: true, account: await signedInAccount(result) } : fail(loginErrorText(result.error, result.retryAfterSec))
  } catch (error) {
    return fail(notAboutTheCode(error) ?? 'Kodun vaxtı bitib. Yenisini istəyin.')
  }
}

/**
 * The new password, after a verified SMS code. DATA_SOURCE=api also signs in with it (the API ends every session of the
 * account on a reset, so «Şifrəni saxla və daxil ol» needs a new one): `phone` is the number the code went to.
 */
export async function resetPasswordWithCode(otpChallengeId: string, password: string, phone?: string): Promise<{ ok: true; account?: AccountProfile } | Fail> {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return fail('Şifrə ən azı 8 simvol olmalıdır.')
  const repo = getRepository()
  try {
    const { ok } = await repo.resetPassword({ otpChallengeId, password })
    if (!ok) return fail('Təsdiqin vaxtı keçib. Kodu yenidən istəyin.')
  } catch (error) {
    return fail(isApiError(error, 'validation') ? 'Şifrə ən azı 8 simvol olmalı, hərf və rəqəm olmalıdır.' : 'Şifrəni dəyişmək alınmadı. Bir az sonra yenidən cəhd edin.')
  }
  if (dataSource() !== 'api' || typeof phone !== 'string' || localDigits(phone).length !== 9) return { ok: true }
  try {
    const result = await repo.login({ login: `+994${localDigits(phone)}`, password })
    return result.ok ? { ok: true, account: await signedInAccount(result) } : { ok: true }
  } catch {
    // The password is changed; signing in is left to /daxil-ol.
    return { ok: true }
  }
}
