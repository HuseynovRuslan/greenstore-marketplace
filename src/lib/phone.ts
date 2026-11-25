/**
 * Azerbaijani mobile numbers as the forms handle them: the user types the 9 local digits after a fixed «+994»
 * ("50 555 12 34"); the value kept everywhere is "+994 50 555 12 34". Pasted or autofilled numbers in any common
 * shape ("+994505551234", "0505551234", "(050) 555-12-34") are accepted.
 */

/**
 * The 9 local digits (fewer while typing) of a kept value ("+994 50 5", partial ones too) or of whatever was typed,
 * pasted or autofilled. Letters and symbols never get in. A local part never starts with 0, so the habitual «0» of
 * «050…» is dropped as it is typed: «+994» is already there. «994» typed out of habit goes once the number is longer
 * than 9 digits.
 */
export function localDigits(value: string): string {
  const text = value.trim()
  // The kept value and autofill carry the code in front: what follows it is the local part, however short.
  if (text.startsWith('+994')) return localDigits(text.slice(4))
  let d = text.replace(/\D/g, '')
  if (d.length > 9 && d.startsWith('994')) d = d.slice(3)
  return d.replace(/^0+/, '').slice(0, 9)
}

/** The shape of the local part, shown in the box until digits take its place. */
export const LOCAL_MASK = '__ ___ __ __'

/** "505551234" → "50 555 12 34"; partial input is grouped as far as it goes ("5055" → "50 55"). */
export function formatLocal(digits: string): string {
  const d = digits.slice(0, 9)
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ')
}

/** Stored value: "+994 50 555 12 34" ('' when nothing is typed). */
export function phoneValue(value: string): string {
  const d = localDigits(value)
  return d ? `+994 ${formatLocal(d)}` : ''
}

/** Operator codes of Azerbaijani mobile and Baku landline numbers. */
const PREFIXES = ['10', '12', '50', '51', '55', '60', '70', '77', '99']

export function isCompletePhone(value: string): boolean {
  return localDigits(value).length === 9
}

/** Required-phone error copy (ux-writing: say what to do, give the shape). */
export function phoneFieldError(value: string, { required = true } = {}): string | undefined {
  const d = localDigits(value)
  if (!d) return required ? 'Telefon nömrəsini yazın.' : undefined
  if (d.length < 9) return 'Nömrə 9 rəqəmdən ibarət olmalıdır: 50 555 12 34.'
  if (!PREFIXES.includes(d.slice(0, 2)) && !/^2\d/.test(d)) return 'Operator kodu düzgün deyil. Məsələn: 50, 55, 70, 77.'
  return undefined
}
