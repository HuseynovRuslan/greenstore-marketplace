import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { cityName } from '@/data/cities'
import type { Seller } from '@/types'

/* Figma "Satıcı kartı": p 16, gap 12, radius 12, photo h 126, name 15 px semibold, "Quba · 19 aktiv elan" 13 px muted */
export function SellerCard({ seller }: { seller: Seller }) {
  return (
    <Link
      href={`/saticilar/${seller.slug}`}
      className="flex flex-col items-start gap-3 self-start overflow-hidden rounded-xl border border-line bg-surface p-[15px] transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover"
    >
      <img src={seller.image} alt={seller.name} loading="lazy" className="h-[126px] w-full shrink-0 rounded-lg object-cover" />
      <h3 className="text-[15px] leading-[1.5] font-semibold whitespace-nowrap text-ink">{seller.name}</h3>
      <p className="text-[13px] leading-[1.5] whitespace-nowrap text-muted">
        {cityName(seller.cityId)} · {seller.activeListings} aktiv elan
      </p>
      {seller.verified && <Badge tone="success">Təsdiqlənmiş satıcı</Badge>}
    </Link>
  )
}
