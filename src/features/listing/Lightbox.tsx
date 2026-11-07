'use client'

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/format'
import { useSnapIndex } from './useSnapIndex'

interface LightboxProps {
  images: string[]
  title: string
  start: number
  onClose: (index: number) => void
}

const FOCUSABLE = 'button:not([disabled])'
const roundButton =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface/10 text-white transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-surface/20 active:scale-[0.95] disabled:opacity-30 motion-reduce:active:scale-100'

/**
 * Full-screen photo viewer. Swipe (scroll snap), ← / → and the side buttons move between photos; «Böyüt», a double
 * click or a double tap zooms the current photo to twice its size, and then it pans by scrolling or dragging a finger
 * (the swipe between photos is paused while zoomed). Esc or «Bağla» closes it and focus returns to the photo that
 * opened it; Tab stays inside. It fades in (opacity only, so reduced motion needs nothing else) and closes at once.
 */
export function Lightbox({ images, title, start, onClose }: LightboxProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { trackRef, index, goTo } = useSnapIndex(images.length, start)
  const [zoomed, setZoomed] = useState(false)
  const count = images.length

  useEffect(() => {
    const body = document.body
    const previous = body.style.overflow
    body.style.overflow = 'hidden'
    const opener = document.activeElement as HTMLElement | null
    rootRef.current?.focus()
    return () => {
      body.style.overflow = previous
      opener?.focus?.()
    }
  }, [])

  const move = (delta: number) => {
    setZoomed(false)
    goTo(Math.min(count - 1, Math.max(0, index + delta)))
  }

  const toggleZoom = (e?: ReactMouseEvent<HTMLElement>) => {
    const slide = trackRef.current?.children[index] as HTMLElement | undefined
    const next = !zoomed
    setZoomed(next)
    // Zoom towards the point that was clicked: scroll the 2× image so that point stays under the pointer.
    if (next && slide && e) {
      const rect = slide.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width
      const y = (e.clientY - rect.top) / rect.height
      requestAnimationFrame(() => slide.scrollTo?.({ left: x * slide.clientWidth, top: y * slide.clientHeight }))
    }
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose(index)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Tab') {
      const focusable = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — şəkillər`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[70] flex flex-col bg-ink text-white outline-none transition-opacity duration-(--dur-base) ease-out starting:opacity-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-3 md:px-5">
        <p className="pl-2 text-sm font-medium tabular-nums" aria-live="polite">
          <span className="sr-only">Şəkil </span>
          {index + 1} / {count}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => toggleZoom()} aria-pressed={zoomed} aria-label={zoomed ? 'Kiçilt' : 'Böyüt'} className={roundButton}>
            {zoomed ? <ZoomOut aria-hidden size={20} strokeWidth={1.8} /> : <ZoomIn aria-hidden size={20} strokeWidth={1.8} />}
          </button>
          <button type="button" onClick={() => onClose(index)} aria-label="Bağla" className={roundButton}>
            <X aria-hidden size={22} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Focusable, so a keyboard can scroll a zoomed photo too (← → move between photos on the whole dialog). */}
        <div
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label="Şəkillər: ← və → ilə keçin"
          className={cn('scrollbar-none flex h-full overscroll-contain outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-olive', zoomed ? 'overflow-hidden' : 'snap-x snap-mandatory overflow-x-auto')}
        >
          {images.map((src, i) => (
            <div
              key={src}
              className={cn('h-full w-full shrink-0 snap-center', zoomed && i === index ? 'overflow-auto' : 'flex items-center justify-center overflow-hidden')}
              onDoubleClick={toggleZoom}
            >
              <img
                src={src}
                alt={`${title} — şəkil ${i + 1}`}
                loading={Math.abs(i - start) <= 1 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
                className={cn(
                  'select-none',
                  zoomed && i === index ? 'h-[200%] w-[200%] max-w-none cursor-zoom-out object-contain' : 'max-h-full max-w-full cursor-zoom-in object-contain',
                )}
              />
            </div>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="Əvvəlki şəkil" className={cn(roundButton, 'absolute top-1/2 left-3 -translate-y-1/2 max-md:hidden md:left-5')}>
              <ChevronLeft aria-hidden size={24} strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => move(1)} disabled={index === count - 1} aria-label="Növbəti şəkil" className={cn(roundButton, 'absolute top-1/2 right-3 -translate-y-1/2 max-md:hidden md:right-5')}>
              <ChevronRight aria-hidden size={24} strokeWidth={1.8} />
            </button>
          </>
        )}
      </div>
      <p className="shrink-0 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] text-center text-xs text-footer-text md:hidden">
        Sürüşdürün · iki dəfə toxunub böyüdün
      </p>
    </div>,
    document.body,
  )
}
