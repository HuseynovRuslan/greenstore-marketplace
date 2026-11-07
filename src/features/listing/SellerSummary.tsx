import Link from 'next/link'
import { BadgeCheck, ChevronRight, Clock3, UserRound } from 'lucide-react'
import { cityName } from '@/data/cities'
import { cn, formatNumber, upperAz } from '@/lib/format'
import type { Listing, Seller } from '@/types'
import { ordinal } from './detail'

/** "AT" from "Abşeron Tingçilik"; one letter for one word. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return upperAz(words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 1))
}

/** 60 → «Adətən 1 saat ərzində cavab verir», 30 → «… 30 dəqiqə …» */
export function responseLabel(minutes: number): string {
  if (minutes < 60) return `Adətən ${minutes} dəqiqə ərzində cavab verir`
  const hours = Math.round(minutes / 60)
  return hours >= 24 ? 'Adətən bir gün ərzində cavab verir' : `Adətən ${hours} saat ərzində cavab verir`
}

/** Square avatar: the logo, or initials on mint. */
export function SellerAvatar({ name, logo, size = 'md' }: { name: string; logo?: string; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'size-20 rounded-2xl text-2xl md:size-24' : 'size-12 rounded-xl text-base'
  if (logo) return <img src={logo} alt="" className={cn(box, 'shrink-0 object-cover')} />
  return (
    <span aria-hidden className={cn(box, 'flex shrink-0 items-center justify-center bg-mint font-semibold text-forest')}>
      {initials(name)}
    </span>
  )
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
          <p className="truncate text-[15px] leading-[1.35] font-semibold text-ink">{name}</p>
          <p className="text-[13px] leading-[1.4] text-muted">Fərdi satıcı · {cityName(listing.cityId)}</p>
        </div>
      </section>
    )
  }
  const href = `/saticilar/${seller.slug}`
  const since = seller.memberSince ? `${ordinal(seller.memberSince)} ildən GreenStore-da` : undefined
  return (
    <section aria-label="Satıcı" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <SellerAvatar name={seller.name} logo={seller.logo} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex min-w-0 items-center gap-1.5">
            <Link href={href} className="truncate text-[15px] leading-[1.35] font-semibold text-ink hover:text-forest">
              {seller.name}
            </Link>
            {seller.verified && (
              <BadgeCheck aria-label="Təsdiqlənmiş satıcı" role="img" size={17} strokeWidth={2} className="shrink-0 text-success" />
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
