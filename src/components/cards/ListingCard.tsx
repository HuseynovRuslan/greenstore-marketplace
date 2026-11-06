import Link from 'next/link'
import { CardImage } from '@/components/cards/CardImage'
import { PromotedBadge } from '@/components/ui/PromotedBadge'
import { RelativeDate } from '@/components/ui/RelativeDate'
import { cityName } from '@/data/cities'
import { cn, formatPrice } from '@/lib/format'
import type { Listing } from '@/types'
import { FavoriteButton } from './FavoriteButton'

/** Classes that make a card's title link cover the whole card (the favourite button sits above it). */
export const stretchedLinkClass = "focus-visible:outline-hidden after:absolute after:inset-0 after:rounded-xl after:content-['']"

/** The card shows the focus ring of its link, since the link covers the card. */
export const cardFocusClass = 'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-olive'

/*
 * Variant 2 listing card (docs/design/variant-2):
 *  ≥ 768 px: p 12, gap 12, radius 12; photo 4:3, radius 8; price 21 px bold forest; title 15 px semibold, two lines;
 *           details 13 px muted; «Bakı · 2 gün əvvəl» 13 px muted.
 *  phones:  p 8, gap 8; square photo; price 17 px; title 13 px, two lines (an 80-character title showed ~20
 *           characters on one); city 12 px (no details, no date).
 * The badge and the favourite button sit on the photo. The title link covers the card (one link, one Tab stop);
 * the favourite button is its own control above it. Cards in a row share one height: the city line sits at the
 * bottom. Hover: olive border, soft shadow and the photo zooms to 1.03 (not under reduced motion). A photo that
 * fails to load leaves the box and a placeholder (CardImage).
 * Borders are inside the mockup box, so paddings and offsets are 1 px smaller here.
 */
export function ListingCard({ listing, className }: { listing: Listing; className?: string }) {
  const details = listing.attributes.join(' · ')
  const sources = [
    listing.coverMobile && { media: '(max-width: 767.98px)', srcSet: listing.coverMobile },
    listing.coverTablet && { media: '(max-width: 1279.98px)', srcSet: listing.coverTablet },
  ].filter((s): s is { media: string; srcSet: string } => Boolean(s))
  return (
    <article
      className={cn(
        'group relative flex h-full w-full min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-[7px] transition-[border-color,box-shadow] duration-(--dur-base) ease-out hover:border-olive hover:shadow-card-hover md:gap-3 md:p-[11px]',
        cardFocusClass,
        className,
      )}
    >
      <div className="relative">
        {/* Art direction: the 390 / 768 Figma frames show their own photo of the product. The title says what it is. */}
        <CardImage
          src={listing.cover}
          sources={sources}
          className="aspect-square rounded-lg md:aspect-[4/3]"
          imgClassName="transition-transform duration-(--dur-base) ease-out motion-safe:group-hover:scale-[1.03]"
        />
        {listing.vip && <PromotedBadge size="card" className="absolute top-1.5 left-1.5 md:top-2 md:left-2" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] px-0.5 pb-0.5 md:px-1 md:pb-1">
        <p className="text-[17px] leading-[1.25] font-bold text-forest tabular-nums md:text-[21px]">{formatPrice(listing.price)}</p>
        <h3 className="line-clamp-2 text-[13px] leading-[1.35] font-semibold break-words text-ink md:text-[15px]">
          <Link href={`/elanlar/${listing.slug}`} className={stretchedLinkClass}>
            {listing.title}
          </Link>
        </h3>
        {details && <p className="truncate text-[13px] leading-[1.4] text-muted max-md:hidden">{details}</p>}
        <p className="mt-auto truncate pt-0.5 text-xs leading-[1.4] text-muted md:text-[13px]">
          {cityName(listing.cityId)}
          <span className="max-md:hidden">
            {' · '}
            <RelativeDate iso={listing.publishedAt} />
          </span>
        </p>
      </div>
      <FavoriteButton kind="listing" id={listing.id} title={listing.title} className="absolute top-[9px] right-[9px] md:top-[13px] md:right-[13px]" />
    </article>
  )
}
