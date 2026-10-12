import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export interface ViewerImage {
  src: string
  alt: string
  title?: string
  description?: string
}

const roundButton =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface text-forest transition-transform hover:scale-105 ' +
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-olive'

/**
 * Full-screen photo viewer for the service gallery and "Tamamlanmış layihələr".
 * Esc closes, ←/→ switch photos; focus returns to the element that opened it.
 */
export function ImageViewer({ images, index, onClose, label }: { images: ViewerImage[]; index: number | null; onClose: () => void; label: string }) {
  const [current, setCurrent] = useState(index ?? 0)
  const [openedAt, setOpenedAt] = useState(index)
  if (index !== openedAt) {
    setOpenedAt(index)
    if (index != null) setCurrent(index)
  }
  const dialogRef = useRef<HTMLDivElement>(null)
  const open = index != null && images.length > 0
  const count = images.length

  const go = useCallback((step: number) => setCurrent((c) => (c + step + count) % count), [count])
  // Latest handlers for the document listener, so the open/close effect only runs when the viewer opens or closes.
  const handlers = useRef({ onClose, go })
  useEffect(() => {
    handlers.current = { onClose, go }
  })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handlers.current.onClose()
      else if (e.key === 'ArrowLeft') handlers.current.go(-1)
      else if (e.key === 'ArrowRight') handlers.current.go(1)
      else if (e.key === 'Tab' && dialogRef.current) {
        // keep focus inside the viewer
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      opener?.focus()
    }
  }, [open])

  if (!open) return null
  const image = images[Math.min(current, count - 1)]

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-white"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="page-x flex w-full items-center justify-between gap-4 py-4">
        <p className="text-[13px] leading-[1.5]" aria-live="polite">
          {current + 1} / {count}
        </p>
        <button type="button" aria-label="Bağla" onClick={onClose} className={roundButton}>
          <X aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5 md:px-20" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <img src={image.src} alt={image.alt} className="h-auto max-h-full w-full max-w-[1100px] rounded-lg object-contain" />
        {count > 1 && (
          <>
            <button type="button" aria-label="Əvvəlki şəkil" onClick={() => go(-1)} className={`${roundButton} absolute top-1/2 left-5 -translate-y-1/2 hover:scale-105`}>
              <ChevronLeft aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
            </button>
            <button type="button" aria-label="Növbəti şəkil" onClick={() => go(1)} className={`${roundButton} absolute top-1/2 right-5 -translate-y-1/2 hover:scale-105`}>
              <ChevronRight aria-hidden size={22} strokeWidth={1.8} absoluteStrokeWidth />
            </button>
          </>
        )}
      </div>

      <div className="page-x min-h-[72px] w-full py-4 text-center">
        {image.title && <p className="text-[15px] leading-[1.5] font-semibold">{image.title}</p>}
        {image.description && <p className="text-[13px] leading-[1.5] text-footer-text">{image.description}</p>}
      </div>
    </div>
  )
}
