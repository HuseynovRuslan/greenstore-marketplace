import type { SupportMessageInput } from '@/types'

export type ContactTopic = SupportMessageInput['topic']

/** The «Mövzu» options of the contact form (/elaqe), in display order. */
export const contactTopics: Array<{ value: ContactTopic; label: string }> = [
  { value: 'listing', label: 'Elanım haqqında' },
  { value: 'account', label: 'Hesab və giriş' },
  { value: 'payment', label: 'Ödəniş və paketlər' },
  { value: 'complaint', label: 'Satıcı və ya alıcıdan şikayət' },
  { value: 'other', label: 'Digər' },
]

/** `?movzu=` values (Azerbaijani, like `seher` / `siralama`) for a link that opens the form on a topic. */
const topicParam: Record<ContactTopic, string> = { listing: 'elan', account: 'hesab', payment: 'odenis', complaint: 'sikayet', other: 'diger' }

/** /elaqe with the topic chosen, e.g. the footer's «Problem bildir» → /elaqe?movzu=sikayet. */
export function contactHref(topic?: ContactTopic): string {
  return topic ? `/elaqe?movzu=${topicParam[topic]}` : '/elaqe'
}

/** The topic a `movzu` parameter names; anything unknown leaves the form on «Seçin». */
export function topicFromParam(value: string | null | undefined): ContactTopic | undefined {
  return contactTopics.find((t) => topicParam[t.value] === value)?.value
}
