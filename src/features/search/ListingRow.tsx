import Link from 'next/link'
import { cardFocusClass, stretchedLinkClass } from '@/components/cards/ListingCard'
import { FavoriteButton } from '@/components/cards/FavoriteButton'
import { PromotedBadge } from '@/components/ui/PromotedBadge'
import { cityName } from '@/data/cities'
import { cn, formatFullDate, formatPrice } from '@/lib/format'
import type { Listing } from '@/types'

/**
 * «Siyahı» view of a search result (not in the mockups): the Variant 2 card content in a row.
 *  ≥ 768 px: 4:3 photo (220 px) with the badge and the favourite button on it · title (two lines), details,
 *            «Bakı · 12 oktyabr 2026» · the price in its own right-aligned column, so prices line up down the list.
 *  phones:  128 px photo with the favourite button; badge, price, title and «city · date» beside it.
 * As on the card, the title link covers the row and the favourite button sits above it.
 */
export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <article
      className={cn(
        'group relative flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-[7px] transition-[border-color,box-shadow] duration-(--dur-base) hover:border-olive hover:shadow-card-hover md:gap-5 md:p-[11px]',
        cardFocusClass,
      )}
    >
      <div className="relative w-[128px] shrink-0 md:w-[220px]">
        <div className="overflow-hidden rounded-lg">
          <img
            src={listing.cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="block aspect-[4/3] w-full object-cover transition-transform duration-(--dur-slow) ease-out motion-safe:group-hover:scale-[1.03]"
          />
        </div>
        {listing.vip && <PromotedBadge size="card" className="absolute top-2 left-2 max-md:hidden" />}
        <FavoriteButton kind="listing" id={listing.id} title={listing.title} className="absolute top-0.5 right-0.5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] self-stretch py-0.5 md:flex-row md:gap-5 md:py-1">
        {listing.vip && <PromotedBadge size="card" className="order-first self-start md:hidden" />}
        <div className="flex min-w-0 flex-1 flex-col gap-[3px] md:gap-1">
          <h3 className="line-clamp-2 text-[13px] leading-[1.35] font-semibold break-words text-ink md:text-[15px]">
            <Link href={`/elanlar/${listing.slug}`} className={stretchedLinkClass}>
              {listing.title}
            </Link>
          </h3>
          <p className="truncate text-[13px] leading-[1.4] text-muted max-md:hidden">{listing.attributes.join(' · ')}</p>
          <p className="mt-auto truncate text-xs leading-[1.4] text-muted md:text-[13px]">
            {cityName(listing.cityId)} · <time dateTime={listing.publishedAt}>{formatFullDate(listing.publishedAt)}</time>
          </p>
        </div>
        <p className="text-[17px] leading-[1.25] font-bold whitespace-nowrap text-forest tabular-nums max-md:order-first md:min-w-[112px] md:pr-1 md:text-right md:text-[21px]">
          {formatPrice(listing.price)}
        </p>
      </div>
    </article>
  )
}
