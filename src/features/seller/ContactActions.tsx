import { useEffect, useRef } from 'react'
import { MessageCircle, Phone } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/format'
import { telHref, whatsappHref } from './contact'

const icon = { size: 18, strokeWidth: 1.8, absoluteStrokeWidth: true, 'aria-hidden': true } as const

interface PhoneRevealProps {
  /** Missing → the action is shown disabled (no number in the data). */
  phone?: string
  revealed: boolean
  onReveal: () => void
  /** `panel`: full-width button → 24 px number (components frame "Nömrə göstərilib"); `bar`: compact mobile bar button. */
  variant?: 'panel' | 'bar'
  className?: string
}

/** "Nömrəni göstər" — hidden / revealed phone states from the components frame ("Əlaqə vəziyyətləri"). */
export function PhoneReveal({ phone, revealed, onReveal, variant = 'panel', className }: PhoneRevealProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const requested = useRef(false)

  useEffect(() => {
    if (revealed && requested.current) {
      requested.current = false
      linkRef.current?.focus()
    }
  }, [revealed])

  if (!phone || !revealed) {
    return (
      <Button
        disabled={!phone}
        fullWidth={variant === 'panel'}
        className={className}
        icon={<Phone {...icon} />}
        onClick={() => {
          requested.current = true
          onReveal()
        }}
      >
        Nömrəni göstər
      </Button>
    )
  }

  if (variant === 'bar') {
    return (
      <a ref={linkRef} href={telHref(phone)} aria-label={`Zəng et: ${phone}`} className={buttonClass('primary', className)}>
        {phone}
      </a>
    )
  }

  return (
    <a
      ref={linkRef}
      href={telHref(phone)}
      aria-label={`Zəng et: ${phone}`}
      className={cn(
        'flex min-h-[46px] w-full items-center rounded-lg text-[24px] leading-[1.5] font-semibold whitespace-nowrap text-ink hover:text-forest',
        className,
      )}
    >
      {phone}
    </a>
  )
}

/** "WhatsApp ilə əlaqə" → https://wa.me/<digits> in a new tab. */
export function WhatsAppLink({ phone, label = 'WhatsApp ilə əlaqə', fullWidth = true, className }: { phone?: string; label?: string; fullWidth?: boolean; className?: string }) {
  if (!phone) {
    return (
      <Button variant="secondary" disabled fullWidth={fullWidth} className={className} icon={<MessageCircle {...icon} />}>
        {label}
      </Button>
    )
  }
  return (
    <a
      href={whatsappHref(phone)}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClass('secondary', cn(fullWidth && 'w-full', className))}
    >
      <MessageCircle {...icon} />
      {label}
    </a>
  )
}
