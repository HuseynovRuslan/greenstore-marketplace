/**
 * Client-side validation for the auth and profile forms.
 * Copy that exists in Figma is used verbatim ("Şifrələr eyni olmalıdır.", "Ən azı 8 simvol.",
 * "Ən azı 8 simvol, bir hərf və bir rəqəm istifadə edin."); the rest is minimal Azerbaijani wording.
 */

export const messages = {
  phoneRequired: 'Telefon nömrəsini daxil edin.',
  phoneFormat: 'Nömrəni +994 50 555 12 34 formatında daxil edin.',
  emailRequired: 'E-poçt ünvanını daxil edin.',
  emailFormat: 'E-poçt ünvanı düzgün deyil.',
  passwordRequired: 'Şifrəni daxil edin.',
  passwordShort: 'Ən azı 8 simvol.',
  passwordRule: 'Ən azı 8 simvol, bir hərf və bir rəqəm istifadə edin.',
  passwordRepeat: 'Şifrəni təkrar daxil edin.',
  passwordMismatch: 'Şifrələr eyni olmalıdır.',
  currentPassword: 'Cari şifrəni daxil edin.',
  companyRequired: 'Şirkətin adını daxil edin.',
  nameRequired: 'Adı daxil edin.',
  consent: 'Davam etmək üçün şərtlərlə razılaşın.',
}

const compactPhone = (value: string) => value.replace(/[\s\-()]/g, '')
const PHONE_RE = /^\+994\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isValidPhone = (value: string) => PHONE_RE.test(compactPhone(value))
export const isValidEmail = (value: string) => EMAIL_RE.test(value.trim())

/** "+994505551234" → "+994 50 555 12 34" (the spacing used throughout the design). */
export function formatPhone(value: string) {
  const d = compactPhone(value)
  if (!PHONE_RE.test(d)) return value.trim()
  return `+994 ${d.slice(4, 6)} ${d.slice(6, 9)} ${d.slice(9, 11)} ${d.slice(11, 13)}`
}

export function phoneError(value: string, required = true) {
  if (!value.trim()) return required ? messages.phoneRequired : undefined
  return isValidPhone(value) ? undefined : messages.phoneFormat
}

export function emailError(value: string, required = true) {
  if (!value.trim()) return required ? messages.emailRequired : undefined
  return isValidEmail(value) ? undefined : messages.emailFormat
}

/** Login / profile rule: at least 8 characters ("Ən azı 8 simvol."). */
export function passwordError(value: string) {
  if (!value) return messages.passwordRequired
  return value.length >= 8 ? undefined : messages.passwordShort
}

/** Registration rule from the field hint: 8+ characters with a letter and a digit. */
export function newPasswordError(value: string) {
  if (!value) return messages.passwordRequired
  return value.length >= 8 && /\p{L}/u.test(value) && /\d/.test(value) ? undefined : messages.passwordRule
}

export function requiredError(value: string, message: string) {
  return value.trim() ? undefined : message
}

export type Errors<K extends string> = Partial<Record<K, string>>

export const hasErrors = (errors: Record<string, string | undefined>) => Object.values(errors).some(Boolean)

/** Only internal paths are accepted for `?next=` (no open redirects). */
export function safeNext(next: string | null, fallback = '/kabinet') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
