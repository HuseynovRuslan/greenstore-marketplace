import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { providerName } from '@/data/services'
import type { Service } from '@/types'

/* Figma home "Xidmət kartı": p 12, gap 12, radius 12, photo h 200, price 22 px semibold, title 15 px semibold, provider 13 px muted */
/** `image` lets curated sections (home showcase) use the photo Figma shows there. */
export function ServiceCard({ service, image }: { service: Service; image?: string }) {
  return (
    <Link
      to={`/xidmetler/${service.slug}`}
      className="flex flex-col items-start gap-3 self-start overflow-hidden rounded-xl border border-line bg-surface p-[11px] transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover"
    >
      <img src={image ?? service.cover} alt={service.title} loading="lazy" className="h-[200px] w-full shrink-0 rounded-lg object-cover" />
      <p className="text-[22px] leading-[1.5] font-semibold whitespace-nowrap text-ink">{service.priceLabel}</p>
      <h3 className="w-full text-[15px] leading-[1.5] font-semibold text-ink">{service.homeTitle ?? service.title}</h3>
      <p className="w-full text-[13px] leading-[1.5] text-muted">
        {providerName(service.providerId)} · {service.areas.join(', ')}
      </p>
      {service.verified && <Badge tone="success">Təsdiqlənmiş xidmət göstərən</Badge>}
    </Link>
  )
}
