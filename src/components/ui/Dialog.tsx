'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/* Figma "Dialoqlar": white panel, radius 12, p 24, 23 px title, 20 px gaps */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Keep the latest onClose without re-running the open effect (which would steal focus on every parent render).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-5" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full flex-col items-stretch gap-5 overflow-y-auto rounded-t-xl border border-line bg-surface p-6 outline-none sm:max-w-[432px] sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[23px] leading-[1.35] font-normal text-ink">{title}</h2>
          <button type="button" aria-label="Bağla" onClick={onClose} className="-m-1 rounded p-1 text-forest hover:bg-mint">
            <X size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
