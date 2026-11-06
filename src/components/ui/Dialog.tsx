'use client'

import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/format'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra classes for the panel (e.g. a wider sheet). */
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/*
 * Figma "Dialoqlar": white panel, radius 12, p 24, 23 px title, 20 px gaps. Below 640 px it is a bottom sheet.
 * It slides up (sheet) or fades and settles (centred panel) on open; only fades under reduced motion.
 * Tab and Shift+Tab stay inside the panel while it is open.
 */
export function Dialog({ open, title, onClose, children, className }: DialogProps) {
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
    const body = document.body
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
    // Locking the page hides a classic scrollbar, which would widen the page under the backdrop: pad by its width.
    const viewportWidth = document.documentElement.clientWidth
    const scrollbar = viewportWidth > 0 ? window.innerWidth - viewportWidth : 0
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    const opener = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      body.style.overflow = previous.overflow
      body.style.paddingRight = previous.paddingRight
      opener?.focus?.()
    }
  }, [open])

  const trapTab = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return
    const focusable = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-5"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
        className={cn(
          // 90dvh, not vh: vh is the height with the browser bars hidden. overscroll-contain: scrolling stops at the
          // sheet's edge instead of moving (or refreshing) the page behind it.
          'flex max-h-[90dvh] w-full animate-sheet-up flex-col items-stretch gap-5 overflow-y-auto overscroll-contain rounded-t-xl border border-line bg-surface p-6 outline-none sm:max-w-[432px] sm:animate-dialog-in sm:rounded-xl motion-reduce:animate-fade-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[23px] leading-[1.35] font-normal text-ink">{title}</h2>
          {/* 44 px target; the negative margin keeps the icon where the 28 px button had it. */}
          <button
            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-option text-forest hover:bg-mint"
          >
            <X size={20} strokeWidth={1.8} absoluteStrokeWidth />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
