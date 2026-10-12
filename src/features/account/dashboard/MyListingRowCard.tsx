import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { formatPrice } from '@/lib/format'
import { rowMeta, statusBadge } from './rowFormat'
import type { MyListingRow } from './useMyListingRows'

interface Props {
  row: MyListingRow
  onDeactivate: (row: MyListingRow) => void
  onRenew: (row: MyListingRow) => void
  onActivate: (row: MyListingRow) => void
}

/**
 * Figma "Şəxsi elan sətri": white, radius 12, p 18, gap 20; photo 130×105 (r 8); summary (badges, 15 px title,
 * 13 px muted meta, 8 px gaps); actions column 300 px (22 px price, buttons 8 px apart).
 * Below 768 px the actions drop under the photo + summary.
 */
export function MyListingRowCard({ row, onDeactivate, onRenew, onActivate }: Props) {
  const { listing, status } = row
  const badge = statusBadge[status]
  const detailHref = `/elanlar/${listing.slug}`

  let secondary
  if (status === 'active')
    secondary = (
      <Button variant="tertiary" onClick={() => onDeactivate(row)}>
        Deaktiv et
      </Button>
    )
  else if (status === 'expired')
    secondary = (
      <Button variant="tertiary" onClick={() => onRenew(row)}>
        Yenilə
      </Button>
    )
  else if (status === 'inactive')
    secondary = (
      <Button variant="tertiary" onClick={() => onActivate(row)}>
        Aktiv et
      </Button>
    )
  else
    secondary = (
      <ButtonLink to={detailHref} variant="tertiary">
        Bax
      </ButtonLink>
    )

  return (
    <article className="flex w-full flex-col gap-4 rounded-xl border border-line bg-surface p-[17px] md:flex-row md:items-start md:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5 md:gap-5">
        <img
          src={listing.thumbnail ?? listing.cover}
          alt={listing.title}
          loading="lazy"
          className="h-[84px] w-[104px] shrink-0 rounded-lg object-cover md:h-[105px] md:w-[130px]"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {listing.vip && <Badge tone="vip">VIP</Badge>}
          </div>
          <h3 className="w-full text-[15px] leading-[1.5] font-semibold break-words text-ink">
            <Link to={detailHref} className="hover:text-olive">
              {listing.title}
            </Link>
          </h3>
          <p className="w-full text-[13px] leading-[1.5] text-muted">{rowMeta(row)}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2.5 md:w-[220px] xl:w-[300px]">
        <p className="text-[22px] leading-[1.5] font-semibold whitespace-nowrap text-ink">{formatPrice(listing.price)}</p>
        <div className="flex w-full flex-wrap items-start gap-2">
          <ButtonLink to="/elan-yerlesdir/1" variant="secondary">
            Redaktə et
          </ButtonLink>
          {secondary}
        </div>
      </div>
    </article>
  )
}
