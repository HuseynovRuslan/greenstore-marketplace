import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Heart, Share2, Sprout } from 'lucide-react'
import { useFavorites } from '@/app/store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { cityName } from '@/data/cities'
import { cn, formatPrice } from '@/lib/format'
import { PhoneReveal, WhatsAppLink } from '@/features/seller/ContactActions'
import type { Listing, Seller } from '@/types'

const icon = { size: 18, strokeWidth: 1.8, absoluteStrokeWidth: true, 'aria-hidden': true } as const

/** Figma "Məlumat paneli" with price 38 px semibold, price note, delivery chip, "Seçilmişlər" + "Paylaş". */
export function PricePanel({ listing }: { listing: Listing }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const saved = isFavorite('listing', listing.id)

  return (
    <Panel>
      <p className="text-[38px] leading-[1.5] font-semibold whitespace-nowrap text-ink">{formatPrice(listing.price)}</p>
      {listing.priceNote && <p className="w-full text-sm leading-[1.5] text-muted">{listing.priceNote}</p>}
      {listing.deliveryAvailable && <Badge tone="neutral">Çatdırılma mümkündür</Badge>}
      <div className="relative flex w-full flex-wrap items-start gap-2">
        <Button
          variant="secondary"
          aria-pressed={saved}
          aria-label={saved ? 'Seçilmişlərdən çıxar' : 'Seçilmişlərə əlavə et'}
          onClick={() => toggleFavorite('listing', listing.id)}
          icon={<Heart {...icon} className={cn(saved && 'text-danger')} fill={saved ? 'currentColor' : 'none'} fillOpacity={saved ? 0.12 : 0} />}
        >
          Seçilmişlər
        </Button>
        <ShareButton title={listing.title} />
      </div>
    </Panel>
  )
}

/** "Paylaş" → Web Share API, or copies the page link with a short confirmation. */
function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flash = (text: string) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(''), 2500)
  }

  const share = async () => {
    const url = window.location.href
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      flash('Keçid kopyalandı')
    } catch {
      flash('Keçidi kopyalamaq mümkün olmadı')
    }
  }

  return (
    <>
      <Button variant="tertiary" onClick={share} icon={<Share2 {...icon} />}>
        Paylaş
      </Button>
      {/* Sits in the panel's bottom padding so the confirmation does not move the layout. */}
      <p role="status" className="absolute top-full left-0 mt-1 text-xs leading-[1.5] font-semibold text-success">
        {message}
      </p>
    </>
  )
}

interface SellerPanelProps {
  listing: Listing
  seller?: Seller
  revealed: boolean
  onReveal: () => void
}

/** Figma seller & contact panel. Without a known seller only the (disabled) actions are shown — no invented identity. */
export function SellerPanel({ listing, seller, revealed, onReveal }: SellerPanelProps) {
  if (!seller) {
    return (
      <Panel aria-label="Satıcı ilə əlaqə">
        <div className="flex w-full flex-col gap-1 leading-[1.5]">
          <p className="text-[15px] font-semibold text-ink">Satıcı məlumatı göstərilmir</p>
          <p className="text-sm text-muted">{cityName(listing.cityId)}</p>
        </div>
        <PhoneReveal revealed={false} onReveal={onReveal} />
        <WhatsAppLink />
      </Panel>
    )
  }

  const subline = [seller.kind, seller.memberSince ? `${seller.memberSince}-dən GreenStore-da` : undefined].filter(Boolean).join(' · ')
  const sellerUrl = `/saticilar/${seller.slug}`

  return (
    <Panel aria-label="Satıcı ilə əlaqə">
      <div className="flex w-full items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-mint text-forest">
          <Sprout aria-hidden size={25} strokeWidth={1.8} absoluteStrokeWidth />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 leading-[1.5]">
          <Link to={sellerUrl} className="text-[15px] font-semibold text-ink hover:text-forest">
            {seller.name}
          </Link>
          {subline && <p className="text-xs text-muted">{subline}</p>}
        </div>
      </div>
      {seller.verified && <Badge tone="success">Təsdiqlənmiş satıcı</Badge>}
      <p className="w-full text-sm leading-[1.5] text-muted">
        {seller.address ?? cityName(seller.cityId)} · {seller.activeListings} aktiv elan
      </p>
      <PhoneReveal phone={seller.phone} revealed={revealed} onReveal={onReveal} />
      <WhatsAppLink phone={seller.phone} />
      {seller.phone ? (
        seller.workingHours && <p className="w-full text-xs leading-[1.5] text-muted">{seller.workingHours} · Satıcıya birbaşa müraciət edin.</p>
      ) : (
        <p className="w-full text-xs leading-[1.5] text-muted">Satıcının əlaqə nömrəsi göstərilmir.</p>
      )}
      <Link to={sellerUrl} className="text-[13px] leading-[1.5] font-semibold whitespace-nowrap text-forest hover:text-olive">
        Satıcının bütün elanları →
      </Link>
    </Panel>
  )
}

/** Mobile (< 768) sticky contact bar, sitting on top of the 86 px bottom navigation. */
export function MobileContactBar({ phone, revealed, onReveal }: { phone: string; revealed: boolean; onReveal: () => void }) {
  return (
    <div
      aria-label="Satıcı ilə əlaqə"
      role="region"
      className="fixed inset-x-0 bottom-[86px] z-30 flex gap-3 border-t border-line bg-surface px-5 py-3 md:hidden"
    >
      <PhoneReveal variant="bar" phone={phone} revealed={revealed} onReveal={onReveal} className="min-w-0 flex-1 px-3" />
      <WhatsAppLink phone={phone} label="WhatsApp" fullWidth={false} className="min-w-0 flex-1 px-3" />
    </div>
  )
}
