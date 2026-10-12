import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { providerName } from '@/data/services'
import type { Service } from '@/types'

/*
 * Figma "Xidmət elanı" (Xidmətlər · 1440): white, 1 px #dee3d9 (inside stroke → 13 px padding + border = 14), radius 12, gap 12;
 * photo h 230 radius 8 · price 21 px semibold · title 15 px semibold · provider/areas 13 px muted
 * (leading 1.5, rounded to the 32/23/20 px text boxes Figma uses)
 * · "Təsdiqlənmiş xidmət göstərən" badge · full-width secondary "Xidmətə bax" button.
 * No favourite heart on this card in Figma. Hover follows the other cards (olive border + soft shadow).
 */
export function ServiceListingCard({ service }: { service: Service }) {
  const to = `/xidmetler/${service.slug}`
  return (
    <article className="flex w-full min-w-0 flex-col items-start gap-3 self-start overflow-hidden rounded-xl border border-line bg-surface p-[13px] transition-[border-color,box-shadow] hover:border-olive hover:shadow-card-hover">
      <Link to={to} tabIndex={-1} aria-hidden className="block w-full shrink-0">
        <img src={service.cover} alt={service.title} loading="lazy" className="h-[230px] w-full rounded-lg object-cover" />
      </Link>
      <p className="w-full text-[21px] leading-[32px] font-semibold text-ink">{service.priceLabel}</p>
      <h3 className="w-full text-[15px] leading-[23px] font-semibold text-ink">
        <Link to={to} className="hover:text-forest-hover">
          {service.title}
        </Link>
      </h3>
      <p className="w-full text-[13px] leading-[20px] text-muted">
        {providerName(service.providerId)} · {service.areas.join(', ')}
      </p>
      {service.verified && <Badge tone="success">Təsdiqlənmiş xidmət göstərən</Badge>}
      <ButtonLink to={to} variant="secondary" fullWidth aria-label={`${service.title} — xidmətə bax`}>
        Xidmətə bax
      </ButtonLink>
    </article>
  )
}
