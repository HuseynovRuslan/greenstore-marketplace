'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  /** "Ağaclar · 6 axtarış nəticəsi" — shown on the dimmed strip above the sheet. */
  summary: string
  children: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Figma "Mobil filtr paneli · 390": the header and the bottom navigation stay visible; between them a
 * dimmed strip ("Filtr arxa fonu", #20352b @ 20 %) and the white bottom sheet ("Filtr alt paneli",
 * top radius 20, p 20, 44×4 handle, 23 px "Filtrlər" title + close icon). Used below 1280 px.
 * Closes on backdrop click, Escape and the × button; locks body scroll and keeps focus inside while open.
 */
export function FilterSheet({ open, onClose, summary, children }: FilterSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !sheetRef.current) return
      const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-x-0 top-[63px] bottom-[86px] z-30 flex flex-col bg-cream md:top-[82px] md:bottom-0 xl:hidden">
      <div className="flex min-h-[63px] flex-1 items-start bg-ink/20 p-5" onClick={onClose} data-testid="filter-backdrop">
        <p className="text-[15px] leading-[1.5] text-muted">{summary}</p>
      </div>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[calc(100%-63px)] shrink-0 overflow-y-auto overscroll-contain rounded-t-[20px] bg-surface outline-none"
      >
        <div className="mx-auto flex w-full max-w-[600px] flex-col items-start gap-5 p-5 md:px-7">
          <span aria-hidden className="h-1 w-11 shrink-0 rounded-[2px] bg-line" />
          <div className="flex w-full items-start justify-between">
            <h2 id={titleId} className="text-[23px] leading-[1.5] font-semibold text-ink">
              Filtrlər
            </h2>
            <button type="button" aria-label="Filtrləri bağla" onClick={onClose} className="-m-2 rounded-lg p-2 text-forest hover:bg-mint">
              <X aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
