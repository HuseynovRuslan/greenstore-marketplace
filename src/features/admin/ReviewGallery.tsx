'use client'

import { useState } from 'react'
import { ExternalLink, ImageOff } from 'lucide-react'
import { cn } from '@/lib/format'

/**
 * The listing's photos in the moderation review: the whole photo (never cropped, a moderator judges what is in it),
 * the others as thumbnails that swap it, and the original in a new tab. No photos: said plainly, it is a flag.
 */
export function ReviewGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-lg bg-sand text-danger">
        <ImageOff aria-hidden size={28} strokeWidth={1.6} />
        <p className="text-sm font-semibold">Şəkil əlavə edilməyib</p>
      </div>
    )
  }
  const current = images[Math.min(index, images.length - 1)]
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="relative w-full overflow-hidden rounded-lg bg-sand">
        <img src={current} alt={`${title}: şəkil ${index + 1}`} className="mx-auto aspect-[4/3] max-h-[440px] w-full object-contain" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-2.5">
          <span className="rounded-md bg-ink/70 px-2 py-1 text-xs font-semibold text-white tabular-nums">
            {index + 1} / {images.length}
          </span>
          <a
            href={current}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-surface/90 px-2.5 text-xs font-semibold text-forest transition-colors duration-(--dur-fast) hover:bg-surface"
          >
            <ExternalLink aria-hidden size={14} strokeWidth={2} />
            Tam ölçüdə aç
          </a>
        </div>
      </div>
      {images.length > 1 && (
        <ul aria-label="Şəkillər" className="flex w-full gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                aria-pressed={i === index}
                aria-label={`Şəkil ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'block size-16 overflow-hidden rounded-md border-2 transition-colors duration-(--dur-fast)',
                  i === index ? 'border-forest' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                <img src={src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
