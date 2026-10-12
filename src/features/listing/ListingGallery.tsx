'use client'

import { useState, type KeyboardEvent } from 'react'
import { ordinal } from './detail'

/*
 * Figma "Məhsul qalereyası": main photo 926×500 (r 8), 12 px gap, a row of 302×110 thumbnails (10 px gap),
 * caption "3 fotoşəkil · Örtük şəkli" (12 px / 1.5, muted).
 * The thumbnail grid (3 per row) always lists the photos that are not on the main stage, so the default state is exactly the
 * Figma frame (cover large + 3 thumbnails); clicking a thumbnail swaps it onto the stage.
 * ← / → on the focused gallery steps through the photos.
 */
export function ListingGallery({ images, title }: { images: string[]; title: string }) {
  const [current, setCurrent] = useState(0)
  const count = images.length
  const extra = count - 1
  const others = images.map((src, index) => ({ src, index })).filter((p) => p.index !== current)

  const step = (delta: number) => setCurrent((i) => (i + delta + count) % count)
  const onKeyDown = (e: KeyboardEvent) => {
    if (count < 2) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    }
  }

  const caption = current === 0 ? 'Örtük şəkli' : `${ordinal(current)} fotoşəkil`
  const photoAlt = (index: number) => (index === 0 ? title : `${title} — ${ordinal(index)} fotoşəkil`)

  return (
    <div
      role="group"
      aria-roledescription="qalereya"
      aria-label={`${title} — fotoşəkillər`}
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={onKeyDown}
      className="flex w-full min-w-0 flex-col items-start gap-3 rounded-lg focus-visible:outline-offset-4"
    >
      <img
        src={images[current]}
        alt={photoAlt(current)}
        className="h-[240px] w-full shrink-0 rounded-lg bg-disabled object-cover xs:h-[280px] md:h-auto md:aspect-[926/500] xl:h-[500px]"
      />
      {others.length > 0 && (
        <div className="grid w-full grid-cols-3 gap-2.5">
          {others.map(({ src, index }) => (
            <button
              key={src}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Göstər: ${index === 0 ? 'Örtük şəkli' : `${ordinal(index)} fotoşəkil`}`}
              className="group block h-[72px] w-full overflow-hidden rounded-lg md:h-[110px]"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="size-full rounded-lg bg-disabled object-cover transition-opacity group-hover:opacity-85"
              />
            </button>
          ))}
        </div>
      )}
      <p aria-live="polite" className="text-xs leading-[1.5] whitespace-nowrap text-muted">
        {extra > 0 ? `${extra} fotoşəkil · ${caption}` : caption}
      </p>
    </div>
  )
}
