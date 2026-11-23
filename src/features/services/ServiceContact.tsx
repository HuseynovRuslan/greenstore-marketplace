'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { useReveal } from '@/features/contact/RevealContext'
import { localPhone } from '@/features/listing/ListingContact'
import { chatHref, openChat, telHref } from '@/features/seller/contact'
import { RequestButton } from './RequestDialog'

interface ServiceContactProps {
  title: string
  provider: { id: string; name: string }
  serviceId: string
  categoryId: string
  layout?: 'panel' | 'bar'
}

/**
 * The service page's actions: «Usta çağır» (a request with the job's details) first, then the number (after
 * «Nömrəni göstər») and WhatsApp with a first line about the service. The number is not in the page: the first of
 * those two buttons asks for it (RevealContext, the page's service). `bar`: the phone contact bar (request + call).
 */
export function ServiceContact({ title, provider, serviceId, categoryId, layout = 'panel' }: ServiceContactProps) {
  const { revealed, pending, contact, reveal } = useReveal({ kind: 'listing', id: serviceId })
  const chatText = `Salam! GreenStore-dakı «${title}» xidməti ilə bağlı yazıram.`
  const wide = layout === 'bar' ? 'min-w-0 flex-1 px-3' : 'w-full'
  const request = <RequestButton provider={provider} serviceId={serviceId} categoryId={categoryId} className={wide} />
  const phone = contact.phone
  const call =
    revealed && phone ? (
      <a href={telHref(phone)} aria-label={`Zəng et: ${localPhone(phone)}`} className={buttonClass('secondary', `${wide} tabular-nums`)}>
        <Phone aria-hidden size={18} strokeWidth={1.8} />
        {localPhone(phone)}
      </a>
    ) : revealed ? null : (
      <Button variant="secondary" onClick={() => !pending && void reveal()} aria-busy={pending || undefined} className={wide} icon={<Phone aria-hidden size={18} strokeWidth={1.8} />}>
        {layout === 'bar' ? 'Zəng et' : 'Nömrəni göstər'}
      </Button>
    )
  if (layout === 'bar') {
    return (
      <div className="flex w-full gap-2.5">
        {request}
        {call}
      </div>
    )
  }
  const onChat = async () => {
    if (pending) return
    const found = await reveal()
    if (found?.whatsappUrl) openChat(chatHref(found.whatsappUrl, chatText))
  }
  return (
    <div className="flex flex-col gap-2.5">
      {request}
      {call}
      {!revealed ? (
        <button type="button" onClick={onChat} aria-busy={pending || undefined} className={buttonClass('secondary', 'w-full')}>
          <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
          WhatsApp-a yaz
        </button>
      ) : (
        contact.whatsappUrl && (
          <a href={chatHref(contact.whatsappUrl, chatText)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'w-full')}>
            <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
            WhatsApp-a yaz
          </a>
        )
      )}
    </div>
  )
}
