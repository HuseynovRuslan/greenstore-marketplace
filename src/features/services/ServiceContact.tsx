'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { useReveal } from '@/features/contact/RevealContext'
import { localPhone } from '@/features/listing/ListingContact'
import { chatHref, openChat, telHref } from '@/features/seller/contact'

interface ServiceContactProps {
  title: string
  serviceId: string
  layout?: 'panel' | 'bar'
}

/**
 * The service page's actions: the number (after «Nömrəni göstər») and WhatsApp with a first line about the service.
 * The number is not in the page: the first of those two buttons asks for it (RevealContext, the page's service).
 * `bar`: the phone contact bar (call + WhatsApp side by side).
 */
export function ServiceContact({ title, serviceId, layout = 'panel' }: ServiceContactProps) {
  const { revealed, pending, contact, reveal } = useReveal({ kind: 'listing', id: serviceId })
  const chatText = `Salam! GreenStore-dakı «${title}» xidməti ilə bağlı yazıram.`
  const bar = layout === 'bar'
  const wide = bar ? 'min-w-0 flex-1 px-3' : 'w-full'
  const chatLabel = bar ? 'WhatsApp' : 'WhatsApp-a yaz'
  const phone = contact.phone
  const call =
    revealed && phone ? (
      <a href={telHref(phone)} aria-label={`Zəng et: ${localPhone(phone)}`} className={buttonClass('primary', `${wide} tabular-nums`)}>
        <Phone aria-hidden size={18} strokeWidth={1.8} />
        {localPhone(phone)}
      </a>
    ) : revealed ? null : (
      <Button onClick={() => !pending && void reveal()} aria-busy={pending || undefined} className={wide} icon={<Phone aria-hidden size={18} strokeWidth={1.8} />}>
        {bar ? 'Zəng et' : 'Nömrəni göstər'}
      </Button>
    )
  const onChat = async () => {
    if (pending) return
    const found = await reveal()
    if (found?.whatsappUrl) openChat(chatHref(found.whatsappUrl, chatText))
  }
  const chat = !revealed ? (
    <button type="button" onClick={onChat} aria-busy={pending || undefined} className={buttonClass('secondary', wide)}>
      <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
      {chatLabel}
    </button>
  ) : (
    contact.whatsappUrl && (
      <a href={chatHref(contact.whatsappUrl, chatText)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', wide)}>
        <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
        {chatLabel}
      </a>
    )
  )
  return (
    <div className={bar ? 'flex w-full gap-2.5' : 'flex flex-col gap-2.5'}>
      {call}
      {chat}
    </div>
  )
}
