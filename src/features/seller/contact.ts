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

/** A WhatsApp chat link with its first line already written (`?text=`), from the link «Nömrəni göstər» returned. */
export function chatHref(whatsappUrl: string, text: string): string {
  const url = new URL(whatsappUrl)
  url.searchParams.set('text', text)
  return url.toString()
}

/**
 * Opens a chat in a new tab right after its link arrived. Browsers allow it shortly after the click that asked for
 * it; when one blocks it, the button has become the link by then, so a second click opens it.
 */
export function openChat(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer')
}
