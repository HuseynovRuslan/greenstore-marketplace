import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Check, Heart, MessageCircle, Phone, Share2, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonClass } from '@/components/ui/Button'
import { useFavorites } from '@/app/store'
import { cn } from '@/lib/format'
import type { Service, ServiceProvider } from '@/types'
import { telHref, whatsappHref, type ProviderContact } from './contact'
import { InsetPanel } from './ui'

const icon = { size: 18, strokeWidth: 1.8, absoluteStrokeWidth: true } as const

/* Figma "Məlumat paneli" #1: price 32 px semibold, note 14 px muted, "Seçilmişlərə əlavə et" (secondary) + "Paylaş" (tertiary). */
export function PricePanel({ service, note }: { service: Service; note?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const saved = isFavorite('service', service.id)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: service.title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* share sheet dismissed or clipboard blocked — nothing to do */
    }
  }

  return (
    <InsetPanel className="w-full">
      <p className="text-[28px] leading-[1.5] font-semibold text-ink md:text-[32px]">{service.priceLabel}</p>
      {note && <p className="w-full text-sm leading-[1.5] text-muted">{note}</p>}
      <Button
        variant="secondary"
        fullWidth
        aria-pressed={saved}
        onClick={() => toggleFavorite('service', service.id)}
        icon={<Heart aria-hidden {...icon} className={cn(saved && 'text-danger')} fill={saved ? 'currentColor' : 'none'} fillOpacity={saved ? 0.12 : 0} />}
      >
        {saved ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
      </Button>
      <Button variant="tertiary" fullWidth onClick={share} icon={copied ? <Check aria-hidden {...icon} /> : <Share2 aria-hidden {...icon} />}>
        <span aria-live="polite">{copied ? 'Keçid kopyalandı' : 'Paylaş'}</span>
      </Button>
    </InsetPanel>
  )
}

/** "Nömrəni göstər" → the button turns into a tel: link with the number (components frame "Nömrə göstərilib"). */
function PhoneButton({ phone, revealed, onReveal, className }: { phone: string; revealed: boolean; onReveal: () => void; className?: string }) {
  // Move focus to the number when it replaces the button the user just pressed.
  const pressed = useRef(false)
  if (revealed) {
    return (
      <a
        href={telHref(phone)}
        className={buttonClass('primary', className)}
        ref={(el) => {
          if (el && pressed.current) {
            pressed.current = false
            el.focus()
          }
        }}
      >
        <Phone aria-hidden {...icon} />
        {phone}
      </a>
    )
  }
  return (
    <Button
      className={className}
      onClick={() => {
        pressed.current = true
        onReveal()
      }}
      icon={<Phone aria-hidden {...icon} />}
    >
      Nömrəni göstər
    </Button>
  )
}

/* Figma "Məlumat paneli" #2: sprout 32 + name 15 px semibold, badge, summary 14 px muted, phone + WhatsApp, hours 12 px muted. */
export function ProviderPanel({
  provider,
  contact,
  revealed,
  onReveal,
}: {
  provider: ServiceProvider
  contact: ProviderContact
  revealed: boolean
  onReveal: () => void
}) {
  return (
    <InsetPanel className="w-full">
      <div className="flex w-full items-start gap-3">
        <Sprout aria-hidden size={32} strokeWidth={1.8} absoluteStrokeWidth className="shrink-0 text-forest" />
        <h2 className="min-w-0 flex-1 text-[15px] leading-[1.5] font-semibold text-ink">
          {contact.sellerSlug ? (
            <Link to={`/saticilar/${contact.sellerSlug}`} className="hover:text-olive">
              {provider.name}
            </Link>
          ) : (
            provider.name
          )}
        </h2>
      </div>
      {contact.badge && <Badge tone="success">{contact.badge}</Badge>}
      {contact.summary && <p className="w-full text-sm leading-[1.5] text-muted">{contact.summary}</p>}
      <div aria-live="polite" className="w-full">
        <PhoneButton phone={contact.phone} revealed={revealed} onReveal={onReveal} className="w-full" />
      </div>
      <a href={whatsappHref(contact.phone)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'w-full')}>
        <MessageCircle aria-hidden {...icon} />
        WhatsApp ilə əlaqə
      </a>
      <p className="w-full text-xs leading-[1.5] text-muted">
        {[contact.hours, 'İlkin məsləhət üçün əlaqə saxlayın.'].filter(Boolean).join(' · ')}
      </p>
    </InsetPanel>
  )
}

/** Mobile (< 768) contact bar that sticks above the 86 px bottom navigation while the page content is in view. */
export function MobileContactBar({ contact, revealed, onReveal }: { contact: ProviderContact; revealed: boolean; onReveal: () => void }) {
  return (
    <div className="sticky bottom-[86px] z-30 -mx-5 -mb-6 flex gap-3 self-stretch border-t border-line bg-surface px-5 py-3 md:hidden">
      <PhoneButton phone={contact.phone} revealed={revealed} onReveal={onReveal} className="min-w-0 flex-1 px-3" />
      <a
        href={whatsappHref(contact.phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp ilə əlaqə"
        className={buttonClass('secondary', 'min-w-0 flex-1 px-3')}
      >
        <MessageCircle aria-hidden {...icon} />
        WhatsApp
      </a>
    </div>
  )
}
