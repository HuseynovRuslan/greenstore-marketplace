/*
 * Card form checks of the mock checkout (DEMO: nothing is charged and the card never leaves the browser). Pure, so
 * the messages are tested.
 */

export const cardDigits = (value: string) => value.replace(/\D/g, '').slice(0, 16)

/** "4111111111111111" → "4111 1111 1111 1111" */
export const formatCard = (value: string) => cardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ')

/** "0828" / "08/28" → "08/28" (typing a month > 1 adds the leading zero) */
export function formatExpiry(value: string): string {
  let d = value.replace(/\D/g, '').slice(0, 4)
  if (d.length === 1 && Number(d) > 1) d = `0${d}`
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export function luhn(digits: string): boolean {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return digits.length > 0 && sum % 10 === 0
}

export interface CardInput {
  number: string
  expiry: string
  cvc: string
}

export function cardErrors(card: CardInput, now = new Date()): Partial<Record<keyof CardInput, string>> {
  const errors: Partial<Record<keyof CardInput, string>> = {}
  const digits = cardDigits(card.number)
  if (!digits) errors.number = 'Kart nömrəsini yazın.'
  else if (digits.length < 16 || !luhn(digits)) errors.number = 'Kart nömrəsi düzgün deyil: 16 rəqəmi yoxlayın.'
  const m = /^(\d{2})\/(\d{2})$/.exec(card.expiry)
  if (!card.expiry) errors.expiry = 'Bitmə tarixini yazın: AA/İİ.'
  else if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) errors.expiry = 'Tarixi AA/İİ şəklində yazın, məsələn 08/28.'
  else {
    const end = new Date(2000 + Number(m[2]), Number(m[1]), 1)
    if (end <= now) errors.expiry = 'Kartın müddəti bitib.'
  }
  if (!/^\d{3}$/.test(card.cvc)) errors.cvc = 'Kartın arxasındakı 3 rəqəmi yazın.'
  return errors
}
