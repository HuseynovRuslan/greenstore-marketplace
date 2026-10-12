'use client'

import { Heart } from 'lucide-react'
import { useFavorites } from '@/state/store'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { providerName } from '@/data/services'
import type { Service } from '@/types'
import { Card } from '../ui'

/** Photo Figma uses for the saved "Landşaft dizaynı" card (falls back to the service cover). */
const savedServicePhotos: Record<string, string> = {
  'landsaft-dizayni': '/images/favorites/saved-service.webp',
}

/**
 * Figma "Seçilmiş xidmət" (Seçilmişlər · 390): panel p 24; photo h 220 (r 8); 24 px gap; summary with 14 px gaps —
 * badge, 23 px title, 24 px semibold price, 13 px muted provider · areas, "Xidmətə bax" / "Seçilmişlərdən sil".
 * Tablet lays the same card out horizontally (photo left) so the actions keep one row.
 */
export function SavedServiceCard({ service }: { service: Service }) {
  const { toggleFavorite } = useFavorites()
  return (
    <Card className="w-full gap-6 md:flex-row xl:flex-col">
      <img
        src={savedServicePhotos[service.id] ?? service.cover}
        alt={service.title}
        loading="lazy"
        className="h-[220px] w-full shrink-0 rounded-lg object-cover md:w-[302px] xl:w-full"
      />
      <div className="flex w-full min-w-0 flex-col items-start gap-3.5 md:flex-1">
        {service.verified && <Badge tone="success">Təsdiqlənmiş xidmət göstərən</Badge>}
        <h3 className="w-full text-[23px] leading-[1.35] font-normal break-words text-ink">{service.title}</h3>
        <p className="text-2xl leading-[1.5] font-semibold whitespace-nowrap text-ink">{service.priceLabel}</p>
        <p className="w-full text-[13px] leading-[1.5] text-muted">
          {providerName(service.providerId)} · {service.areas.join(', ')}
        </p>
        {/* 6 px instead of Figma's 8 px so both buttons still fit one row on a 390 px screen with browser text metrics */}
        <div className="flex w-full flex-wrap items-start gap-x-1.5 gap-y-2">
          <ButtonLink href={`/xidmetler/${service.slug}`}>Xidmətə bax</ButtonLink>
          <Button
            variant="secondary"
            icon={<Heart aria-hidden size={18} strokeWidth={1.8} absoluteStrokeWidth />}
            onClick={() => toggleFavorite('service', service.id)}
          >
            Seçilmişlərdən sil
          </Button>
        </div>
      </div>
    </Card>
  )
}
