'use client'

import { useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Expand, ImageOff } from 'lucide-react'
import { cn } from '@/lib/format'
import { Lightbox } from './Lightbox'
import { useSnapIndex } from './useSnapIndex'

const arrowButton =
  'absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/95 text-forest shadow-popover transition-[opacity,scale] duration-(--dur-fast) ease-out hover:bg-surface active:scale-[0.95] pointer-coarse:hidden motion-reduce:active:scale-100'

interface GalleryProps {
  images: string[]
  title: string
  /** Overlay on the first photo's corner (the «Önə çıxan» badge). */
  badge?: ReactNode
  className?: string
}

/**
 * Listing photos (every one, cover first). The stage is a scroll-snap track: swipe on touch screens, the arrow
 * buttons or ← / → with a mouse and keyboard. The counter and the thumbnail strip (from 768 px) follow the photo on
 * the stage; a tap on the photo opens the full-screen viewer at the same photo, and closing it brings the stage there.
 * The stage keeps a fixed 4:3 box while photos load (no layout shift); the first photo loads eagerly (it is the
 * page's largest image), the others lazily. Phones show the stage edge to edge.
 */
export function Gallery({ images, title, badge, className }: GalleryProps) {
  const { trackRef, index, goTo } = useSnapIndex(images.length)
  const [viewer, setViewer] = useState<number | null>(null)
  const count = images.length

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight' && index < count - 1) {
      e.preventDefault()
      goTo(index + 1)
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      goTo(index - 1)
    }
  }

  if (count === 0) {
    return (
      <div className={cn('-mx-5 flex aspect-[4/3] items-center justify-center bg-mint text-muted md:mx-0 md:rounded-xl', className)}>
        <ImageOff aria-hidden size={32} strokeWidth={1.6} />
        <span className="sr-only">Şəkil yoxdur</span>
      </div>
    )
  }

  return (
    <div role="region" aria-roledescription="qalereya" aria-label={`${title} — şəkillər`} onKeyDown={onKeyDown} className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <div className="group/stage relative -mx-5 overflow-hidden bg-mint md:mx-0 md:rounded-xl">
        <div ref={trackRef} className="scrollbar-none flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto overscroll-x-contain">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setViewer(i)}
              aria-label={`Şəkli böyüt: ${i + 1} / ${count}`}
              // Off-screen slides stay out of the Tab order; the arrows and thumbnails reach them.
              tabIndex={i === index ? 0 : -1}
              className="relative h-full w-full shrink-0 cursor-zoom-in snap-center focus-visible:outline-offset-[-4px]"
            >
              <img
                src={src}
                alt={i === 0 ? title : `${title} — şəkil ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                decoding={i === 0 ? 'sync' : 'async'}
                draggable={false}
                className="size-full object-cover select-none"
              />
            </button>
          ))}
        </div>
        {badge && <div className="pointer-events-none absolute top-3 left-3">{badge}</div>}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Əvvəlki şəkil"
              className={cn(arrowButton, 'left-3 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100', index === 0 && 'invisible')}
            >
              <ChevronLeft aria-hidden size={22} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Növbəti şəkil"
              className={cn(arrowButton, 'right-3 opacity-0 group-hover/stage:opacity-100 focus-visible:opacity-100', index === count - 1 && 'invisible')}
            >
              <ChevronRight aria-hidden size={22} strokeWidth={2} />
            </button>
          </>
        )}
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2">
          <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-semibold text-white tabular-nums backdrop-blur-sm">
            <span className="sr-only">Şəkil </span>
            {index + 1} / {count}
          </span>
          <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-ink/70 text-white backdrop-blur-sm max-md:hidden">
            <Expand size={14} strokeWidth={2} />
          </span>
        </div>
      </div>

      {count > 1 && (
        <ul aria-label="Kiçik şəkillər" className="scrollbar-none flex gap-2 overflow-x-auto max-md:hidden">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Şəkil ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                className={cn(
                  'block h-[66px] w-[88px] overflow-hidden rounded-lg border-2 transition-[border-color,opacity] duration-(--dur-fast)',
                  i === index ? 'border-forest' : 'border-transparent opacity-80 hover:opacity-100',
                )}
              >
                <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer != null && (
        <Lightbox
          images={images}
          title={title}
          start={viewer}
          onClose={(last) => {
            setViewer(null)
            if (last !== index) goTo(last)
          }}
        />
      )}
    </div>
  )
}
