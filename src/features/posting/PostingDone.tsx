'use client'

import Link from 'next/link'
import { Check, Clock3, Plus, Rocket, Sprout } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { ShareButton } from '@/components/ui/ShareButton'
import { Badge } from '@/components/ui/Badge'
import { promotionOption } from '@/data/promotions'
import { listingPrice } from '@/features/listing/facts'
import { readStored } from '@/hooks/useLocalStorage'
import { cn, formatPrice } from '@/lib/format'
import { useMyListings } from '@/state/store'
import { LAST_SENT_KEY } from './useDraft'

const timeline = [
  { title: 'Göndərildi', text: 'Elan bizdədir, qaralama silindi.', done: true },
  { title: 'Yoxlama', text: 'Moderator adətən 1 saat ərzində baxır. Nəticəni kabinetdə görəcəksiniz.', done: false },
  { title: 'Saytda', text: 'Təsdiqdən sonra 30 gün axtarışda görünür. Bitəndə pulsuz yeniləyə bilərsiniz.', done: false },
]

/**
 * After «Elanı göndər»: the sent listing, what happens next (review ≤ 1 hour, 30 days live), the promotion chosen
 * (paid after approval; mocked), share, «Elanlarım» and «Yeni elan». Reads the last sent listing from storage, so a
 * reload keeps the page.
 */
export function PostingDone() {
  const { submitted } = useMyListings()
  const last = readStored<{ id?: string; promotion?: { optionId: string } | null; edited?: boolean } | null>(LAST_SENT_KEY, null)
  const listing = submitted.find((l) => l.id === last?.id) ?? submitted[0]
  const promo = last?.promotion ? promotionOption(last.promotion.optionId) : undefined

  if (!listing) {
    return (
      <div className="page-x mx-auto flex w-full max-w-[640px] flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-[24px] leading-[1.2] font-semibold text-forest">Göndərilən elan tapılmadı</h1>
        <p className="text-[15px] leading-[1.5] text-muted">Elanlarınızı şəxsi kabinetdə görə bilərsiniz.</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="/kabinet">Elanlarım</ButtonLink>
          <ButtonLink href="/elan-yerlesdir" variant="secondary">
            Yeni elan
          </ButtonLink>
        </div>
      </div>
    )
  }

  const price = listingPrice(listing)
  return (
    <div className="page-x mx-auto flex w-full max-w-[720px] flex-col gap-7 pt-8 pb-16 md:pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="flex size-16 animate-pop-in items-center justify-center rounded-full bg-success-soft text-success motion-reduce:animate-none">
          <Check size={32} strokeWidth={2.4} />
        </span>
        <h1 className="text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] text-forest md:text-[32px]">
          {last?.edited ? 'Dəyişikliklər yoxlamaya göndərildi' : 'Elan yoxlamaya göndərildi'}
        </h1>
        <p className="max-w-[46ch] text-[15px] leading-[1.55] text-ink-soft">Təşəkkür edirik! Yoxlamadan keçən kimi elan saytda görünəcək və alıcılar sizinlə əlaqə saxlayacaq.</p>
      </div>

      <div className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-lg bg-mint md:size-28">
          {listing.cover ? (
            <img src={listing.cover} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-forest">
              <Sprout aria-hidden size={28} strokeWidth={1.6} />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Badge tone="warning" className="self-start">
            Yoxlamada
          </Badge>
          <p className="line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words text-ink">{listing.title}</p>
          <p className="text-[17px] leading-[1.25] font-bold text-forest tabular-nums">
            {price.amount} {price.unit && <span className="text-sm font-normal text-muted">{price.unit}</span>}
          </p>
          {listing.number && <p className="text-[13px] leading-[1.4] text-muted">Elan № {listing.number}</p>}
        </div>
      </div>

      <ol className="flex flex-col gap-0">
        {timeline.map((t, i) => (
          <li key={t.title} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < timeline.length - 1 && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-line" />}
            <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', t.done ? 'bg-forest text-white' : 'bg-mint text-forest')}>
              {t.done ? <Check size={16} strokeWidth={2.6} /> : <Clock3 size={16} strokeWidth={2} />}
            </span>
            <div className="flex flex-col gap-0.5 pt-1">
              <p className="text-[15px] leading-[1.35] font-semibold text-ink">
                {t.title}
                <span className="sr-only">{t.done ? ' — tamamlanıb' : ' — gözlənilir'}</span>
              </p>
              <p className="text-sm leading-[1.5] text-muted">{t.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {promo ? (
        <div className="flex gap-3 rounded-xl bg-vip p-4 text-sm leading-[1.5] text-ink">
          <Rocket aria-hidden size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-olive" />
          <p>
            <span className="font-semibold">
              {promo.pkg.name} · {promo.option.label}
            </span>{' '}
            elan təsdiqlənən kimi işə düşəcək. Ödəniş: {formatPrice(promo.option.price)} <span className="text-muted">(demo — ödəniş alınmır)</span>.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-mint p-4 text-sm leading-[1.5] text-ink sm:flex-row sm:items-center sm:justify-between">
          <p>Daha çox alıcı görsün? «Önə çıxar» elanı ana səhifəyə və axtarışın başına qaldırır.</p>
          <Link href={`/reklam?elan=${listing.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-forest hover:text-olive-text">
            <Rocket aria-hidden size={16} strokeWidth={2} />
            Paketlərə bax
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <ButtonLink href="/kabinet" className="sm:flex-1">
          Elanlarım
        </ButtonLink>
        <ButtonLink href="/elan-yerlesdir" variant="secondary" icon={<Plus aria-hidden size={18} strokeWidth={1.8} />} className="sm:flex-1">
          Yeni elan
        </ButtonLink>
        <ShareButton title={listing.title} url={`/elanlar/${listing.slug}`} text="Elanım GreenStore-da" className="sm:flex-1" />
      </div>
      <p className="text-center text-xs leading-[1.5] text-muted">Paylaşdığınız keçid elan təsdiqləndikdən sonra açılacaq.</p>
    </div>
  )
}
