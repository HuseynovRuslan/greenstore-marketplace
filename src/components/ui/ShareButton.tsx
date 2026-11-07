'use client'

import { Share2 } from 'lucide-react'
import { cn } from '@/lib/format'
import { buttonClass, type ButtonVariant } from './Button'
import { useToast } from './Toast'

interface ShareButtonProps {
  title: string
  /** Path or absolute URL; defaults to the current page. */
  url?: string
  text?: string
  variant?: ButtonVariant
  /** Icon-only round button (44 px) with the label as its accessible name. */
  iconOnly?: boolean
  className?: string
}

/**
 * «Paylaş»: the system share sheet where there is one (phones, Safari), otherwise the link is copied and a toast says
 * so. Cancelling the share sheet is not an error.
 */
export function ShareButton({ title, url, text, variant = 'secondary', iconOnly, className }: ShareButtonProps) {
  const { toast } = useToast()
  const share = async () => {
    const href = new URL(url ?? window.location.href, window.location.origin).toString()
    if (typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title, text, url: href })
      } catch {
        /* dismissed */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(href)
      toast('Keçid kopyalandı')
    } catch {
      toast('Keçidi kopyalamaq alınmadı', 'error')
    }
  }
  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={share}
        aria-label="Paylaş"
        className={cn(
          'flex size-11 items-center justify-center rounded-full border border-line bg-surface text-forest transition-[border-color,scale] duration-(--dur-fast) ease-out hover:border-olive active:scale-[0.95] motion-reduce:active:scale-100',
          className,
        )}
      >
        <Share2 aria-hidden size={18} strokeWidth={1.8} />
      </button>
    )
  }
  return (
    <button type="button" onClick={share} className={buttonClass(variant, className)}>
      <Share2 aria-hidden size={17} strokeWidth={1.8} />
      Paylaş
    </button>
  )
}
