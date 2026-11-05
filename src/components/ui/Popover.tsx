'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type TransitionEvent as ReactTransitionEvent,
} from 'react'
import { cn } from '@/lib/format'

/*
 * Floating panel shared by Listbox and the filter-chip popovers (Variant 2 mockup):
 * white surface, 1 px line border, radius 14, --shadow-popover, 6 px under the trigger, above the hero content.
 * Motion lives in index.css (.gs-panel): open 160 ms ease-out from opacity 0 / translateY(-4px) / scale(.98),
 * close 110 ms ease-in; opacity only under prefers-reduced-motion.
 */
export const panelClass = 'gs-panel absolute top-[calc(100%+6px)] z-30 rounded-panel border border-line bg-surface shadow-popover'

/** --dur-panel-out; the fallback timer below waits a little longer than the exit transition. */
const EXIT_MS = 110

/* ---------- Open panels (the header reads this so it never slides away from an open panel) ---------- */

let openPanels = 0

export function isPanelOpen(): boolean {
  return openPanels > 0
}

export function useOpenPanelCount(open: boolean) {
  useEffect(() => {
    if (!open) return
    openPanels += 1
    return () => {
      openPanels -= 1
    }
  }, [open])
}

/* ---------- Presence: keep the panel mounted while it animates out ---------- */

/**
 * `state` drives the CSS (`data-state`). Closing keeps the panel present until its `transitionend`, or until a
 * timer when no transition runs (no CSS, jsdom): the open/closed state itself never waits for an animation event.
 */
export function usePresence(open: boolean) {
  const [present, setPresent] = useState(open)
  if (open && !present) setPresent(true)

  useEffect(() => {
    if (open || !present) return
    const timer = window.setTimeout(() => setPresent(false), EXIT_MS + 60)
    return () => window.clearTimeout(timer)
  }, [open, present])

  const onTransitionEnd = (e: ReactTransitionEvent) => {
    if (!open && e.target === e.currentTarget) setPresent(false)
  }
  return { present, state: open ? ('open' as const) : ('closed' as const), onTransitionEnd }
}

/* ---------- Dismiss on a pointer press outside ---------- */

/** Calls `onOutside` when a pointer goes down outside `root` (trigger + panel) while the panel is open. */
export function useOutsidePress(open: boolean, root: RefObject<HTMLElement | null>, onOutside: () => void) {
  const latest = useRef(onOutside)
  useEffect(() => {
    latest.current = onOutside
  })
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) latest.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, root])
}

/* ---------- Keep the panel inside the viewport ---------- */

export type PanelAlign = 'start' | 'end'

/** Positions a panel at its trigger's start edge, or at the end edge once `usePanelAlign` sets data-align="end". */
export const panelAlignClass = 'left-0 data-[align=end]:right-0 data-[align=end]:left-auto'

/**
 * Aligns the panel to the trigger's start edge, or to its end edge when the start would overflow the viewport
 * (measured before paint, written to `data-align`).
 */
export function usePanelAlign(present: boolean, panel: RefObject<HTMLElement | null>, preferred: PanelAlign = 'start') {
  useLayoutEffect(() => {
    const el = panel.current
    const anchor = el?.offsetParent?.getBoundingClientRect()
    if (!present || !el || !anchor) return
    const gutter = 8
    const fitsStart = anchor.left + el.offsetWidth <= window.innerWidth - gutter
    const fitsEnd = anchor.right - el.offsetWidth >= gutter
    const end = preferred === 'end' ? fitsEnd || !fitsStart : !fitsStart && fitsEnd
    el.setAttribute('data-align', end ? 'end' : 'start')
  }, [present, panel, preferred])
}

/* ---------- Popover ---------- */

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface PopoverTriggerProps {
  id: string
  type: 'button'
  'aria-haspopup': 'dialog'
  'aria-expanded': boolean
  /** Set while the panel is in the DOM. */
  'aria-controls': string | undefined
  onClick: () => void
}

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible name of the dialog, e.g. "Qiymət, ₼". */
  label: string
  /** Renders the trigger; spread the props on a <button>. */
  trigger: (props: PopoverTriggerProps) => ReactNode
  /** Panel content. As a function it receives `close()`, which closes the panel and returns focus to the trigger. */
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: PanelAlign
  className?: string
  panelClassName?: string
}

/**
 * Non-modal popover (role="dialog"): opens below its trigger, moves focus to the first control inside
 * (or `[data-autofocus]`), closes on Esc / pointer press outside / Tab out of it, and returns focus to the
 * trigger when closed with Esc or `close()`.
 */
export function Popover({ open, onOpenChange, label, trigger, children, align: preferredAlign, className, panelClassName }: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const triggerId = `${panelId}-trigger`
  const { present, state, onTransitionEnd } = usePresence(open)
  usePanelAlign(present, panelRef, preferredAlign)
  useOpenPanelCount(open)
  useOutsidePress(open, rootRef, () => onOpenChange(false))

  // Looks the trigger up by id (not a ref) because `close` is handed to the render function below.
  const close = () => {
    onOpenChange(false)
    document.getElementById(triggerId)?.focus()
  }

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel
    target?.focus({ preventScroll: true })
  }, [open])

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return
    e.stopPropagation()
    close()
  }

  // Tabbing out of the panel (or the trigger) closes it without pulling focus back.
  const onBlur = (e: ReactFocusEvent) => {
    const next = e.relatedTarget
    if (open && next instanceof Node && !rootRef.current?.contains(next)) onOpenChange(false)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)} onKeyDown={onKeyDown} onBlur={onBlur}>
      {trigger({
        id: triggerId,
        type: 'button',
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': present ? panelId : undefined,
        onClick: () => onOpenChange(!open),
      })}
      {present && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          data-state={state}
          inert={!open}
          onTransitionEnd={onTransitionEnd}
          className={cn(panelClass, panelAlignClass, 'p-4 outline-none', panelClassName)}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  )
}
