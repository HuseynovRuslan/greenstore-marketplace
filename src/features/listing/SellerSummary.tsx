import Link from 'next/link'
import { BadgeCheck, ChevronRight, Clock3, UserRound } from 'lucide-react'
import { cityName } from '@/data/cities'
import { cn, formatNumber, upperAz } from '@/lib/format'
import type { Listing, Seller } from '@/types'
import { ordinal } from './detail'
import { SellerLogo } from './SellerLogo'

/**
 * "AT" from "Abşeron Tingçilik"; one letter for one word. Only words that start with a letter count, so quotes and
 * signs do not become initials («Yaşıl Ev» MMC → "YE", "4 Fəsil Bağ" → "FB"); whole characters, never half of one.
 */
export function initials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+/u, ''))
    .filter((w) => /^\p{L}/u.test(w))
  const first = (w?: string) => (w ? Array.from(w)[0] : '')
  return upperAz(words.length > 1 ? first(words[0]) + first(words[1]) : first(words[0]) || '?')
}

/** 60 → «Adətən 1 saat ərzində cavab verir», 30 → «… 30 dəqiqə …», two days → «… 2 gün …» */
export function responseLabel(minutes: number): string {
  if (minutes < 60) return `Adətən ${Math.max(1, Math.round(minutes))} dəqiqə ərzində cavab verir`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Adətən ${hours} saat ərzində cavab verir`
  const days = Math.round(hours / 24)
  return days <= 1 ? 'Adətən bir gün ərzində cavab verir' : `Adətən ${days} gün ərzində cavab verir`
}

/** Square avatar: the logo, or initials on mint (also when the logo fails to load). */
export function SellerAvatar({ name, logo, size = 'md' }: { name: string; logo?: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-20 rounded-2xl text-2xl md:size-24' : 'size-12 rounded-xl text-base'
  const tile = (
    <span aria-hidden className={cn(box, 'flex shrink-0 items-center justify-center bg-mint font-semibold text-forest')}>
      {initials(name)}
    </span>
  )
  return logo ? <SellerLogo src={logo} className={cn(box, 'shrink-0')} fallback={tile} /> : tile
}

/**
 * Who sells it, on the listing page: a business links to its page (verified mark, kind, member since, reply time,
 * listing count); a private seller shows the contact name and city only — nothing is invented.
 */
export function SellerSummary({ listing, seller }: { listing: Listing; seller?: Seller }) {
  if (!seller) {
    const name = listing.contactName ?? 'Fərdi satıcı'
    return (
      <section aria-label="Satıcı" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-mint text-forest">
          <UserRound size={22} strokeWidth={1.8} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words text-ink">{name}</p>
          <p className="text-[13px] leading-[1.4] text-muted">Fərdi satıcı · {cityName(listing.cityId)}</p>
        </div>
      </section>
    )
  }
  const href = `/saticilar/${seller.slug}`
  const since = seller.memberSince ? `${ordinal(seller.memberSince)} ildən GreenStore-da` : undefined
  return (
    <section aria-label="Satıcı" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <SellerAvatar name={seller.name} logo={seller.logo} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex min-w-0 items-start gap-1.5">
            <Link href={href} className="line-clamp-2 text-[15px] leading-[1.35] font-semibold break-words text-ink hover:text-forest">
              {seller.name}
            </Link>
            {seller.verified && (
              <BadgeCheck aria-label="Təsdiqlənmiş satıcı" role="img" size={17} strokeWidth={2} className="mt-px shrink-0 text-success" />
            )}
          </p>
          <p className="text-[13px] leading-[1.4] text-muted">{[seller.kind, since].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {seller.responseMinutes != null && (
        <p className="flex items-center gap-2 text-[13px] leading-[1.4] text-ink-soft">
          <Clock3 aria-hidden size={15} strokeWidth={1.8} className="shrink-0 text-forest" />
          {responseLabel(seller.responseMinutes)}
        </p>
      )}
      <Link
        href={href}
        className="-mx-1 flex min-h-11 items-center justify-between rounded-lg px-1 text-sm leading-[normal] font-semibold text-forest transition-colors duration-(--dur-fast) hover:text-olive-text"
      >
        Satıcının bütün elanları · {formatNumber(seller.activeListings)}
        <ChevronRight aria-hidden size={18} strokeWidth={2} />
      </Link>
    </section>
  )
}
