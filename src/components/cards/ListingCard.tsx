import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { FavoriteButton } from './FavoriteButton'
import { cityName } from '@/data/cities'
import { cn, formatDayMonth, formatPrice } from '@/lib/format'
import type { Listing } from '@/types'

interface ListingCardProps {
  listing: Listing
  /** Force the compact 390 px variant regardless of viewport (e.g. narrow side columns). */
  compact?: boolean
  /** Image height on ≥ md screens (Figma uses 210 px on every desktop/tablet card). */
  className?: string
}

/*
 * Figma "Elan kartı" (components frame + home 1440/768/390):
 *  desktop/tablet: p 14, gap 8, radius 12, photo h 210 radius 8, price 23 px, title 15 px semibold, meta 12 px muted (leading 1.6)
 *  mobile (390):   p 10, photo h 145, price 20 px, title 13 px, meta 11 px
 *  hover: border #788149 + shadow 0 8 24 rgba(23,63,50,.1); overlays sit 7 px inside the photo.
 *  Figma strokes are inside the box, so padding/offsets here are 1 px smaller to make room for the CSS border.
 */
export function ListingCard({ listing, compact, className }: ListingCardProps) {
  const meta = listing.attributes.join(' · ')
  return (
    <Link
      to={`/elanlar/${listing.slug}`}
      className={cn(
        'group relative flex w-full flex-col items-start gap-2 self-start overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover',
        compact ? 'p-[9px]' : 'p-[9px] md:p-[13px]',
        className,
      )}
    >
      {/* Art direction: the 390 / 768 Figma frames show their own photo of the product. */}
      <picture className="block w-full shrink-0">
        {listing.coverMobile && <source media={compact ? undefined : '(max-width: 767.98px)'} srcSet={listing.coverMobile} />}
        {!compact && listing.coverTablet && <source media="(max-width: 1279.98px)" srcSet={listing.coverTablet} />}
        <img
          src={listing.cover}
          alt={listing.title}
          loading="lazy"
          className={cn('block w-full rounded-lg object-cover', compact ? 'h-[145px]' : 'h-[145px] md:h-[210px]')}
        />
      </picture>
      {listing.vip && (
        <Badge tone="vip" className={cn('absolute top-5', compact ? 'left-4' : 'left-4 md:left-5')}>
          VIP
        </Badge>
      )}
      <FavoriteButton
        kind="listing"
        id={listing.id}
        title={listing.title}
        className={cn('absolute top-5', compact ? 'right-4' : 'right-4 md:right-5')}
      />
      {/* Figma's text box is shorter than its 1.6 line boxes; the negative margin keeps card heights at Figma's 259 / 340 px. */}
      <div className={cn('w-full min-w-0 leading-[1.6] break-words', compact ? '-mb-0.5' : '-mb-0.5 md:-mb-[5px]')}>
        <p className={cn('text-ink', compact ? 'text-[20px]' : 'text-[20px] md:text-[23px]')}>{formatPrice(listing.price)}</p>
        <h3 className={cn('font-semibold text-ink', compact ? 'text-[13px]' : 'text-[13px] md:text-[15px]')}>{listing.title}</h3>
        <p className={cn('text-muted', compact ? 'text-[11px]' : 'text-[11px] md:text-[12px]')}>{meta}</p>
        <p className={cn('text-muted', compact ? 'text-[11px]' : 'text-[11px] md:text-[12px]')}>
          {cityName(listing.cityId)} · {formatDayMonth(listing.publishedAt)}
        </p>
      </div>
    </Link>
  )
}
