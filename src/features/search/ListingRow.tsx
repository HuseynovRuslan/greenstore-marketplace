import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { FavoriteButton } from '@/components/cards/FavoriteButton'
import { cityName } from '@/data/cities'
import { formatDayMonth, formatPrice } from '@/lib/format'
import type { Listing } from '@/types'

/**
 * "Siyahı" view of a search result. Not drawn in Figma; it combines the "Elan kartı" content and type scale
 * (23 px price, 15 px semibold title, 12 px muted meta, VIP badge, 34 px favourite button, olive hover border)
 * with the horizontal row layout of "Şəxsi elan sətri" (white, 1 px border, r 12, p 18, r 8 photo).
 */
export function ListingRow({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/elanlar/${listing.slug}`}
      className="group relative flex w-full items-start gap-3.5 rounded-xl border border-line bg-surface p-2.5 transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover md:gap-5 md:p-[18px]"
    >
      <div className="relative shrink-0">
        <img
          src={listing.cover}
          alt={listing.title}
          loading="lazy"
          className="h-[104px] w-[120px] rounded-lg object-cover md:h-[150px] md:w-[220px]"
        />
        {listing.vip && (
          <Badge tone="vip" className="absolute top-[7px] left-[7px]">
            VIP
          </Badge>
        )}
      </div>
      <div className="min-w-0 flex-1 pr-10 leading-[1.6] break-words md:pr-12">
        <p className="text-[20px] text-ink md:text-[23px]">{formatPrice(listing.price)}</p>
        <h3 className="text-[13px] font-semibold text-ink md:text-[15px]">{listing.title}</h3>
        <p className="text-[11px] text-muted md:text-[12px]">{listing.attributes.join(' · ')}</p>
        <p className="text-[11px] text-muted md:text-[12px]">
          {cityName(listing.cityId)} · {formatDayMonth(listing.publishedAt)}
        </p>
      </div>
      <FavoriteButton
        kind="listing"
        id={listing.id}
        title={listing.title}
        className="absolute top-2.5 right-2.5 border border-line md:top-[18px] md:right-[18px]"
      />
    </Link>
  )
}
