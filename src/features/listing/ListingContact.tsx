'use client'

import { useEffect, useRef } from 'react'
import { Heart, MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useReveal } from '@/features/contact/RevealContext'
import { chatHref, openChat, telHref } from '@/features/seller/contact'
import { cn } from '@/lib/format'
import { useFavorites } from '@/state/store'

/** What the page knows before «Nömrəni göstər»: whether there is a number to call or to message, never the number. */
export interface ContactInfo {
  listingId: string
  title: string
  /** The listing has a number buyers can call (`phoneMasked`) */
  callable: boolean
  /** The number takes WhatsApp messages */
  whatsapp: boolean
  /** The seller takes WhatsApp messages only */
  phoneHidden: boolean
}

/** WhatsApp chat with a first line already written, so the seller knows which listing it is about. */
export function listingChatHref(whatsappUrl: string, title: string) {
  return chatHref(whatsappUrl, `Salam! GreenStore-dakı «${title}» elanı ilə bağlı yazıram.`)
}

/** "+994 50 555 12 34" → "050 555 12 34", how people say a number here. */
export function localPhone(phone: string) {
  const d = phone.replace(/\D/g, '').slice(-9)
  return d.length === 9 ? `0${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : phone
}

/**
 * «Nömrəni göstər» → the number as a «call» link (focus moves to it); the number is asked for only now, and asking
 * counts the reveal for the seller's statistics (RevealContext). «WhatsApp-a yaz» when the seller takes messages: the
 * first click asks for the link too and opens the chat. A seller who hid the number gets WhatsApp only, with a line
 * saying so.
 */
export function ContactButtons({ info, layout = 'panel' }: { info: ContactInfo; layout?: 'panel' | 'bar' }) {
  const { revealed, pending, contact, reveal } = useReveal()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const requested = useRef(false)
  const { whatsapp, phoneHidden, title } = info

  useEffect(() => {
    if (revealed && requested.current) {
      requested.current = false
      linkRef.current?.focus()
    }
  }, [revealed])

  const onReveal = () => {
    if (pending) return
    requested.current = true
    void reveal()
  }

  const onChat = async () => {
    if (pending) return
    const found = await reveal()
    if (found?.whatsappUrl) openChat(listingChatHref(found.whatsappUrl, title))
  }

  const bar = layout === 'bar'
  const callable = info.callable && !phoneHidden
  const chatOffered = whatsapp && (info.callable || phoneHidden)
  const wide = bar ? 'w-full min-w-0 px-2' : 'w-full'

  let call = null
  if (callable && !revealed) {
    call = (
      <Button onClick={onReveal} aria-busy={pending || undefined} className={wide} icon={<Phone aria-hidden size={18} strokeWidth={1.8} className={cn(bar && 'max-[359px]:hidden')} />}>
        {bar ? 'Zəng et' : 'Nömrəni göstər'}
      </Button>
    )
  } else if (callable && contact.phone) {
    call = (
      <a ref={linkRef} href={telHref(contact.phone)} aria-label={`Zəng et: ${localPhone(contact.phone)}`} className={buttonClass('primary', cn('tabular-nums', bar ? wide : 'w-full text-base'))}>
        <Phone aria-hidden size={18} strokeWidth={1.8} />
        {localPhone(contact.phone)}
      </a>
    )
  }

  // Narrow phones: the word alone, so two buttons and the price fit one row.
  const chatLabel = (
    <>
      <MessageCircle aria-hidden size={18} strokeWidth={1.8} className={cn(bar && 'max-[419px]:hidden')} />
      {bar ? 'WhatsApp' : 'WhatsApp-a yaz'}
    </>
  )
  const chatClass = buttonClass(callable ? 'secondary' : 'primary', wide)
  let chat = null
  if (chatOffered && !revealed) {
    chat = (
      <button type="button" onClick={onChat} aria-busy={pending || undefined} className={chatClass}>
        {chatLabel}
      </button>
    )
  } else if (chatOffered && contact.whatsappUrl) {
    chat = (
      <a href={listingChatHref(contact.whatsappUrl, title)} target="_blank" rel="noopener noreferrer" className={chatClass}>
        {chatLabel}
      </a>
    )
  }

  if (!call && !chat) {
    return <p className="text-sm leading-[1.5] text-muted">Satıcının əlaqə nömrəsi göstərilmir.</p>
  }
  return (
    <div className={cn('gap-2.5', bar ? (call && chat ? 'grid min-w-0 flex-1 grid-cols-2' : 'grid min-w-0 flex-1') : 'flex flex-col')}>
      {call}
      {chat}
      {phoneHidden && !bar && <p className="text-xs leading-[1.5] text-muted">Satıcı zəng qəbul etmir — WhatsApp-a yazın.</p>}
    </div>
  )
}

/**
 * Phones (< 768 px): price and the contact buttons in a bar that stays above the bottom navigation while the page
 * scrolls (`sticky` inside the page, so it settles above the footer at the end and never covers content).
 */
export function MobileContactBar({ info, amount, unit }: { info: ContactInfo; amount: string; unit?: string }) {
  return (
    <div
      role="region"
      aria-label="Satıcı ilə əlaqə"
      data-bottom-bar="contact"
      className="gs-keyboard-aside sticky bottom-[calc(86px+env(safe-area-inset-bottom,0px))] z-30 flex w-full items-center gap-2.5 border-t border-line bg-surface/95 px-5 py-2.5 backdrop-blur-md md:hidden"
    >
      {/* A price is never cut: the amount keeps its width (15 px under 360 px), the unit sits under it. */}
      <p className="flex shrink-0 flex-col tabular-nums">
        <span className="text-[17px] leading-[1.2] font-bold whitespace-nowrap text-forest max-[359px]:text-[15px]">{amount}</span>
        {unit && <span className="text-xs leading-[1.3] whitespace-nowrap text-muted">{unit}</span>}
      </p>
      <ContactButtons info={info} layout="bar" />
    </div>
  )
}

/**
 * «Seçilmişlərə əlavə et» / «Seçilmişlərdədir»: the label itself says the state (so no aria-pressed, whose name must
 * not change), and a toast confirms the change for everyone, screen readers included.
 */
export function FavoriteToggle({ id, kind = 'listing', className }: { id: string; kind?: 'listing' | 'service'; className?: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const { toast } = useToast()
  const saved = isFavorite(kind, id)
  return (
    <button
      type="button"
      onClick={() => {
        toggleFavorite(kind, id)
        toast(saved ? 'Seçilmişlərdən çıxarıldı' : 'Seçilmişlərə əlavə edildi')
      }}
      className={buttonClass('secondary', cn('flex-1', saved && 'border-forest', className))}
    >
      <Heart
        aria-hidden
        size={18}
        strokeWidth={1.8}
        fill={saved ? 'currentColor' : 'none'}
        className={cn('transition-[scale] duration-(--dur-fast) ease-out', saved ? 'scale-110 text-danger' : 'text-forest')}
      />
      {saved ? 'Seçilmişlərdədir' : 'Seçilmişlərə əlavə et'}
    </button>
  )
}
