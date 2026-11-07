'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { useReveal } from '@/features/contact/RevealContext'
import { localPhone } from '@/features/listing/ListingContact'
import { telHref, whatsappHref } from '@/features/seller/contact'
import { RequestButton } from './RequestDialog'

interface ServiceContactProps {
  phone: string
  title: string
  provider: { id: string; name: string }
  serviceId: string
  categoryId: string
  layout?: 'panel' | 'bar'
}

/**
 * The service page's actions: «Usta çağır» (a request with the job's details) first, then the number (after
 * «Nömrəni göstər») and WhatsApp with a first line about the service. `bar`: the phone contact bar (request + call).
 */
export function ServiceContact({ phone, title, provider, serviceId, categoryId, layout = 'panel' }: ServiceContactProps) {
  const { revealed, reveal } = useReveal()
  const request = <RequestButton provider={provider} serviceId={serviceId} categoryId={categoryId} className={layout === 'bar' ? 'min-w-0 flex-1 px-3' : 'w-full'} />
  const call = revealed ? (
    <a href={telHref(phone)} aria-label={`Zəng et: ${localPhone(phone)}`} className={buttonClass('secondary', layout === 'bar' ? 'min-w-0 flex-1 px-3 tabular-nums' : 'w-full tabular-nums')}>
      <Phone aria-hidden size={18} strokeWidth={1.8} />
      {localPhone(phone)}
    </a>
  ) : (
    <Button variant="secondary" onClick={reveal} className={layout === 'bar' ? 'min-w-0 flex-1 px-3' : 'w-full'} icon={<Phone aria-hidden size={18} strokeWidth={1.8} />}>
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
  return (
    <div className="flex flex-col gap-2.5">
      {request}
      {call}
      <a
        href={`${whatsappHref(phone)}?text=${encodeURIComponent(`Salam! GreenStore-dakı «${title}» xidməti ilə bağlı yazıram.`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass('secondary', 'w-full')}
      >
        <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
        WhatsApp-a yaz
      </a>
    </div>
  )
}
