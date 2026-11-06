'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/format'

interface CardImageProps {
  src: string
  /** Art-directed photos, first match wins (e.g. the 390 and 768 frames' own photos). */
  sources?: Array<{ media: string; srcSet: string }>
  /** The photo box: aspect ratio and radius. */
  className?: string
  /** Extra classes for the <img> (hover zoom). */
  imgClassName?: string
}

/**
 * A card photo in a fixed box on the mint placeholder colour. The box keeps its shape while the photo loads, and a
 * photo that fails (404, CDN outage) leaves the placeholder with a quiet icon instead of a collapsed strip with the
 * browser's broken-image glyph. The photo is decorative (alt=""): the card title names the listing.
 */
export function CardImage({ src, sources = [], className, imgClassName }: CardImageProps) {
  const [failed, setFailed] = useState(false)
  // A photo can fail before hydration, while onError is not attached yet: check once the element is in place.
  const checkLoaded = (img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }
  return (
    <picture className={cn('relative block overflow-hidden bg-mint', className)}>
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-muted">
          <ImageOff aria-hidden size={28} strokeWidth={1.6} />
        </span>
      ) : (
        <>
          {sources.map((s) => (
            <source key={s.media} media={s.media} srcSet={s.srcSet} />
          ))}
          <img
            ref={checkLoaded}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={cn('absolute inset-0 size-full object-cover', imgClassName)}
          />
        </>
      )}
    </picture>
  )
}
