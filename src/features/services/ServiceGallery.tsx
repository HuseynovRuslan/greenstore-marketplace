'use client'

import { useCallback, useState } from 'react'
import { cn } from '@/lib/format'
import { ImageViewer } from './ImageViewer'

/*
 * Figma "Layihə qalereyası": main photo 926×490 (radius 8) + row of 3 thumbnails 120 px high, gap 12.
 * A thumbnail swaps into the main slot (the row always shows the other photos); the main photo opens the viewer.
 */
export function ServiceGallery({ images, title, className }: { images: string[]; title: string; className?: string }) {
  const [selected, setSelected] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const closeViewer = useCallback(() => setViewerIndex(null), [])
  if (!images.length) return null

  const thumbs = images.map((src, i) => ({ src, i })).filter(({ i }) => i !== selected).slice(0, 3)
  const viewerImages = images.map((src, i) => ({ src, alt: `${title} — şəkil ${i + 1}` }))

  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <button
        type="button"
        onClick={() => setViewerIndex(selected)}
        aria-label={`${title} — şəkil ${selected + 1} / ${images.length}, böyüt`}
        className="group block w-full cursor-zoom-in overflow-hidden rounded-lg focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:outline-none"
      >
        <img
          src={images[selected]}
          alt=""
          className="h-[240px] w-full rounded-lg object-cover transition-transform duration-300 group-hover:scale-[1.01] md:aspect-[926/490] md:h-auto"
        />
      </button>
      {thumbs.length > 0 && (
        <ul className="grid w-full grid-cols-3 gap-3" aria-label="Digər şəkillər">
          {thumbs.map(({ src, i }) => (
            <li key={src} className="min-w-0">
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`${title} — şəkil ${i + 1}`}
                className="block w-full overflow-hidden rounded-lg transition-opacity hover:opacity-85 focus-visible:ring-[3px] focus-visible:ring-olive focus-visible:outline-none"
              >
                <img src={src} alt="" loading="lazy" className="h-[72px] w-full rounded-lg object-cover md:aspect-[301/120] md:h-auto" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ImageViewer images={viewerImages} index={viewerIndex} onClose={closeViewer} label={`${title} — şəkillər`} />
    </div>
  )
}
