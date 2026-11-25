import type { LoginError } from '@/types'

/*
 * What the account forms say when the API refuses (DATA_SOURCE=api). The API answers with stable ProblemDetails codes
 * (backend-contract.md 2.1, backend/src/GreenStore.Api/Modules/Accounts/AccountErrors.cs); the Server Actions pick the
 * text here by code. Written like the forms' own messages: what happened, then what to do.
 */

/** «3 dəqiqə», «45 saniyə»: a Retry-After for people. */
export function waitText(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return 'bir az'
  if (seconds < 60) return `${Math.ceil(seconds)} saniyə`
  return `${Math.ceil(seconds / 60)} dəqiqə`
}

export const loginErrorText = (error: LoginError, retryAfterSec?: number): string =>
  error === 'locked'
    ? `Çox səhv cəhd oldu. ${waitText(retryAfterSec)} sonra yenidən yoxlayın və ya SMS kodu ilə daxil olun.`
    : error === 'blocked'
      ? 'Hesabınız bloklanıb. Dəstək xidməti ilə əlaqə saxlayın.'
      : 'Telefon, e-poçt və ya şifrə səhvdir.'

/** A refused request for an SMS code, by the API's code. */
export function otpRequestErrorText(code: string | undefined, retryAfterSec: number | undefined, fieldError?: string): string {
  switch (code) {
    case 'account.phone-taken':
      return 'Bu nömrə ilə hesab artıq var. Daxil olun və ya şifrəni bərpa edin.'
    case 'account.not-found':
      return 'Bu nömrə ilə hesab tapılmadı. Nömrəni yoxlayın və ya qeydiyyatdan keçin.'
    case 'auth.blocked':
      return loginErrorText('blocked')
    case 'otp.too-soon':
      return `Yeni kodu ${waitText(retryAfterSec)} sonra istəyə bilərsiniz.`
    case 'otp.phone-limit':
    case 'otp.ip-limit':
    case 'rate-limited':
      return `Çox kod istənilib. ${waitText(retryAfterSec)} sonra yenidən cəhd edin.`
    case 'otp.unavailable':
      return 'SMS göndərmək indi alınmadı. Bir az sonra yenidən cəhd edin.'
    case 'unauthorized':
      return 'Sessiyanın vaxtı bitib. Yenidən daxil olun.'
    case 'validation':
      return fieldError === 'not-mobile' ? 'Kod yalnız mobil nömrəyə göndərilir: 50, 51, 55, 70, 77, 99, 10 və ya 60 ilə başlayan.' : 'Nömrəni tam yazın: 50 555 12 34.'
    default:
      return 'Kodu göndərmək alınmadı. Bir az sonra yenidən cəhd edin.'
  }
}

/** A refused registration, by the API's code and the first field it named. */
export function registerErrorText(code: string | undefined, errors: Record<string, string[]> = {}): string {
  switch (code) {
    case 'otp.not-verified':
      return 'Telefon təsdiqinin vaxtı keçib. Kodu yenidən istəyin.'
    case 'account.phone-taken':
      return 'Bu nömrə ilə hesab artıq var. Daxil olun və ya şifrəni bərpa edin.'
    case 'account.email-taken':
      return 'Bu e-poçt başqa hesabdadır. Başqa e-poçt yazın və ya boş saxlayın.'
    case 'rate-limited':
      return 'Çox cəhd oldu. Bir az sonra yenidən yoxlayın.'
    case 'validation': {
      if (errors.password) return 'Şifrə ən azı 8 simvol olmalı, hərf və rəqəm olmalıdır.'
      if (errors.phone) return errors.phone[0] === 'not-mobile' ? 'Hesab üçün mobil nömrə lazımdır.' : 'Telefon nömrəsi düzgün deyil.'
      if (errors.email) return 'E-poçt ünvanını ad@poct.az kimi yazın.'
      if (errors.companyName) return 'Biznesin adı 2–80 simvol olmalıdır.'
      if (errors.businessKinds) return 'Ən azı bir biznes növü seçin.'
      if (errors.fullName) return errors.fullName[0] === 'invalid' ? 'Ad və soyadı yalnız hərflərlə yazın.' : 'Adınızı yazın: ən çox 60 simvol.'
      return 'Məlumatları yoxlayın və yenidən göndərin.'
    }
    default:
      return 'Hesab yaradılmadı. Bir az sonra yenidən cəhd edin.'
  }
}
