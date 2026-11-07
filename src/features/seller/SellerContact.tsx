'use client'

import { useSyncExternalStore } from 'react'
import { AtSign, Globe, MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { useReveal } from '@/features/contact/RevealContext'
import { localPhone } from '@/features/listing/ListingContact'
import { cn } from '@/lib/format'
import type { OpeningHours, Seller } from '@/types'
import { telHref, whatsappHref } from './contact'
import { groupHours, openStatus } from './hours'

/** Call (after «Nömrəni göstər»), WhatsApp, Instagram and the website of a business. */
export function SellerContactButtons({ seller }: { seller: Seller }) {
  const { revealed, reveal } = useReveal()
  const phone = seller.phone
  return (
    <div className="flex flex-col gap-2.5">
      {phone &&
        (revealed ? (
          <a href={telHref(phone)} aria-label={`Zəng et: ${localPhone(phone)}`} className={buttonClass('primary', 'w-full text-base tabular-nums')}>
            <Phone aria-hidden size={18} strokeWidth={1.8} />
            {localPhone(phone)}
          </a>
        ) : (
          <Button fullWidth onClick={reveal} icon={<Phone aria-hidden size={18} strokeWidth={1.8} />}>
            Nömrəni göstər
          </Button>
        ))}
      {phone && seller.whatsapp && (
        <a
          href={`${whatsappHref(phone)}?text=${encodeURIComponent(`Salam! GreenStore-da «${seller.name}» səhifənizi gördüm.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass('secondary', 'w-full')}
        >
          <MessageCircle aria-hidden size={18} strokeWidth={1.8} />
          WhatsApp-a yaz
        </a>
      )}
      {!phone && <p className="text-sm leading-[1.5] text-muted">Əlaqə nömrəsi göstərilmir.</p>}
      {(seller.instagram || seller.website) && (
        // A long handle or address breaks anywhere rather than running out of the card (break-ui, Nov 2026).
        <div className="flex min-w-0 flex-wrap gap-x-4">
          {seller.instagram && (
            <a
              href={`https://instagram.com/${seller.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 text-sm font-medium wrap-anywhere text-forest hover:underline"
            >
              <AtSign aria-hidden size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="min-w-0">{seller.instagram}</span>
            </a>
          )}
          {seller.website && (
            <a href={seller.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 text-sm font-medium wrap-anywhere text-forest hover:underline">
              <Globe aria-hidden size={16} strokeWidth={1.8} className="shrink-0" />
              <span className="min-w-0">{seller.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

const subscribe = () => () => {}
let pageNow: number | undefined
const clientNow = () => (pageNow ??= Date.now())
const serverNow = () => null

/**
 * Weekly hours, grouped («B.e.–C. 10:00–20:00»). The «open now» line and today's row depend on the clock, so they
 * appear after hydration (the server HTML has the table only; the line's box is reserved, so nothing shifts).
 */
export function HoursTable({ hours }: { hours: OpeningHours[] }) {
  const now = useSyncExternalStore(subscribe, clientNow, serverNow)
  const status = now == null ? undefined : openStatus(hours, new Date(now))
  const today = now == null ? undefined : ((new Date(now + 4 * 3_600_000).getUTCDay() + 6) % 7) + 1
  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex min-h-5 items-center gap-2 text-sm leading-[1.4] font-semibold" aria-live="polite">
        {status && (
          <>
            <span aria-hidden className={cn('size-2 rounded-full', status.open ? 'bg-success' : 'bg-danger')} />
            <span className={status.open ? 'text-success' : 'text-ink'}>{status.label}</span>
          </>
        )}
      </p>
      <dl className="flex flex-col text-sm leading-[1.45]">
        {groupHours(hours).map((row) => {
          const current = today != null && row.dayNumbers.includes(today)
          return (
            <div key={row.days} className={cn('-mx-2 flex justify-between gap-4 rounded-md px-2 py-1.5', current && 'bg-mint')}>
              <dt className={cn(current ? 'font-semibold text-ink' : 'text-muted')}>
                {row.days}
                {current && <span className="sr-only"> (bu gün)</span>}
              </dt>
              <dd className={cn('tabular-nums', row.time === 'Bağlıdır' ? 'text-muted' : 'font-medium text-ink')}>{row.time}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
