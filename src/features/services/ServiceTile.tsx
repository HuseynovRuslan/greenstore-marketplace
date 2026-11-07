import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { CardImage } from '@/components/cards/CardImage'
import { FavoriteButton } from '@/components/cards/FavoriteButton'
import { cardFocusClass, stretchedLinkClass } from '@/components/cards/ListingCard'
import { providerName } from '@/data/services'
import { cn } from '@/lib/format'
import type { Service } from '@/types'

/**
 * Service card in the catalogue's card language (Variant 2 ListingCard): photo 4:3, price in forest, title on two
 * lines, provider and areas, a verified mark; the title link covers the card and the heart sits on the photo.
 */
export function ServiceTile({ service, className }: { service: Service; className?: string }) {
  return (
    <article
      className={cn(
        'group/card relative flex h-full w-full min-w-0 flex-col gap-2 rounded-xl border border-line bg-surface p-[7px] transition-[border-color,box-shadow,scale] duration-(--dur-base) ease-out hover:border-olive hover:shadow-card-hover has-[a:active]:scale-[0.98] has-[a:active]:duration-(--dur-fast) motion-reduce:has-[a:active]:scale-100 md:gap-3 md:p-[11px]',
        cardFocusClass,
        className,
      )}
    >
      <CardImage
        src={service.cover}
        className="aspect-[4/3] rounded-lg"
        imgClassName="transition-transform duration-(--dur-base) ease-out motion-safe:group-hover/card:scale-[1.03]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px] px-0.5 pb-0.5 md:px-1 md:pb-1">
        <p className="text-[17px] leading-[1.25] font-bold text-forest md:text-[21px]">{service.priceLabel}</p>
        <h3 className="line-clamp-2 text-[13px] leading-[1.35] font-semibold break-words text-ink md:text-[15px]">
          <Link href={`/xidmetler/${service.slug}`} className={stretchedLinkClass}>
            {service.title}
          </Link>
        </h3>
        <p className="mt-auto flex min-w-0 items-center gap-1 pt-0.5 text-xs leading-[1.4] text-muted md:text-[13px]">
          <span className="truncate">
            {providerName(service.providerId)} · {service.areas.join(', ')}
          </span>
          {service.verified && <BadgeCheck aria-label="Təsdiqlənmiş" role="img" size={15} strokeWidth={2} className="shrink-0 text-success" />}
        </p>
      </div>
      <FavoriteButton kind="service" id={service.id} title={service.title} className="absolute top-[9px] right-[9px] md:top-[13px] md:right-[13px]" />
    </article>
  )
}
