'use client'

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, useDragControls, useIsPresent, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import * as m from 'motion/react-m'
import { loadForDialog, MotionFeatures, SHEET_QUERY, useFeaturesReady } from '@/components/motion/MotionFeatures'
import { dialogEnter, dialogExit, fade, PROJECTION_SECONDS, sheetElastic, sheetEnter, sheetExit, sheetSnapBack } from '@/components/motion/springs'
import { cn } from '@/lib/format'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Pinned under the scrolling content (the filter sheet's «Sıfırla» and primary button). */
  footer?: ReactNode
  /** Extra classes for the panel (e.g. a wider sheet). */
  className?: string
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const subscribeToSheet = (onChange: () => void) => {
  const query = window.matchMedia?.(SHEET_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}

/** Below 640 px the dialog is a bottom sheet. Dialogs are never open in server HTML, so the server answer is moot. */
function useIsSheet() {
  return useSyncExternalStore(subscribeToSheet, () => window.matchMedia?.(SHEET_QUERY).matches ?? false, () => false)
}

/** A sheet offset in px; Motion may hold it as a percentage of the sheet's height while it enters or leaves. */
const toPx = (value: number | string, height: number) =>
  typeof value === 'number' ? value : value.endsWith('%') ? (parseFloat(value) / 100) * height : parseFloat(value) || 0

/*
 * Figma "Dialoqlar": white panel, radius 12, 23 px title, 20 px gaps; a header (title, 44 px close button) and an
 * optional footer stay put while the content between them scrolls. Tab and Shift+Tab stay inside the panel, Esc and
 * the backdrop close it, focus returns to the opener.
 *
 * Below 640 px it is a bottom sheet with a grab handle (Motion, springs in components/motion/springs.ts): it slides
 * up without overshoot, and leaves the way it came — down — when closed. The handle and title bar drag it, 1:1 with
 * the finger (upward only with a rubber band); on release it closes if its position plus the release velocity's
 * projected travel passes half its height, otherwise it springs back with that velocity. Grabbing it mid-animation
 * takes over from where it is. The backdrop dims with the sheet's position. The backdrop is a sibling of the panel,
 * so the sheet itself never fades. From 640 px it is a centred dialog that settles from .97.
 * Reduced motion: no slide or scale, a short cross-fade; dragging still follows the finger.
 */
export function Dialog({ open, title, onClose, children, footer, className }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
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
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      body.style.overflow = previous.overflow
      body.style.paddingRight = previous.paddingRight
      opener?.focus?.()
    }
  }, [open])

  return (
    <MotionFeatures load={loadForDialog}>
      <AnimatePresence>
        {open && (
          <DialogLayer key="dialog" title={title} onClose={onClose} footer={footer} className={className} panelRef={panelRef}>
            {children}
          </DialogLayer>
        )}
      </AnimatePresence>
    </MotionFeatures>
  )
}

interface DialogLayerProps extends Omit<DialogProps, 'open'> {
  panelRef: RefObject<HTMLDivElement | null>
}

function DialogLayer({ title, onClose, children, footer, className, panelRef }: DialogLayerProps) {
  const isPresent = useIsPresent()
  const sheet = useIsSheet()
  const reduce = useReducedMotion() ?? false
  // Opened before the motion bundle arrived (the first moments after load, or a chunk that failed): show and hide it
  // without animation rather than leave it below the screen. Decided once, when it opens.
  const ready = useFeaturesReady()
  const [animated] = useState(ready)
  const slides = animated && sheet && !reduce
  const dragControls = useDragControls()
  const y = useMotionValue<number | string>(0)
  const height = () => panelRef.current?.offsetHeight || 1
  // Fully dimmed at rest, clear once the sheet is off screen; it follows the finger while dragging. Written straight
  // to the backdrop's style (one element, no re-render; useTransform would pull Motion's mixers into the first load).
  const backdropRef = useRef<HTMLDivElement>(null)
  useMotionValueEvent(y, 'change', (value) => {
    if (slides && backdropRef.current) backdropRef.current.style.opacity = String(1 - Math.min(1, Math.max(0, toPx(value, height()) / height())))
  })

  const trapTab = (e: ReactKeyboardEvent) => {
    const panel = panelRef.current
    if (e.key !== 'Tab' || !panel) return
    const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // The handle and the title bar start a drag; the close button stays a plain tap.
  const startDrag = (e: ReactPointerEvent) => {
    if (e.target instanceof Element && e.target.closest('button')) return
    dragControls.start(e)
  }

  // Apple's projection: where the sheet would come to rest if the release velocity carried on decelerating.
  const settle = (_: unknown, info: { velocity: { y: number } }) => {
    if (toPx(y.get(), height()) + info.velocity.y * PROJECTION_SECONDS > height() / 2) onClose()
  }

  return (
    <div inert={!isPresent || undefined} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-5">
      <m.div
        ref={backdropRef}
        aria-hidden
        onMouseDown={onClose}
        className="absolute inset-0 bg-ink/40"
        {...(slides
          ? { style: { opacity: 0 } }
          : animated
            ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: fade }
            : {})}
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={trapTab}
        style={sheet ? { y } : undefined}
        initial={!animated ? false : slides ? { y: '100%' } : sheet ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
        animate={slides ? { y: 0, transition: sheetEnter } : sheet ? { opacity: 1, transition: fade } : { opacity: 1, scale: 1, transition: dialogEnter }}
        exit={!animated ? undefined : slides ? { y: '100%', transition: sheetExit } : sheet ? { opacity: 0, transition: fade } : { opacity: 0, scale: 0.98, transition: dialogExit }}
        drag={animated && sheet ? 'y' : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={sheetElastic}
        dragTransition={sheetSnapBack}
        onDragEnd={settle}
        className={cn(
          // 90dvh, not vh: vh is the height with the browser bars hidden.
          'relative flex max-h-[90dvh] w-full flex-col rounded-t-xl border border-line bg-surface outline-none sm:max-w-[432px] sm:rounded-xl',
          // A strip of the sheet's surface below its edge, so an overshoot or an upward rubber band never shows a gap.
          "after:absolute after:inset-x-[-1px] after:top-full after:h-12 after:bg-surface after:content-[''] sm:after:hidden",
          className,
        )}
      >
        <div onPointerDown={sheet ? startDrag : undefined} className={cn('flex shrink-0 flex-col px-6 pt-6 pb-5', sheet && 'cursor-grab touch-none pt-2.5 select-none')}>
          {sheet && <span aria-hidden className="mx-auto mb-3.5 h-[5px] w-9 rounded-full bg-line-strong" />}
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[23px] leading-[1.35] font-normal text-ink">{title}</h2>
            {/* 44 px target; the negative margin keeps the 20 px icon where the old 28 px button had it. */}
            <button
              type="button"
              aria-label="Bağla"
              onClick={onClose}
              className="-m-3 flex size-11 shrink-0 items-center justify-center rounded-option text-forest transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-mint active:scale-[0.95] motion-reduce:active:scale-100"
            >
              <X size={20} strokeWidth={1.8} absoluteStrokeWidth />
            </button>
          </div>
        </div>
        {/* overscroll-contain: scrolling stops at the sheet's edge instead of moving (or refreshing) the page behind. */}
        <div className="flex min-h-0 flex-1 flex-col items-stretch gap-5 overflow-y-auto overscroll-contain px-6 pb-6">{children}</div>
        {footer && (
          // The bottom padding grows by the home-indicator inset on notched phones (viewport-fit=cover).
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-6 pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </m.div>
    </div>
  )
}
