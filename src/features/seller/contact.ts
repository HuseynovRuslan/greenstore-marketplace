/** "+994 50 555 12 34" → "994505551234" */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function telHref(phone: string): string {
  return `tel:+${phoneDigits(phone)}`
}

/** WhatsApp click-to-chat link (https://wa.me/<digits>). */
export function whatsappHref(phone: string): string {
  return `https://wa.me/${phoneDigits(phone)}`
}
